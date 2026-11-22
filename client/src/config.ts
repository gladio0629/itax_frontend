import { DEV_EMPTY_URL_WARNING, resolveApiConfig } from "@shared/http/config";

/** true = mock adapter with built-in sample data, no network. Unset or
 * anything else = the real backend, so a production build never ships the
 * sample data by accident. */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export const apiConfig = resolveApiConfig({ apiUrl: import.meta.env.VITE_API_URL, dev: import.meta.env.DEV });

// The one dev-time hint for an empty VITE_API_URL (never in production).
if (import.meta.env.DEV && !DEMO_MODE && apiConfig.viaDevProxy) console.warn(DEV_EMPTY_URL_WARNING);

/** Mapbox public token for the interactive map; "" = the drawn map (set it in
 * .env.local — never in code or in a tracked .env file). */
export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ?? "").trim();

/** Public website (terms, privacy), opened in the system browser. The default
 * is the one host check:no-network allows here; VITE_SITE_URL overrides it
 * and an empty value shows the names without links. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "https://xasanow.uz").trim().replace(/\/+$/, "");
