import type { OrderTiming } from "@/api/types";
import type { TranslationKey } from "@/lib/i18n/uz";
import { monthNames, weekdayNames } from "@/lib/format";
import { addDays, isoDay, resolveDay } from "./scheduling";

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** "12 noy" / "12 ноя" / "12 Nov" — day number + short month. */
export function shortDate(iso: string, intlTag: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${monthNames(intlTag)[d.getMonth()].slice(0, 3)}`;
}
/** Short weekday, Monday-first table. */
export function weekdayShort(iso: string, intlTag: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return weekdayNames(intlTag)[(d.getDay() + 6) % 7];
}
/** "Bugun" / "Ertaga" / "12 noy". */
export function dayLabel(iso: string, t: Translate, intlTag: string, now = new Date()): string {
  const today = isoDay(now);
  if (iso === today) return t("order.today");
  if (iso === addDays(today, 1)) return t("order.tomorrow");
  return shortDate(iso, intlTag);
}

/** Short human summary of a timing, e.g. "Bugun, 14:30",
 * "Ertaga – 15 noy, 09:00–12:00" — used in the Panel 3 summary card. */
export function timingSummary(timing: OrderTiming, t: Translate, intlTag: string): string {
  if (timing.timeMode === "now") return t("when.driver");
  const now = new Date();
  const start = dayLabel(resolveDay(timing.date, now), t, intlTag, now);
  const dates = timing.dateEnd ? `${start} – ${dayLabel(resolveDay(timing.dateEnd, now), t, intlTag, now)}` : start;
  const time =
    timing.timeKind === "exact" ? timing.time ?? "" : `${timing.timeRange?.from ?? ""}–${timing.timeRange?.to ?? ""}`;
  return `${dates}, ${time}`;
}
