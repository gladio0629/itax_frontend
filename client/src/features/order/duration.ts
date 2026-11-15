import type { TranslationKey } from "@/lib/i18n/uz";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** "4 soat 51 daq" / "11 daq" — presentation of an adapter-given duration. */
export function formatDuration(minutes: number, t: T): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? t("duration.hm", { h, m }) : t("duration.m", { m });
}
