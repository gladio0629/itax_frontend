import type { OrderTiming, SchedulingRules } from "@/api/types";

/**
 * Pure helpers that keep the "Siz istagan" picker inside the booking window
 * the adapter publishes (SchedulingRules). Nothing here invents a rule — every
 * limit comes in through `rules`; the adapter re-validates on submit.
 */

export type ScheduledTiming = Extract<OrderTiming, { timeMode: "scheduled" }>;

const DAY_MS = 86_400_000;

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseDay(iso: string) {
  return new Date(`${iso}T00:00:00`);
}
export function addDays(iso: string, n: number): string {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}
export function dayDiff(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);
}
/** Legacy "today"/"tomorrow" → ISO, relative to `now`. */
export function resolveDay(date: string, now: Date): string {
  const today = isoDay(now);
  if (date === "today") return today;
  if (date === "tomorrow") return addDays(today, 1);
  return date;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Every bookable day, today first. */
export function bookableDays(rules: SchedulingRules, now: Date): string[] {
  const today = isoDay(now);
  return Array.from({ length: rules.bookableDays }, (_, i) => addDays(today, i));
}
/** 00:00 … 23:55 in `stepMinutes` steps. */
export function timeSlots(rules: SchedulingRules): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += rules.stepMinutes) out.push(toHHMM(m));
  return out;
}
const LAST_SLOT = (rules: SchedulingRules) => 24 * 60 - rules.stepMinutes;
/** First slot still ahead of `now` today (may be past 23:55 = none left). */
export function earliestToday(rules: SchedulingRules, now: Date): number {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return Math.floor(nowMin / rules.stepMinutes) * rules.stepMinutes + rules.stepMinutes;
}
/** Latest "dan" that still leaves room for "gacha" the same day. */
export function latestFrom(rules: SchedulingRules): number {
  return LAST_SLOT(rules) - rules.minRangeMinutes;
}

/** What "Siz istagan" starts as: the next free slot, today if any is left. */
export function defaultScheduled(rules: SchedulingRules, now: Date): ScheduledTiming {
  const today = isoDay(now);
  const earliest = earliestToday(rules, now);
  const fits = earliest <= LAST_SLOT(rules);
  const time = fits ? earliest : 9 * 60;
  return { timeMode: "scheduled", date: fits ? today : addDays(today, 1), timeKind: "exact", time: toHHMM(time) };
}

export type Normalized = { timing: ScheduledTiming; jumpedToTomorrow: boolean };

/**
 * Pull a scheduled timing back inside the rules:
 * - dates inside the bookable window, end after start, span ≤ maxRangeDays;
 * - "dan" no later than latestFrom, "gacha" ≥ "dan" + minRangeMinutes
 *   (e.g. dan 19:00 / gacha 18:00 → gacha 19:30);
 * - a time already past today moves the date(s) one day forward and keeps
 *   the time (18:00 now, pick 16:00 → tomorrow 16:00).
 */
export function normalizeTiming(input: ScheduledTiming, rules: SchedulingRules, now: Date): Normalized {
  const days = bookableDays(rules, now);
  const first = days[0];
  const last = days[days.length - 1];
  const clampDay = (d: string) => (d < first ? first : d > last ? last : d);

  let date = clampDay(resolveDay(input.date, now));
  let dateEnd = input.dateEnd ? clampDay(resolveDay(input.dateEnd, now)) : undefined;
  if (dateEnd && dateEnd <= date) dateEnd = undefined;
  if (dateEnd && dayDiff(date, dateEnd) > rules.maxRangeDays) dateEnd = addDays(date, rules.maxRangeDays);

  let time: string | undefined;
  let timeRange: { from: string; to: string } | undefined;
  let startMin: number;
  if (input.timeKind === "range") {
    const fromIn = input.timeRange?.from ?? input.time ?? toHHMM(earliestToday(rules, now));
    const from = Math.min(toMinutes(fromIn), latestFrom(rules));
    let to = toMinutes(input.timeRange?.to ?? toHHMM(from + rules.minRangeMinutes));
    if (to - from < rules.minRangeMinutes) to = from + rules.minRangeMinutes;
    timeRange = { from: toHHMM(from), to: toHHMM(Math.min(to, LAST_SLOT(rules))) };
    startMin = from;
  } else {
    const t = input.time ?? input.timeRange?.from ?? toHHMM(earliestToday(rules, now));
    time = t;
    startMin = toMinutes(t);
  }

  let jumpedToTomorrow = false;
  if (date === first && startMin < earliestToday(rules, now)) {
    jumpedToTomorrow = true;
    const span = dateEnd ? dayDiff(date, dateEnd) : 0;
    date = addDays(date, 1);
    if (dateEnd) dateEnd = clampDay(addDays(date, span));
    if (dateEnd === date) dateEnd = undefined;
  }

  return {
    timing: { timeMode: "scheduled", date, dateEnd, timeKind: input.timeKind, time, timeRange },
    jumpedToTomorrow,
  };
}
