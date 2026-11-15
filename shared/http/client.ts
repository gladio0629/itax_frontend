// The one HTTP client used by all three apps' http adapters.
// - Base URL from VITE_API_URL ("" = same origin through the dev proxy).
// - Every request: Content-Type: application/json, Accept, X-App and (when
//   signed in) Authorization: Bearer <access token>.
// - 15 s timeout (AbortController), JSON parsing, error envelope → ApiError.
// - 401 on a request that carried a bearer: refresh once (single flight,
//   shared by every concurrent caller), then retry once. Only a refresh
//   rejected by the server ends the session; a timeout or network failure
//   during refresh keeps the user signed in.
// Never logs URLs with tokens, tokens, phone numbers or codes: it logs
// nothing at all.
import { API_PATHS, type TokenPair } from "../api/openapi.ts";
import type { AppId } from "./config.ts";
import { ApiError, NETWORK_ERROR, parseErrorBody, type ErrorMessageFn, type ErrorParams } from "./errors.ts";
import type { TokenStore } from "./tokens.ts";

export const DEFAULT_TIMEOUT_MS = 15_000;

export type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Default true. false: never send a bearer and never refresh (auth endpoints). */
  auth?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type HttpClientOptions = {
  app: AppId;
  baseUrl: string;
  tokens: TokenStore;
  /** client/driver: true. admin: false (AdminToken has no refresh token). */
  canRefresh: boolean;
  errorMessage?: ErrorMessageFn;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** The server no longer accepts this session (refresh rejected, or a 401
   * that can't be refreshed). The app clears state and goes to login. */
  onSessionExpired?: () => void;
  /** New tokens are in the store (the WebSocket reconnects with them). */
  onTokensRefreshed?: () => void;
};

export type HttpClient = {
  request<T>(method: string, path: string, opts?: RequestOptions): Promise<T>;
  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">): Promise<T>;
  put<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">): Promise<T>;
  patch<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">): Promise<T>;
  delete<T>(path: string, opts?: RequestOptions): Promise<T>;
  /** Single-flight refresh. true = new tokens stored; false = session over
   * (no refresh token, or the server rejected it). Throws ApiError on
   * network failure / timeout / 5xx without touching the session. */
  refresh(): Promise<boolean>;
  /** PUT raw file bytes to a signed upload_url (no bearer, no JSON). */
  uploadFile(uploadUrl: string, file: Blob, headers?: Record<string, string>): Promise<void>;
};

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.append(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

const fallbackMessage: ErrorMessageFn = (key) => key;

export function createHttpClient(opts: HttpClientOptions): HttpClient {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch: typeof fetch = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const message = opts.errorMessage ?? fallbackMessage;
  const { tokens } = opts;

  const toError = (key: string, params: ErrorParams, status: number) =>
    new ApiError(key, message(key, params), { params, status });

  const urlFor = (path: string) => (/^https?:\/\//i.test(path) ? path : `${opts.baseUrl}${path}`);

  /** fetch with the timeout and caller signal combined; maps "no response"
   * to NETWORK_ERROR. */
  async function send(url: string, init: RequestInit, signal: AbortSignal | undefined, ms: number): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    try {
      return await doFetch(url, { ...init, signal: controller.signal });
    } catch {
      if (signal?.aborted && !timedOut) throw new ApiError("ABORTED", "ABORTED");
      throw toError(NETWORK_ERROR, timedOut ? { reason: "timeout" } : {}, 0);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function readBody(res: Response): Promise<unknown> {
    if (res.status === 204) return undefined;
    const text = await res.text().catch(() => "");
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  async function once<T>(method: string, path: string, o: RequestOptions, bearer: string | null): Promise<{ res: Response; body: unknown }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-App": opts.app,
    };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (o.idempotencyKey) headers["Idempotency-Key"] = o.idempotencyKey;
    const res = await send(
      urlFor(path) + buildQuery(o.query),
      { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body), credentials: "omit" },
      o.signal,
      o.timeoutMs ?? timeoutMs
    );
    return { res, body: await readBody(res) };
  }

  function fail(res: Response, body: unknown): never {
    const { key, params } = parseErrorBody(body);
    throw toError(key, params, res.status);
  }

  let refreshing: Promise<boolean> | null = null;

  function refresh(): Promise<boolean> {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const refreshToken = tokens.getRefresh();
      if (!opts.canRefresh || !refreshToken) return false;
      const { res, body } = await once("POST", API_PATHS.tokenRefresh, { body: { refresh_token: refreshToken } }, null);
      if (res.ok) {
        tokens.set(body as TokenPair);
        opts.onTokensRefreshed?.();
        return true;
      }
      // Rejected by the server: this session is over.
      if (res.status === 401 || res.status === 403 || res.status === 422) {
        tokens.clear();
        return false;
      }
      fail(res, body); // 5xx / unexpected: keep the session, surface the error
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  let expiredNotified = false;
  function sessionExpired() {
    tokens.clear();
    if (expiredNotified) return;
    expiredNotified = true;
    // Several in-flight requests may hit this at once; notify once per burst.
    queueMicrotask(() => {
      expiredNotified = false;
    });
    opts.onSessionExpired?.();
  }

  async function request<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
    const auth = o.auth !== false;
    // After a reload the access token is gone but the refresh token isn't.
    if (auth && opts.canRefresh && tokens.accessExpired() && tokens.getRefresh()) {
      const ok = await refresh();
      if (!ok) {
        sessionExpired();
        throw toError("AUTH_TOKEN_EXPIRED", {}, 401);
      }
    }
    const bearer = auth ? tokens.getAccess() : null;
    let { res, body } = await once<T>(method, path, o, bearer);

    if (res.status === 401 && bearer) {
      // Only a request that carried a bearer means "token expired"; auth
      // endpoints answer 401 for a wrong code and must not trigger this.
      const ok = opts.canRefresh ? await refresh() : false;
      if (!ok) {
        sessionExpired();
        fail(res, body);
      }
      ({ res, body } = await once<T>(method, path, o, tokens.getAccess()));
      if (res.status === 401) {
        sessionExpired();
        fail(res, body);
      }
    }
    if (!res.ok) fail(res, body);
    return body as T;
  }

  async function uploadFile(uploadUrl: string, file: Blob, headers: Record<string, string> = {}): Promise<void> {
    const res = await send(
      urlFor(uploadUrl),
      { method: "PUT", headers: { "Content-Type": file.type, ...headers }, body: file, credentials: "omit" },
      undefined,
      // Up to 10 MB on a phone connection: give it longer than JSON calls.
      Math.max(timeoutMs, 120_000)
    );
    if (!res.ok) fail(res, await readBody(res));
  }

  return {
    request,
    get: (path, query) => request("GET", path, { query }),
    post: (path, body, o) => request("POST", path, { ...o, body }),
    put: (path, body, o) => request("PUT", path, { ...o, body }),
    patch: (path, body, o) => request("PATCH", path, { ...o, body }),
    delete: (path, o) => request("DELETE", path, o),
    refresh,
    uploadFile,
  };
}
