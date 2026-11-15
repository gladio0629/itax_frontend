// Run: node --test shared/http/   (Node ≥ 22.6 strips the types itself; no
// test package needed). fetch and storage are stubbed; nothing hits the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHttpClient, type HttpClientOptions } from "./client.ts";
import { ApiError, NETWORK_ERROR, UNKNOWN_ERROR } from "./errors.ts";
import { createIdempotencyKeys } from "./idempotency.ts";
import { createTokenStore } from "./tokens.ts";
import { createRealtime } from "./realtime.ts";
import { normalizeApiUrl, resolveApiConfig, websocketUrl } from "./config.ts";

type Call = { url: string; init: RequestInit };

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(handler: (call: Call, n: number) => Response | Promise<Response>, extra: Partial<HttpClientOptions> = {}) {
  const calls: Call[] = [];
  const tokens = createTokenStore({ refreshStorageKey: "rt", storage: memoryStorage() });
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call, calls.length);
  }) as typeof fetch;
  let expired = 0;
  const http = createHttpClient({
    app: "client",
    baseUrl: "https://api.example.com",
    tokens,
    canRefresh: true,
    fetchImpl,
    errorMessage: (key) => (key === "AUTH_OTP_INVALID" || key === "VALIDATION_ERROR" ? `errors.${key}` : "errors.generic"),
    onSessionExpired: () => void expired++,
    ...extra,
  });
  return { http, tokens, calls, expired: () => expired };
}

const headersOf = (c: Call) => c.init.headers as Record<string, string>;
const isRefresh = (c: Call) => c.url.endsWith("/api/v1/auth/token/refresh");

test("sends the contract headers and JSON body", async () => {
  const { http, tokens, calls } = setup(() => json(201, { id: "o1" }));
  tokens.set({ access_token: "AT", refresh_token: "RT", expires_in: 900 });
  const res = await http.post<{ id: string }>("/api/v1/orders", { type: "passenger" }, { idempotencyKey: "k-1" });
  assert.equal(res.id, "o1");
  const h = headersOf(calls[0]);
  assert.equal(calls[0].url, "https://api.example.com/api/v1/orders");
  assert.equal(h["Content-Type"], "application/json");
  assert.equal(h["X-App"], "client");
  assert.equal(h.Authorization, "Bearer AT");
  assert.equal(h["Idempotency-Key"], "k-1");
  assert.equal(calls[0].init.body, JSON.stringify({ type: "passenger" }));
});

test("401: one refresh for concurrent requests (single flight), then each retries once", async () => {
  let refreshes = 0;
  const { http, tokens, calls } = setup(async (call) => {
    if (isRefresh(call)) {
      refreshes++;
      await new Promise((r) => setTimeout(r, 20));
      return json(200, { access_token: "AT2", refresh_token: "RT2", expires_in: 900, token_type: "Bearer" });
    }
    return headersOf(call).Authorization === "Bearer AT2" ? json(200, { ok: true }) : json(401, { error: { key: "AUTH_TOKEN_EXPIRED", params: {} } });
  });
  tokens.set({ access_token: "AT1", refresh_token: "RT1", expires_in: 900 });
  const results = await Promise.all([http.get("/api/v1/profile"), http.get("/api/v1/notifications"), http.get("/api/v1/orders/history")]);
  assert.deepEqual(results, [{ ok: true }, { ok: true }, { ok: true }]);
  assert.equal(refreshes, 1);
  assert.equal(tokens.getRefresh(), "RT2", "rotated refresh token is stored");
  const refreshCall = calls.find(isRefresh)!;
  assert.equal(refreshCall.init.body, JSON.stringify({ refresh_token: "RT1" }));
  assert.equal(headersOf(refreshCall).Authorization, undefined);
});

test("after a reload (no access token) the first call refreshes before sending", async () => {
  const { http, tokens, calls } = setup((call) =>
    isRefresh(call) ? json(200, { access_token: "AT9", refresh_token: "RT9", expires_in: 900, token_type: "Bearer" }) : json(200, {})
  );
  tokens.set({ access_token: "", refresh_token: "RT8" });
  await http.get("/api/v1/profile");
  assert.ok(isRefresh(calls[0]));
  assert.equal(headersOf(calls[1]).Authorization, "Bearer AT9");
});

