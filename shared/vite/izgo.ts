// Vite build/dev helpers shared by the three apps. Runs in Node (inside
// vite.config.ts), never in the browser, and is not part of the apps'
// tsconfig, so it may use Node built-ins.
import { connect } from "node:net";
import type { Plugin, ProxyOptions } from "vite";

const DEV_BACKEND_PROBE_PATH = "/__izgo/backend";
export const DEFAULT_DEV_PROXY_TARGET = "http://localhost:8000";

/** Dev proxy: /api, /admin and /ws go to the backend, so an empty
 * VITE_API_URL works from the same origin (no CORS) — also from an iPhone
 * on the LAN that opens the dev server by IP. Regex keys keep SPA routes
 * such as /admin-something out of the proxy. */
export function izgoDevProxy(target: string): Record<string, ProxyOptions> {
  const common: ProxyOptions = {
    target,
    changeOrigin: true,
    configure(proxy) {
      // Backend stopped mid-session: answer like the API would (an error
      // envelope) so the app shows its "no connection" message.
      proxy.on("error", (_err, _req, res) => {
        const out = res as unknown as {
          headersSent?: boolean;
          writeHead?: (status: number, headers: Record<string, string>) => void;
          end?: (body?: string) => void;
          destroy?: () => void;
        };
        if (typeof out.writeHead === "function" && typeof out.end === "function") {
          if (!out.headersSent) out.writeHead(502, { "content-type": "application/json" });
          out.end(JSON.stringify({ error: { key: "NETWORK_ERROR", params: {} } }));
        } else {
          out.destroy?.(); // a WebSocket upgrade socket
        }
      });
    },
  };
  return {
    "^/api/": common,
    "^/admin/v1/": common,
    "^/ws(\\?|$)": { ...common, ws: true },
  };
}

function canConnect(target: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      resolve(false);
      return;
    }
    const port = Number(url.port) || (url.protocol === "https:" ? 443 : 80);
    const socket = connect({ host: url.hostname, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/** Dev only: GET /__izgo/backend → 200 { reachable }. Lets the app decide
 * between the normal UI and the "no server" screen without a failing
 * request (which would print a red error in the browser console). */
export function izgoBackendProbe(target: string): Plugin {
  return {
    name: "izgo-dev-backend-probe",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(DEV_BACKEND_PROBE_PATH, (_req, res) => {
        canConnect(target).then((reachable) => {
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.setHeader("cache-control", "no-store");
          res.end(JSON.stringify({ reachable }));
        });
      });
    },
  };
}
