import { memo } from "react";

// Stylised night-city map: inline SVG only (no tiles, no requests). Colours
// come from --map-* tokens so the same geometry works in both themes.
// Used as a small header strip above the request feed; the driver sits at (50%, 46%); everything is decorative (aria-hidden) —
// the screen reader gets a single label from the parent.

const W = 400;
const H = 800;

// Irregular block grid between roads.
const COLS = [0, 62, 118, 190, 246, 318, 400];
const ROWS = [0, 70, 150, 214, 300, 368, 452, 520, 610, 680, 800];
const MAJOR_V = [190];
const MAJOR_H = [368];

function blocks() {
  const out: { x: number; y: number; w: number; h: number; park?: boolean }[] = [];
  for (let c = 0; c < COLS.length - 1; c++) {
    for (let r = 0; r < ROWS.length - 1; r++) {
      const gap = MAJOR_V.includes(COLS[c + 1]) || MAJOR_V.includes(COLS[c]) ? 9 : 6;
      const gapY = MAJOR_H.includes(ROWS[r + 1]) || MAJOR_H.includes(ROWS[r]) ? 9 : 6;
      out.push({
        x: COLS[c] + gap,
        y: ROWS[r] + gapY,
        w: COLS[c + 1] - COLS[c] - gap * 2,
        h: ROWS[r + 1] - ROWS[r] - gapY * 2,
        park: (c === 4 && r === 2) || (c === 1 && r === 7),
      });
    }
  }
  return out;
}
const BLOCKS = blocks();

// A few waiting passengers around the driver (percent coords).
const PASSENGERS = [
  { x: 30, y: 30 },
  { x: 72, y: 36 },
  { x: 22, y: 62 },
  { x: 66, y: 68 },
  { x: 82, y: 22 },
];

export const DriverMap = memo(function DriverMap({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="map-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" fill="none" stroke="var(--map-road)" strokeWidth="0.5" opacity="0.35" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="var(--map-ground)" />
        <rect width={W} height={H} fill="url(#map-grid)" />
        {BLOCKS.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="4"
            fill={b.park ? "var(--map-road)" : "var(--map-block)"}
            opacity={b.park ? 0.55 : 1}
          />
        ))}
        {/* Major avenues + a diagonal highway */}
        <line x1="190" y1="0" x2="190" y2={H} stroke="var(--map-major)" strokeWidth="10" />
        <line x1="0" y1="368" x2={W} y2="368" stroke="var(--map-major)" strokeWidth="10" />
        <path d="M-20 760 L420 120" stroke="var(--map-major)" strokeWidth="14" fill="none" />
        <path d="M-20 760 L420 120" stroke="var(--map-ground)" strokeWidth="1.5" strokeDasharray="10 12" fill="none" opacity="0.7" />
        {/* River */}
        <path d="M-10 560 C 90 520, 150 640, 260 600 S 380 540, 420 580" stroke="var(--map-road)" strokeWidth="18" fill="none" opacity="0.6" />
      </svg>

      {/* Waiting passengers: small and quiet. */}
      {PASSENGERS.map((p, i) => (
        <span key={i} aria-hidden="true" className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <span className="absolute inset-0 rounded-full bg-brand-ink/30" />
          <span className="absolute inset-[3px] rounded-full bg-brand-ink" />
        </span>
      ))}

      {/* Driver: a static marker — no status, no radar. */}
      <span aria-hidden="true" className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-2" style={{ left: "50%", top: "46%" }}>
        <span className="absolute inset-[5px] rounded-full bg-brand" />
      </span>
    </div>
  );
});