test("refresh rejected (401): session cleared, onSessionExpired once", async () => {
  const { http, tokens, expired } = setup((call) =>
    isRefresh(call) ? json(401, { error: { key: "AUTH_TOKEN_EXPIRED", params: {} } }) : json(401, { error: { key: "AUTH_TOKEN_EXPIRED", params: {} } })
  );
  tokens.set({ access_token: "AT1", refresh_token: "RT1", expires_in: 900 });
  await assert.rejects(http.get("/api/v1/profile"), (e: ApiError) => e.code === "AUTH_TOKEN_EXPIRED" && e.status === 401);
  assert.equal(tokens.getRefresh(), null);
  assert.equal(tokens.getAccess(), null);
  assert.equal(expired(), 1);
});

test("refresh fails on the network: the user stays signed in", async () => {
  const { http, tokens, expired } = setup((call) => {
    if (isRefresh(call)) throw new TypeError("Failed to fetch");
    return json(401, { error: { key: "AUTH_TOKEN_EXPIRED", params: {} } });
  });
  tokens.set({ access_token: "AT1", refresh_token: "RT1", expires_in: 900 });
  await assert.rejects(http.get("/api/v1/profile"), (e: ApiError) => e.code === NETWORK_ERROR);
  assert.equal(tokens.getRefresh(), "RT1");
  assert.equal(expired(), 0);
});

test("401 from an auth endpoint (wrong OTP) never triggers a refresh", async () => {
  const { http, tokens, calls, expired } = setup(() => json(401, { error: { key: "AUTH_OTP_INVALID", params: { attempts_left: 2 } } }));
  tokens.set({ access_token: "AT1", refresh_token: "RT1", expires_in: 900 });
  await assert.rejects(http.post("/api/v1/auth/otp/verify", { phone: "+998900000000", code: "1111" }, { auth: false }), (e: ApiError) => {
    assert.equal(e.code, "AUTH_OTP_INVALID");
    assert.equal(e.message, "errors.AUTH_OTP_INVALID");
    assert.deepEqual(e.params, { attempts_left: 2 });
    return true;
  });
  assert.equal(calls.length, 1);
  assert.equal(expired(), 0);
  assert.equal(tokens.getRefresh(), "RT1");
});

test("admin (no refresh): a 401 ends the session without a refresh call", async () => {
  const { http, tokens, calls, expired } = setup(() => json(401, { error: { key: "AUTH_TOKEN_EXPIRED", params: {} } }), {
    app: "admin",
    canRefresh: false,
  });
  tokens.set({ access_token: "ADM", expires_in: 900 });
  await assert.rejects(http.get("/admin/v1/me"));
  assert.equal(calls.length, 1);
  assert.equal(expired(), 1);
});

test("error envelope → ApiError with the key; unknown key → generic message; garbage → UNKNOWN_ERROR", async () => {
  const bodies = [
    json(422, { error: { key: "VALIDATION_ERROR", params: { fields: { phone: "invalid_format" } } } }),
    json(409, { error: { key: "SOMETHING_NEW", params: {} } }),
    new Response("<html>bad gateway</html>", { status: 502 }),
  ];
  const { http } = setup((_c, n) => bodies[n - 1]);
  await assert.rejects(http.post("/x", {}, { auth: false }), (e: ApiError) => {
    assert.equal(e.code, "VALIDATION_ERROR");
    assert.equal(e.status, 422);
    assert.equal(e.message, "errors.VALIDATION_ERROR");
    assert.deepEqual(e.params, { fields: { phone: "invalid_format" } });
    return true;
  });
  await assert.rejects(http.post("/x", {}, { auth: false }), (e: ApiError) => e.code === "SOMETHING_NEW" && e.message === "errors.generic");
  await assert.rejects(http.post("/x", {}, { auth: false }), (e: ApiError) => e.code === UNKNOWN_ERROR && e.status === 502);
});

