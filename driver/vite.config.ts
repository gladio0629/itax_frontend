import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_DEV_PROXY_TARGET, izgoBackendProbe, izgoDevProxy, izgoSecurity } from "../shared/vite/izgo";

export default defineConfig(({ mode }) => {
  const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));
  // .env files of this app; variables set in the shell or on the host win.
  const env = loadEnv(mode, src("."), "VITE_");
  const demoMode = env.VITE_DEMO_MODE === "true";
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || DEFAULT_DEV_PROXY_TARGET;

  return {
    plugins: [
      react(),
      izgoBackendProbe(proxyTarget),
      // CSP <meta> + dist/_headers: connect-src 'self' plus the API origin
      // (none in demo mode); dev also allows ws:/wss: for hot reload.
      izgoSecurity(demoMode ? "" : env.VITE_API_URL),
    ],
    server: {
      port: 5174,
      proxy: izgoDevProxy(proxyTarget),
      // ../shared holds the HTTP layer used by all three apps.
      fs: { allow: [src("."), src("../shared")] },
    },
    preview: { port: 5174 },
    // No modulepreload polyfill: it is a fetch() in the bundle, and the demo
    // build must contain none. Browsers without modulepreload just skip it.
    build: { modulePreload: { polyfill: false } },
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
