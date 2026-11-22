import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_DEV_PROXY_TARGET, izgoBackendProbe, izgoDevProxy, izgoSecurity, mapboxEnabled } from "../shared/vite/izgo";

/** The public website (terms, privacy, account deletion), opened in the
 * system browser, never requested. VITE_SITE_URL overrides it ("" = no links). */
const DEFAULT_SITE_URL = "https://xasanow.uz";

export default defineConfig(({ mode }) => {
  const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));
  // .env files of this app; variables set in the shell or on the host win.
  const env = loadEnv(mode, src("."), "VITE_");
  const demoMode = env.VITE_DEMO_MODE === "true";
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || DEFAULT_DEV_PROXY_TARGET;
  // The interactive map (Mapbox) is built in only when its token is set;
  // without one the drawn map stays and the build has no Mapbox code.
  const mapbox = mapboxEnabled(env.VITE_MAPBOX_TOKEN);

  return {
    define: { __SITE_URL_DEFAULT__: JSON.stringify(DEFAULT_SITE_URL) },
    plugins: [
      react(),
      izgoBackendProbe(proxyTarget),
      // CSP <meta> + dist/_headers: connect-src 'self' plus the API origin
      // (none in demo mode); dev also allows ws:/wss: for hot reload. With
      // the map: plus the Mapbox hosts and blob: workers.
      izgoSecurity(demoMode ? "" : env.VITE_API_URL, { mapbox }),
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
    // mapbox-gl is a large CommonJS bundle: pre-bundle it up front in dev
    // instead of on the first map (which would reload the page).
    optimizeDeps: { include: mapbox ? ["mapbox-gl"] : [] },
    resolve: {
      // ../shared/map imports these packages from outside this folder:
      // resolve them from this app's node_modules (and only one copy of each).
      dedupe: ["react", "react-dom", "mapbox-gl"],
      alias: {
        // The map code a build gets — like @active-adapter, picked at build
        // time: Mapbox with a token, nothing (the drawn map) without.
        "@map-provider": src(mapbox ? "../shared/map/provider.mapbox.ts" : "../shared/map/provider.none.ts"),
        // Picked at build time, so the http build never contains the mock
        // adapter and its sample data (and the demo build has no fetch code).
        "@active-adapter": src(demoMode ? "./src/api/adapters/mock.ts" : "./src/api/adapters/http.ts"),
        "@shared": src("../shared"),
        "@": "/src",
      },
    },
  };
});
