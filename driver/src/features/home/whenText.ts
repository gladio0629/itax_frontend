import type { TripWhen } from "@/api/types";
import type { TranslationKey } from "@/lib/i18n/provider";
import { formatDate, formatTime } from "@/lib/format";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** "Bugun" / "Ertaga" / "17 noyabr". */
export function dayText(d: { dayOffset: number; dayStart: number }, t: T): string {
  if (d.dayOffset === 0) return t("common.today");
  if (d.dayOffset === 1) return t("common.tomorrow");
  return formatDate(d.dayStart, t);
}

/** "14:30" / "09:00–12:00" / "Istagan paytda". */
export function timeText(w: TripWhen, t: T): string {
  const x = w.time;
  if (x.kind === "exact") return formatTime(x.at);
  if (x.kind === "interval") return `${formatTime(x.from)}–${formatTime(x.to)}`;
  return t("when.any");
}
