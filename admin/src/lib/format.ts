export function formatSom(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  return `${sign}${abs.toLocaleString("fr-FR").replace(/,/g, " ")} so'm`;
}

/** "1 284" — digit groups with a no-break space; "−" for negatives (v2 tables). */
export function formatNumber(value: number): string {
  const abs = Math.abs(Math.round(value));
  const grouped = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return value < 0 ? `\u2212${grouped}` : grouped;
}

/** Full phone for display: "+998901234567" or "998 90 123 45 67" →
 * "+998 90 123 45 67". Admin shows numbers in full (decision 2026-11-22). */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  const m = /^998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(d);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

export function formatKm(value: number): string {
  return `${Math.round(value).toLocaleString("fr-FR").replace(/,/g, " ")} km`;
}

// Browsers ship no Uzbek month data (Chromium renders "M11"), so names are spelled out here.
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "7-noy" — compact day label for chart axes. */
export function formatDayShort(ts: number | Date): string {
  const d = new Date(ts);
  return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatRelativeDay(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const diffDays = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diffDays === 0) return "Bugun";
  if (diffDays === 1) return "Kecha";
  if (diffDays < 7) return `${diffDays} kun oldin`;
  return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}, ${d.getFullYear()}`;
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)}, ${formatTime(ts)}`;
}
