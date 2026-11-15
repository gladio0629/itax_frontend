// The one backend session of the passenger app (http mode only): tokens,
// HTTP client and WebSocket from shared/http. Module scope, so the refresh
// single flight is shared by the whole tab.
import { createApiSession } from "@shared/http/session";
import { apiConfig } from "@/config";
import { uz } from "@/lib/i18n/uz";

/** Server error key → translation key: `errors.<KEY>` when the app has a
 * text for it, the generic message otherwise. Screens translate it. */
export function errorMessageKey(key: string): string {
  const k = `errors.${key}`;
  return k in uz ? k : "errors.generic";
}

export const session = createApiSession({
  app: "client",
  baseUrl: apiConfig.baseUrl,
  errorMessage: errorMessageKey,
});
