import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_DEV_PROXY_TARGET, izgoBackendProbe, izgoDevProxy } from "../shared/vite/izgo";

/**
 * Dev server only: let Vite's hot-reload WebSocket through the page CSP
 * (`connect-src 'self'`). Some Safari versions don't count ws:// as 'self',
 * which would break live reload when the app is opened from an iPhone on the
 * LAN. The production build keeps the strict CSP untouched.
 */
function devHmrCsp(): Plugin {
  return {
    name: "izgo-dev-hmr-csp",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace("connect-src 'self'", "connect-src 'self' ws: wss:");
    },
  };
}

export default defineConfig(({ mode }) => {
  const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));
  // .env files of this app; variables set in the shell or on the host win.
  const env = loadEnv(mode, src("."), "VITE_");
  const demoMode = env.VITE_DEMO_MODE === "true";
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || DEFAULT_DEV_PROXY_TARGET;

  return {
    plugins: [react(), izgoBackendProbe(proxyTarget), devHmrCsp()],
    // host: true — reachable from other devices on the local network (an
    // iPhone on the same Wi-Fi opens http://<this computer's LAN IP>:5173).
    server: {
      port: 5173, host: true,
      proxy: izgoDevProxy(proxyTarget),
      // ../shared holds the HTTP layer used by all three apps.
      fs: { allow: [src("."), src("../shared")] },
    },
    preview: { port: 5173, host: true },
    resolve: {
      alias: {
        // Picked at build time, so the http build never contains the mock
        // adapter and its sample data (and the demo build has no fetch code).
        "@active-adapter": src(demoMode ? "./src/api/adapters/mock.ts" : "./src/api/adapters/http.ts"),
        "@shared": src("../shared"),
        "@": "/src",
      },
    },
  };
});
