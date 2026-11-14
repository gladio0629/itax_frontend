import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

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

export default defineConfig({
  plugins: [react(), devHmrCsp()],
  // host: true — reachable from other devices on the local network (an
  // iPhone on the same Wi-Fi opens http://<this computer's LAN IP>:5173).
  server: { port: 5173, host: true },
  preview: { port: 5173, host: true },
  resolve: {
    alias: { "@": "/src" },
  },
});
