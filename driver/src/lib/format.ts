// Display formatting only — no business rules. Every amount arrives from the
// adapter already computed; these helpers just print it.

const NBSP = " ";

export function groupDigits(value: number): string {
  const abs = Math.abs(Math.round(value));
  return abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** "125 000" with a real minus sign for negatives. */
export function formatAmount(value: number, opts?: { signed?: boolean }): string {
  const sign = value < 0 ? "−" : opts?.signed && value > 0 ? "+" : "";
  return `${sign}${groupDigits(value)}`;
}

export function formatSom(value: number, currency: string, opts?: { signed?: boolean }): string {
  return `${formatAmount(value, opts)}${NBSP}${currency}`;
}

/** Short form for chips: 10K, 25K, 1.2M */
export function formatShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

export function formatTime(ts: number, intlTag: string): string {
  return new Date(ts).toLocaleTimeString(intlTag, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDate(ts: number, intlTag: string): string {
  return new Date(ts).toLocaleDateString(intlTag, { day: "numeric", month: "long" });
}

export function dayDiff(ts: number, now = Date.now()): number {
  const a = new Date(now);
  a.setHours(0, 0, 0, 0);
  const b = new Date(ts);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function formatRating(r: number): string {
  return r.toFixed(1);
}
