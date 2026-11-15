import type { TranslationKey } from "./i18n/uz";
import { dayDiff, formatDate, formatTime } from "./format";

type T = (k: TranslationKey, p?: Record<string, string | number>) => string;

/** "Bugun, 14:20" / "Kecha, 09:10" / "3 kun oldin" / "12 noyabr". */
export function relativeTime(ts: number, t: T): string {
  const d = dayDiff(ts);
  if (d <= 0) return `${t("common.today")}, ${formatTime(ts)}`;
  if (d === 1) return `${t("common.yesterday")}, ${formatTime(ts)}`;
  if (d < 7) return t("common.daysAgo", { n: d });
  return formatDate(ts, t);
}

export function dayLabel(ts: number, t: T): string {
  const d = dayDiff(ts);
  if (d <= 0) return t("common.today");
  if (d === 1) return t("common.yesterday");
  return formatDate(ts, t);
}

/** "hozirgina" / "5 daq oldin" / "2 soat oldin" / "3 kun oldin" — for "time since posted". */
export function sinceTime(ts: number, t: T, now = Date.now()): string {
  const min = Math.floor((now - ts) / 60_000);
  if (min < 1) return t("common.justNow");
  if (min < 60) return t("common.minAgo", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("common.hoursAgo", { n: h });
  return t("common.daysAgo", { n: Math.floor(h / 24) });
}
