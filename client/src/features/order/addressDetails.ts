import type { AddressDetails } from "@/api/types";
import type { TranslationKey } from "@/lib/i18n/uz";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** The intercom code is never shown in a summary — only in its own input. */
const MASK = "••••";

/**
 * The short line under a filled address, e.g. "2-podyezd, 5-qavat, 18-kv.,
 * domofon •••• · Sariq darvoza". Pure presentation of what the adapter
 * stored; returns "" when nothing is filled in.
 */
export function detailsSummary(details: AddressDetails | undefined, t: T): string {
  if (!details) return "";
  const parts: string[] = [];
  if (details.entrance) parts.push(t("details.short.entrance", { v: details.entrance }));
  if (details.floor) parts.push(t("details.short.floor", { v: details.floor }));
  if (details.apartment) parts.push(t("details.short.apartment", { v: details.apartment }));
  if (details.intercom) parts.push(t("details.short.intercom", { v: MASK }));
  const line = parts.join(", ");
  if (!details.note) return line;
  return line ? `${line} · ${details.note}` : details.note;
}

export function hasDetails(details: AddressDetails | undefined): boolean {
  return !!details && Object.values(details).some((v) => !!v);
}
