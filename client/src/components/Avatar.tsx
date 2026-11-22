function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

// Non-brand hues only — blue/yellow/orange/red are reserved for
// accent/brand-yellow/warning/danger, so avatar initials never get mistaken
// for an interactive or status color. Each pair keeps both stops dark
// enough for AA contrast (>=4.5:1) against the white initials.
const PALETTES: [string, string][] = [
  ["#64748B", "#43506B"], // slate
  ["#0E7490", "#155E75"], // cyan
  ["#A21CAF", "#7C1D82"], // plum
  ["#7C3AED", "#5B21B6"], // violet
  ["#78716C", "#57534E"], // stone
  ["#0F766E", "#115E59"], // teal
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
  size = 44,
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      className={className}
      role="img"
      aria-label={name}
    >
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
        fontFamily="'Plus Jakarta Sans Variable', 'Manrope Variable', system-ui, sans-serif"
      >
        {initials(name)}
      </text>
    </svg>
  );
}
