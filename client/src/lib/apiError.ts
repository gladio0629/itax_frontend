// Adapter errors whose message is a translation key describing a rule the
// user can fix (wrong city, too many stops, unavailable class…). Anything
// else — a dropped connection, older errors carrying plain text — is shown
// as a generic failure with a retry.
const RULE_CODES = new Set([
  "INVALID_ROUTE",
  "TOO_MANY_STOPS",
  "TOO_MANY_DROPOFFS",
  "CLASS_UNAVAILABLE",
  "OPTION_UNAVAILABLE",
  "PROMO_INVALID",
  "CARGO_CITY_ONLY",
  "CARGO_INTERCITY_ONLY",
  "CARGO_WAREHOUSE_ONLY",
  "CARGO_MODE",
  "CARGO_HOURS",
  "CARGO_LOADERS",
  "CARGO_RIDE_ALONG",
]);

/** The translation key for a server error (api/openapi.yml keys mapped by
 * the http adapter to `errors.<KEY>`, unknown keys to errors.generic), or
 * null for anything else (sample-data errors keep their own texts). */
export function serverErrorKey(err: unknown): string | null {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" && m.startsWith("errors.") ? m : null;
}

/** The translation key to show for a rule error, or null for "retry". */
export function ruleErrorKey(err: unknown): string | null {
  const e = err as { code?: string; message?: string } | null;
  return e?.code && RULE_CODES.has(e.code) && e.message ? e.message : null;
}
