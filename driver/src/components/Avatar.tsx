function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}
// Decorative fills kept off brand-brand / status colors; white initials ≥4.5:1.
const FILLS = ["#3B5BA9", "#5B4BB7", "#0A756E", "#7A4A12", "#475569", "#8A2F5B"];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Initials avatar, or a neutral silhouette when `silhouette` is set. */
export function Avatar({ seed, name, size = 44, silhouette }: { seed: string; name: string; size?: number; silhouette?: boolean }) {
  const fill = FILLS[hash(seed) % FILLS.length];
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" role="img" aria-label={name} className="shrink-0">
      {silhouette ? (
        <>
          <circle cx="22" cy="22" r="22" className="fill-raised" />
          <circle cx="22" cy="17" r="7.5" className="fill-ink/30" />
          <path d="M8.5 37c2.6-6.4 7.6-9.6 13.5-9.6S32.9 30.6 35.5 37a21.9 21.9 0 0 1-27 0Z" className="fill-ink/30" />
        </>
      ) : (
        <>
          <circle cx="22" cy="22" r="22" fill={fill} />
          <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="700" fill="#fff">
            {initials(name)}
          </text>
        </>
      )}
    </svg>
  );
}
