// `intlTag` defaults to the historical Uzbek-grouping behavior so existing
// call sites keep working; screens that have a locale in scope (useT())
// should pass it through. Chromium's bundled ICU has no uz-Latn/uz-UZ data
// (ru-RU, which uses the same space-grouped digits, does) — see
// NUMBER_LOCALE_MAP and the dictionary fallbacks below.
const NUMBER_LOCALE_MAP: Record<string, string> = {
  "uz-Latn": "ru-RU",
  "ru-RU": "ru-RU",
  "en-US": "en-US",
};

function groupedNumber(value: number, intlTag: string): string {
  return new Intl.NumberFormat(NUMBER_LOCALE_MAP[intlTag] ?? intlTag).format(value);
}

/** Plain grouped number ("1 000") in the current locale's style. */
export function formatNumber(value: number, intlTag = "uz-Latn"): string {
  return groupedNumber(value, intlTag);
}

// Currency label always comes from the adapter as the literal word "so'm"
// (not translated) — Quote.currency is "som" everywhere, uz/ru/en alike.
export function formatSom(value: number, intlTag = "uz-Latn"): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  return `${sign}${groupedNumber(abs, intlTag)}\u00a0so'm`;
}

/** Same grouping as formatSom, split for the Bonus hero's large-integer +
 * small-decimal display. */
export function formatSomParts(value: number, intlTag = "uz-Latn"): { whole: string } {
  return { whole: groupedNumber(Math.abs(Math.round(value)), intlTag) };
}

export function formatKm(value: number, intlTag = "uz-Latn"): string {
  return `${groupedNumber(Math.round(value), intlTag)}\u00a0km`;
}

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const RU_MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];
const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const UZ_WEEKDAYS = ["Du", "Se", "Chor", "Pay", "Ju", "Sha", "Yak"];
const RU_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const EN_WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Month names, Monday-first weekday short names — hand-rolled for uz since
 * Chromium's ICU has no uz-Latn/uz-UZ locale data (see NUMBER_LOCALE_MAP). */
export function monthNames(intlTag: string): string[] {
  if (intlTag === "ru-RU") return RU_MONTHS;
  if (intlTag === "en-US") return EN_MONTHS;
  return UZ_MONTHS;
}

export function weekdayNames(intlTag: string): string[] {
  if (intlTag === "ru-RU") return RU_WEEKDAYS;
  if (intlTag === "en-US") return EN_WEEKDAYS;
  return UZ_WEEKDAYS;
}

function formatLongDate(d: Date, intlTag: string): string {
  if (intlTag === "uz-Latn") return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]}`;
  return d.toLocaleDateString(intlTag, { day: "numeric", month: "long" });
}

const RELATIVE_WORDS: Record<string, { today: string; yesterday: string; daysAgo: (n: number) => string }> = {
  "uz-Latn": { today: "Bugun", yesterday: "Kecha", daysAgo: (n) => `${n} kun oldin` },
  "ru-RU": { today: "Сегодня", yesterday: "Вчера", daysAgo: (n) => `${n} дн. назад` },
  "en-US": { today: "Today", yesterday: "Yesterday", daysAgo: (n) => `${n} days ago` },
};

export function formatRelativeDay(ts: number, intlTag = "uz-Latn"): string {
  const now = new Date();
  const d = new Date(ts);
  const diffDays = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  const words = RELATIVE_WORDS[intlTag] ?? RELATIVE_WORDS["uz-Latn"];
  if (diffDays === 0) return words.today;
  if (diffDays === 1) return words.yesterday;
  if (diffDays < 7) return words.daysAgo(diffDays);
  return formatLongDate(d, intlTag);
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
