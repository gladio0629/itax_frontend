function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

const PALETTES: [string, string][] = [
  ["#0FB67C", "#0A8A5C"],
  ["#2F7FE0", "#1C5AAB"],
  ["#F5A524", "#D9870E"],
  ["#8B5CF6", "#6633D1"],
  ["#E5484D", "#C23337"],
  ["#14B8B0", "#0E8A84"],
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
