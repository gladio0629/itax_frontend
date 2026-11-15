// Backend connection settings shared by the client, driver and admin apps.
// Framework-free on purpose: this folder sits outside every app's
// node_modules, so it may not import React, zustand or any package.
// Imports inside shared/ carry the .ts extension so `node --test` can run
// the unit tests without a build step.

export type AppId = "client" | "driver" | "admin";

export type ApiConfig = {
  /** Backend origin (plus an optional path prefix), no trailing slash.
   * "" means same origin: relative paths through the Vite dev proxy. */
  baseUrl: string;
  /** False when there is nowhere to send requests: a production build
   * without VITE_API_URL. The app shows the full-screen "no server" state. */
  configured: boolean;
  /** Dev server with an empty VITE_API_URL: calls go through the proxy, and
   * the app first asks the dev server whether the proxy target answers. */
  viaDevProxy: boolean;
};

/** Normalizes VITE_API_URL. Anything that isn't an absolute http(s) URL
 * counts as empty, so a typo shows the "no server" state instead of
 * sending requests to a broken address. */
export function normalizeApiUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function resolveApiConfig(input: { apiUrl: string | undefined; dev: boolean }): ApiConfig {
  const baseUrl = normalizeApiUrl(input.apiUrl);
  if (baseUrl) return { baseUrl, configured: true, viaDevProxy: false };
  if (input.dev) return { baseUrl: "", configured: true, viaDevProxy: true };
  return { baseUrl: "", configured: false, viaDevProxy: false };
}

/** WebSocket URL for `path` (https → wss, http → ws). With a relative base
 * it uses the page's own host, which in dev is the Vite proxy. Never log the
 * result once a token is appended. */
export function websocketUrl(baseUrl: string, path: string, pageLocation?: { protocol: string; host: string }): string {
  if (baseUrl) return baseUrl.replace(/^http/, "ws") + path;
  const loc = pageLocation ?? (typeof location !== "undefined" ? location : { protocol: "http:", host: "localhost" });
  return `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}${path}`;
}

/** Dev-only endpoint served by the Vite dev server (shared/vite/izgo.ts). It
 * always answers 200 with { reachable }, so a stopped backend never prints a
 * red network error in the browser console. */
export const DEV_BACKEND_PROBE_PATH = "/__izgo/backend";

/** The single dev warning for an empty VITE_API_URL. */
export const DEV_EMPTY_URL_WARNING =
  "[IZGO] VITE_API_URL is empty, so API calls go through the Vite dev proxy to " +
  "VITE_DEV_PROXY_TARGET (default http://localhost:8000). Start the backend there, " +
  "or set VITE_API_URL in .env.local (e.g. https://api.example.com). " +
  "Set VITE_DEMO_MODE=true to use the built-in sample data instead.";