test("timeout: aborts after timeoutMs and maps to NETWORK_ERROR (reason timeout)", async () => {
  const { http } = setup(
    (call) =>
      new Promise<Response>((_resolve, reject) => {
        call.init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    { timeoutMs: 30 }
  );
  const started = Date.now();
  await assert.rejects(http.get("/slow"), (e: ApiError) => e.code === NETWORK_ERROR && e.params.reason === "timeout" && e.status === 0);
  assert.ok(Date.now() - started < 1000);
});

test("network failure maps to NETWORK_ERROR", async () => {
  const { http } = setup(() => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(http.get("/x"), (e: ApiError) => e.code === NETWORK_ERROR && e.message === "errors.generic");
});

test("204 resolves to undefined", async () => {
  const { http } = setup(() => new Response(null, { status: 204 }));
  assert.equal(await http.put("/api/v1/notifications/n1/read"), undefined);
});

test("idempotency: same action + payload reuses the key after a retryable failure; new payload gets a new key", async () => {
  let n = 0;
  const keys = createIdempotencyKeys(() => `key-${++n}`);
  const seen: string[] = [];
  const fail = new ApiError(NETWORK_ERROR);
  await assert.rejects(keys.run("orderCreate", { a: 1, b: 2 }, async (k) => (seen.push(k), Promise.reject(fail))));
  await keys.run("orderCreate", { b: 2, a: 1 }, async (k) => (seen.push(k), "ok"));
  await keys.run("orderCreate", { a: 1, b: 2 }, async (k) => (seen.push(k), "ok"));
  await keys.run("orderCreate", { a: 2 }, async (k) => (seen.push(k), "ok"));
  assert.deepEqual(seen, ["key-1", "key-1", "key-2", "key-3"]);
  // A definitive rejection (4xx) drops the key too.
  await assert.rejects(keys.run("topup", { x: 1 }, async (k) => (seen.push(k), Promise.reject(new ApiError("VALIDATION_ERROR", "", { status: 422 })))));
  await keys.run("topup", { x: 1 }, async (k) => (seen.push(k), "ok"));
  assert.deepEqual(seen.slice(4), ["key-4", "key-5"]);
});

test("config: URL normalization, prod without URL is 'not configured', wss for https", () => {
  assert.equal(normalizeApiUrl(" https://api.example.com/ "), "https://api.example.com");
  assert.equal(normalizeApiUrl("ftp://x"), "");
  assert.equal(normalizeApiUrl("not a url"), "");
  assert.deepEqual(resolveApiConfig({ apiUrl: "", dev: false }), { baseUrl: "", configured: false, viaDevProxy: false });
  assert.deepEqual(resolveApiConfig({ apiUrl: "", dev: true }), { baseUrl: "", configured: true, viaDevProxy: true });
  assert.equal(websocketUrl("https://api.example.com", "/ws"), "wss://api.example.com/ws");
  assert.equal(websocketUrl("", "/ws", { protocol: "http:", host: "192.168.1.5:5173" }), "ws://192.168.1.5:5173/ws");
});

test("realtime: one socket, backoff 1s→2s→…≤30s, token_expired refreshes and reconnects, never sends", async () => {
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    onopen: ((ev: unknown) => void) | null = null;
    onmessage: ((ev: { data: unknown }) => void) | null = null;
    onclose: ((ev: { code: number; reason: string }) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    url: string;
    protocols: string[];
    closed = false;
    constructor(url: string, protocols: string[] = []) {
      this.url = url;
      this.protocols = protocols;
      sockets.push(this);
    }
    close() {
      this.closed = true;
    }
    send() {
      throw new Error("client must never send");
    }
  }
  let token = "AT1";
  let refreshes = 0;
  const rt = createRealtime({
    baseUrl: "https://api.example.com",
    getToken: () => token,
    tokenExpired: () => false,
    refresh: async () => {
      refreshes++;
      token = "AT2";
      return true;
    },
    onSessionEnded: () => {},
    minDelayMs: 5,
    maxDelayMs: 12,
    WebSocketImpl: FakeSocket,
  });
  const got: string[] = [];
  rt.subscribe((e) => got.push(e.type));
  rt.connect();
  rt.connect(); // second call must not open a second socket
  assert.equal(sockets.length, 1);
  // token in the subprotocol, never in the URL
  assert.equal(sockets[0].url, "wss://api.example.com/ws");
  assert.deepEqual(sockets[0].protocols, ["izgo.v1", "bearer.AT1"]);
  sockets[0].onopen?.({});
  sockets[0].onmessage?.({ data: JSON.stringify({ type: "order.accepted", id: "o1", status: "accepted", order_id: "o1" }) });
  assert.deepEqual(got, ["order.accepted"]);

  sockets[0].onclose?.({ code: 4401, reason: "token_expired" });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(refreshes, 1);
  assert.equal(sockets.length, 2);
  assert.deepEqual(sockets[1].protocols, ["izgo.v1", "bearer.AT2"]);
  assert.ok(!sockets[1].url.includes("token"));

  sockets[1].onclose?.({ code: 1006, reason: "" }); // drop → backoff
  assert.equal(sockets.length, 2);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(sockets.length, 3);

  rt.disconnect();
  assert.ok(sockets[2].closed);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(sockets.length, 3, "no reconnect after disconnect");
});
