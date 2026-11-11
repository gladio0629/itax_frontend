import { isKey, type TranslationKey } from "./i18n/provider";

/** Turns an adapter error code into a translated, actionable message. */
export function errorMessage(err: unknown, t: (k: TranslationKey) => string): string {
  const code = (err as { code?: string } | null)?.code;
  const key = code ? `error.${code}` : "";
  return isKey(key) ? t(key) : t("error.generic");
}
