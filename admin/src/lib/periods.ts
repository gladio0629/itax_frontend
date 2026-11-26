/** Preset date filters for lists whose API takes from/to days
 * (operator history, audit). A filter choice, not a business rule. */
export type DayPreset = "all" | "today" | "yesterday" | "7d" | "30d";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function dayPresetRange(p: DayPreset): { dateFrom?: string; dateTo?: string } {
  if (p === "all") return {};
  const day = (back: number) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return iso(d);
  };
  if (p === "today") return { dateFrom: day(0), dateTo: day(0) };
  if (p === "yesterday") return { dateFrom: day(1), dateTo: day(1) };
  return { dateFrom: day(p === "7d" ? 6 : 29), dateTo: day(0) };
}
