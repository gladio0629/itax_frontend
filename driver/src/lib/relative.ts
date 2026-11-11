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
