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

/** Origin of VITE_API_URL plus its WebSocket origin; [] when empty/invalid. */
export function apiOrigins(apiUrl: string | undefined): string[] {
  const raw = (apiUrl ?? "").trim();
  if (!raw) return [];
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return [];
    return [url.origin, url.origin.replace(/^http/, "ws")];
  } catch {
    return [];
  }
}

/** The page CSP. connect-src is 'self' plus the API origin and its wss
 * origin, generated from VITE_API_URL at build time ('self' only while it
 * is empty). Dev adds ws:/wss: for Vite's hot reload (older Safari doesn't
 * count same-host ws:// as 'self'). */
export function contentSecurityPolicy(opts: { apiUrl: string | undefined; dev: boolean; header: boolean }): string {
  const origins = apiOrigins(opts.apiUrl);
  const connect = ["'self'", ...(opts.dev ? ["ws:", "wss:"] : []), ...origins];
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    // Driver avatars (avatar_url) may be served by the API host.
    `img-src 'self' data:${origins[0] ? ` ${origins[0]}` : ""}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  // frame-ancestors is ignored in a <meta> tag; only the header form has it.
  if (opts.header) directives.push("frame-ancestors 'none'");
  return directives.join("; ") + ";";
}

/** Security headers for Netlify / Cloudflare Pages (dist/_headers). Vercel
 * reads vercel.json from the repo before the build, so there the static
 * vercel.json sends these headers (without connect-src) and the meta CSP
 * below, generated at build time, restricts connect-src. */
export function headersFile(apiUrl: string | undefined): string {
  return [
    "/*",
    `  Content-Security-Policy: ${contentSecurityPolicy({ apiUrl, dev: false, header: true })}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  X-Frame-Options: DENY",
    "",
  ].join("\n");
}

/** Rewrites the CSP <meta> in index.html from VITE_API_URL (dev and build)
 * and emits dist/_headers on build. */
export function izgoSecurity(apiUrl: string | undefined): Plugin {
  let dev = false;
  return {
    name: "izgo-security-headers",
    configResolved(config) {
      dev = config.command === "serve";
    },
    transformIndexHtml(html) {
      const csp = contentSecurityPolicy({ apiUrl, dev, header: false });
      return html.replace(/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/, `$1${csp}$2`);
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: headersFile(apiUrl) });
    },
  };
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
