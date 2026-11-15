// WebSocket client for GET /ws (client and driver only; the contract's /ws
// takes identity tokens, not admin tokens). Events: onlyback/docs/websocket-events.md.
// - Auth by subprotocol: new WebSocket(url, ["izgo.v1", "bearer.<token>"]).
//   The token is never in the URL (URLs end up in proxy and access logs);
//   the server checks it before the upgrade and echoes only "izgo.v1".
// - One socket at a time (the server allows 3 per user): the old one is
//   closed before a new one opens.
// - Reconnects with exponential backoff, 1 s doubling up to 30 s.
// - Close 4401 token_expired / token_invalid → refresh, then reconnect;
//   4401 session_revoked → session over. 4403 ws_connection_limit (too many
//   tabs) → slow backoff. Reconnects after every token refresh.
// - Server → client only: this never sends a frame (the server closes with
//   1008 if the client sends data).
// - The protocol list carries the token, so it is never logged or put in errors.
import type { RealtimeEvent } from "../api/openapi.ts";
import { websocketUrl } from "./config.ts";

export type RealtimeListener = (event: RealtimeEvent) => void;

/** Subprotocol the server echoes; the bearer entry carries the access token. */
export const WS_PROTOCOL = "izgo.v1";

type SocketLike = {
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  close(code?: number, reason?: string): void;
};

export type RealtimeOptions = {
  baseUrl: string;
  getToken: () => string | null;
  tokenExpired: () => boolean;
  /** HttpClient.refresh: true = new token, false = session over. */
  refresh: () => Promise<boolean>;
  onSessionEnded: () => void;
  minDelayMs?: number;
  maxDelayMs?: number;
  WebSocketImpl?: new (url: string, protocols?: string[]) => SocketLike;
};

export type Realtime = {
  /** Opens the socket (no-op without a token or when already open). */
  connect(): void;
  /** Closes and stops reconnecting (logout). */
  disconnect(): void;
  /** Reopens with the current token (after a refresh). */
  reconnectNow(): void;
  subscribe(listener: RealtimeListener): () => void;
  isOpen(): boolean;
};

export function createRealtime(opts: RealtimeOptions): Realtime {
  const minDelay = opts.minDelayMs ?? 1000;
  const maxDelay = opts.maxDelayMs ?? 30_000;
  const listeners = new Set<RealtimeListener>();
  let socket: SocketLike | null = null;
  let open = false;
  let wanted = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const Impl =
    opts.WebSocketImpl ??
    (typeof WebSocket !== "undefined" ? (WebSocket as unknown as new (url: string, protocols?: string[]) => SocketLike) : null);

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function closeSocket() {
    const s = socket;
    socket = null;
    open = false;
    if (!s) return;
    s.onopen = s.onmessage = s.onerror = null;
    s.onclose = null;
    try {
      s.close(1000, "client_close");
    } catch {
      /* already closed */
    }
  }

  function scheduleReconnect() {
    if (!wanted || timer) return;
    const delay = Math.min(maxDelay, minDelay * 2 ** attempt);
    attempt += 1;
    timer = setTimeout(() => {
      timer = null;
      void openSocket();
    }, delay);
  }

  async function openSocket() {
    if (!wanted || !Impl) return;
    if (opts.tokenExpired()) {
      try {
        if (!(await opts.refresh())) return end();
      } catch {
        return scheduleReconnect(); // offline: try again later
      }
      // The refresh may already have reopened us via reconnectNow().
      if (socket) return;
    }
    const token = opts.getToken();
    if (!token || !wanted) return;
    closeSocket();
    let s: SocketLike;
    try {
      s = new Impl(websocketUrl(opts.baseUrl, "/ws"), [WS_PROTOCOL, `bearer.${token}`]);
    } catch {
      return scheduleReconnect();
    }
    socket = s;
    s.onopen = () => {
      open = true;
      attempt = 0;
    };
    s.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      let event: RealtimeEvent;
      try {
        event = JSON.parse(ev.data) as RealtimeEvent;
      } catch {
        return;
      }
      if (!event || typeof event.type !== "string") return;
      for (const l of listeners) {
        try {
          l(event);
        } catch {
          /* a listener's bug must not kill the socket */
        }
      }
    };
    s.onerror = () => {
      /* followed by onclose */
    };
    s.onclose = (ev) => {
      if (socket !== s) return;
      socket = null;
      open = false;
      if (!wanted) return;
      if (ev.code === 4401 && ev.reason === "session_revoked") return end();
      if (ev.code === 4403) {
        // Too many open connections for this user: wait the longest delay.
        attempt = Math.max(attempt, 30);
        return scheduleReconnect();
      }
      if (ev.code === 4401) {
        // token_expired: refresh, then reconnect right away.
        opts.refresh().then(
          (ok) => (!ok ? end() : socket ? undefined : void openSocket()),
          () => scheduleReconnect()
        );
        return;
      }
      scheduleReconnect();
    };
  }

  function end() {
    wanted = false;
    clearTimer();
    closeSocket();
    opts.onSessionEnded();
  }

  return {
    connect() {
      wanted = true;
      if (socket || timer) return;
      void openSocket();
    },
    disconnect() {
      wanted = false;
      attempt = 0;
      clearTimer();
      closeSocket();
    },
    reconnectNow() {
      if (!wanted) return;
      clearTimer();
      attempt = 0;
      void openSocket();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isOpen: () => open,
  };
}
