import { Car, Navigation } from "@/lib/icons";

// Full-screen stylized SVG "map" for the home screen background — city
// blocks + roads in brand-soft colors, a pulsing user dot, a couple of
// slowly drifting car markers, and a fixed pickup pin with an ETA bubble.
// Entirely inline SVG/CSS, no tiles, no external requests.
const BLOCKS = [
  { x: 6, y: 10, w: 18, h: 14 },
  { x: 30, y: 6, w: 14, h: 10 },
  { x: 50, y: 14, w: 20, h: 16 },
  { x: 76, y: 8, w: 16, h: 12 },
  { x: 8, y: 32, w: 16, h: 12 },
  { x: 30, y: 30, w: 12, h: 10 },
  { x: 48, y: 36, w: 18, h: 14 },
  { x: 72, y: 30, w: 20, h: 12 },
  { x: 10, y: 54, w: 20, h: 14 },
  { x: 36, y: 58, w: 14, h: 10 },
  { x: 58, y: 54, w: 16, h: 14 },
  { x: 80, y: 56, w: 14, h: 12 },
  { x: 14, y: 76, w: 18, h: 12 },
  { x: 40, y: 78, w: 16, h: 10 },
  { x: 64, y: 76, w: 18, h: 12 },
];

const ROADS_H = [20, 44, 68];
const ROADS_V = [24, 46, 70];

export function FakeMap({
  pickupLabel,
  etaMinutes,
  className,
}: {
  pickupLabel?: string;
  etaMinutes?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <rect width="100" height="100" className="fill-accent/[0.06]" />
        {ROADS_H.map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} className="stroke-accent/15" strokeWidth="1.2" />
        ))}
        {ROADS_V.map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" className="stroke-accent/15" strokeWidth="1.2" />
        ))}
        {BLOCKS.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="2"
            className="fill-accent/[0.08]"
          />
        ))}

        {/* user dot */}
        <g transform="translate(35,52)">
          <circle r="6" className="fill-accent/25 animate-pulse-ring" />
          <circle r="3" className="fill-accent" />
        </g>

        {/* pickup pin */}
        <g transform="translate(62,34)" className="animate-bob-y">
          <circle r="4.2" className="fill-on-yellow" />
          <circle r="3" className="fill-brand-yellow" />
        </g>
      </svg>

      {/* drifting car markers, CSS transform-only */}
      <div className="pointer-events-none absolute left-[20%] top-[22%] animate-drift-a">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow-softer">
          <Car className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="pointer-events-none absolute left-[70%] top-[64%] animate-drift-b">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow-softer">
          <Car className="h-3.5 w-3.5" />
        </div>
      </div>

      {pickupLabel && (
        <div
          className="pointer-events-none absolute left-1/2 max-w-[56%] -translate-x-1/2 rounded-full bg-card/90 px-3 py-1.5 text-center shadow-softer backdrop-blur-sm"
          style={{ top: "calc(var(--safe-top) + 84px)" }}
        >
          <p className="truncate text-xs font-normal text-ink/70">{pickupLabel}</p>
        </div>
      )}

      {typeof etaMinutes === "number" && (
        <div
          className="pointer-events-none absolute flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-ink shadow-softer"
          style={{ left: "62%", top: "28%", transform: "translate(-50%,-130%)" }}
        >
          <Navigation className="h-3 w-3 text-accent" />
          <span className="tabular">{etaMinutes}</span> daqiqa
        </div>
      )}
    </div>
  );
}
