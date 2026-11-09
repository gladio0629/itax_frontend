export function formatSom(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  return `${sign}${abs.toLocaleString("fr-FR").replace(/,/g, " ")} so'm`;
}

export function formatKm(value: number): string {
  return `${Math.round(value).toLocaleString("fr-FR").replace(/,/g, " ")} km`;
}

export function formatRelativeDay(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const diffDays = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diffDays === 0) return "Bugun";
  if (diffDays === 1) return "Kecha";
  if (diffDays < 7) return `${diffDays} kun oldin`;
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)}, ${formatTime(ts)}`;
}
