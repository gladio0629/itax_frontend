import type { OrderTiming } from "@/api/types";
import type { TranslationKey } from "@/lib/i18n/uz";

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Short human summary of a scheduled timing, e.g. "Bugun, 14:30" or
 * "Ertaga, 09:00–12:00" — used in the compact Panel 2 time row and the
 * Panel 3 summary card. */
export function timingSummary(timing: OrderTiming, t: Translate): string {
  if (timing.timeMode === "now") return t("order.now");
  const dateLabel =
    timing.date === "today" ? t("order.today") : timing.date === "tomorrow" ? t("order.tomorrow") : timing.date;
  const timeLabel =
    timing.timeKind === "exact" ? timing.time ?? "" : `${timing.timeRange?.from ?? ""}–${timing.timeRange?.to ?? ""}`;
  return `${dateLabel}, ${timeLabel}`;
}
