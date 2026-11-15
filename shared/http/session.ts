// Wires tokens + HTTP client + WebSocket into one session object. Each
// app's http adapter creates exactly one, at module scope, so the refresh
// single-flight is shared by everything in the tab (including React
// StrictMode's doubled effects).
import { API_PATHS, type AdminToken, type TokenPair } from "../api/openapi.ts";
import type { AppId } from "./config.ts";
import type { ErrorMessageFn } from "./errors.ts";
import { createHttpClient, type HttpClient } from "./client.ts";
import { createIdempotencyKeys, type IdempotencyKeys } from "./idempotency.ts";
import { createRealtime, type Realtime } from "./realtime.ts";
import { createTokenStore, type TokenStore } from "./tokens.ts";

export type SessionEndReason = "expired" | "revoked" | "logout";

export type ApiSession = {
  app: AppId;
  http: HttpClient;
  tokens: TokenStore;
  idempotency: IdempotencyKeys;
  /** null for admin (no WebSocket for staff tokens). */
  realtime: Realtime | null;
  /** Store tokens from otp/verify or admin login/verify, then connect /ws. */
  signIn(tokens: TokenPair | AdminToken): void;
  /** After a reload: refresh with the stored refresh token. true = signed
   * in; false = no session; throws ApiError on network failure (session kept). */
  resume(): Promise<boolean>;
  hasSession(): boolean;
  /** POST /auth/logout (client/driver; admin has no logout endpoint), then
   * clear memory, storage, caches and the WebSocket. Never throws. */
  logout(): Promise<void>;
  /** Called when the session ends for any reason (clear caches, go to login). */
  onEnd(listener: (reason: SessionEndReason) => void): () => void;
};

export function createApiSession(opts: {
  app: AppId;
  baseUrl: string;
  errorMessage?: ErrorMessageFn;
  fetchImpl?: typeof fetch;
}): ApiSession {
  const isAdmin = opts.app === "admin";
  const tokens = createTokenStore({ refreshStorageKey: isAdmin ? null : `izgo_${opts.app}_session` });
  const endListeners = new Set<(reason: SessionEndReason) => void>();
  let realtime: Realtime | null = null;

  const end = (reason: SessionEndReason) => {
    tokens.clear();
    realtime?.disconnect();
    for (const l of endListeners) {
      try {
        l(reason);
      } catch {
        /* keep notifying the rest */
      }
    }
  };

  const http = createHttpClient({
    app: opts.app,
    baseUrl: opts.baseUrl,
    tokens,
    canRefresh: !isAdmin,
    errorMessage: opts.errorMessage,
    fetchImpl: opts.fetchImpl,
    onSessionExpired: () => end("expired"),
    onTokensRefreshed: () => realtime?.reconnectNow(),
  });

  if (!isAdmin) {
    realtime = createRealtime({
      baseUrl: opts.baseUrl,
      getToken: tokens.getAccess,
      tokenExpired: () => tokens.accessExpired(),
      refresh: http.refresh,
      onSessionEnded: () => end("revoked"),
    });
  }

  return {
    app: opts.app,
    http,
    tokens,
    idempotency: createIdempotencyKeys(),
    realtime,
    signIn(pair) {
      tokens.set(pair);
      realtime?.connect();
    },
    async resume() {
      if (tokens.getAccess() && !tokens.accessExpired()) {
        realtime?.connect();
        return true;
      }
      if (isAdmin || !tokens.getRefresh()) return false;
      const ok = await http.refresh();
      if (ok) realtime?.connect();
      return ok;
    },
    hasSession: () => tokens.hasSession(),
    async logout() {
      realtime?.disconnect();
      if (!isAdmin && tokens.getRefresh()) {
        try {
          // The endpoint needs a bearer; refresh first so the body carries
          // the refresh token that is current after rotation.
          if (tokens.accessExpired() && !(await http.refresh())) throw new Error("no session");
          const refreshToken = tokens.getRefresh();
          if (refreshToken) await http.post(API_PATHS.logout, { refresh_token: refreshToken });
        } catch {
          /* offline or already revoked: still sign out locally */
        }
      }
      end("logout");
    },
    onEnd(listener) {
      endListeners.add(listener);
      return () => endListeners.delete(listener);
    },
  };
}
