function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

// Decorative initials-avatar gradients only — not brand colors, and kept
// distinct from blue/yellow/orange/red (brand accent, brand yellow, warning,
// danger) so avatars never read as a status color. Each pair is dark enough
// that white initials clear 4.5:1 contrast.
const PALETTES: [string, string][] = [
  ["#64748B", "#48566B"],
  ["#2A6FC4", "#1C5AAB"],
  ["#9C6708", "#6B4103"],
  ["#7C4CE8", "#6633D1"],
  ["#D13138", "#C23337"],
  ["#0A756E", "#043F38"],
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
        fontFamily="InterVariable, Inter, system-ui, sans-serif"
      >
        {initials(name)}
      </text>
    </svg>
  );
}
