// Display formatting only — no business rules. Every amount arrives from the
// adapter already computed; these helpers just print it.
import type { TranslationKey } from "./i18n/uz";

const NBSP = " ";
type T = (k: TranslationKey, p?: Record<string, string | number>) => string;

export function groupDigits(value: number): string {
  return Math.abs(Math.round(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** "125 000" with a real minus sign for negatives. */
export function formatAmount(value: number, opts?: { signed?: boolean }): string {
  const sign = value < 0 ? "−" : opts?.signed && value > 0 ? "+" : "";
  return `${sign}${groupDigits(value)}`;
}

/** Short form for chips: 10K, 25K, 1.2M */
export function formatShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

/** 24h clock, independent of ICU locale data. */
export function formatTime(ts: number, _intlTag?: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "11 noyabr" — month names come from our dictionaries, not ICU (which may lack uz). */
export function formatDate(ts: number, t: T): string {
  const d = new Date(ts);
  return `${d.getDate()} ${t(`month.${d.getMonth() + 1}` as TranslationKey)}`;
}

export function formatDuration(min: number, t: T): string {
  if (min < 60) return `${min} ${t("common.min")}`;
  return t("common.durationHm", { h: Math.floor(min / 60), m: min % 60 });
}

export function dayDiff(ts: number, now = Date.now()): number {
  const a = new Date(now);
  a.setHours(0, 0, 0, 0);
  const b = new Date(ts);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
