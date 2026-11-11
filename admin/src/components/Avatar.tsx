function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

// Brand-derived avatar fills (navy, blue, teal, slate, gold, indigo) — calm, no rainbow.
const PALETTES: [string, string][] = [
  ["#264A9F", "#1B3577"],
  ["#3B6FD4", "#2A55AE"],
  ["#0F766E", "#0B5953"],
  ["#475569", "#334155"],
  ["#B7791F", "#946016"],
  ["#4F46A5", "#3D3684"],
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  seed,
  name,
  size = 36,
  className,
}: {
  seed: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const h = hashSeed(seed);
  const [c1, c2] = PALETTES[h % PALETTES.length];
  const gradId = `grad_${seed.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" className={className} role="img" aria-label={name}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r="22" fill={`url(#${gradId})`} />
      <text
        x="22"
        y="22"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="16"
        fontWeight="600"
        fill="white"
        fontFamily="InterVariable, Inter, system-ui, sans-serif"
      >
        {initials(name)}
      </text>
    </svg>
  );
}
