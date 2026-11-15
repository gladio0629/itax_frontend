import { DEV_EMPTY_URL_WARNING, resolveApiConfig } from "@shared/http/config";

/** true = mock adapter with built-in sample data, no network. Unset or
 * anything else = the real backend, so a production build never ships the
 * sample data by accident. */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export const apiConfig = resolveApiConfig({ apiUrl: import.meta.env.VITE_API_URL, dev: import.meta.env.DEV });

// The one dev-time hint for an empty VITE_API_URL (never in production).
// import.meta.env.DEV first, so production builds drop the message string.
if (import.meta.env.DEV && !DEMO_MODE && apiConfig.viaDevProxy) console.warn(DEV_EMPTY_URL_WARNING);
