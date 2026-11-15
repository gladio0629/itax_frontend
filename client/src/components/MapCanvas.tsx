import type { ReactNode } from "react";

// IZGO's own stylized map (no tiles, no requests): neutral blocks and white
// roads like the reference's light map. With `route`, a thick route line
// between the pickup ring and the destination flag square, and slots for
// the bubbles that sit on its ends.
const BLOCKS = [
  [4, 6, 20, 13], [28, 4, 16, 10], [48, 8, 22, 15], [74, 5, 20, 12],
  [6, 25, 15, 13], [26, 22, 18, 12], [50, 28, 16, 13], [72, 22, 22, 15],
  [4, 44, 21, 14], [30, 40, 14, 12], [50, 46, 18, 15], [74, 43, 20, 12],
  [8, 64, 18, 13], [32, 60, 16, 14], [54, 66, 20, 12], [78, 61, 16, 15],
  [4, 82, 22, 12], [30, 80, 18, 14], [52, 83, 20, 11], [76, 80, 18, 14],
];
const ROADS_H = [19, 38, 58, 77];
const ROADS_V = [25, 47, 71];

/** Route geometry in the 0–100 viewBox. */
export const ROUTE = { from: [28, 62] as const, to: [70, 26] as const };
const routePath = `M ${ROUTE.from[0]} ${ROUTE.from[1]} L 47 62 L 47 38 L 71 38 L ${ROUTE.to[0]} ${ROUTE.to[1]}`;

export function MapCanvas({ route, children, className }: { route?: boolean; children?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect width="100" height="100" fill="var(--map-bg)" />
        {BLOCKS.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="1.6" fill="var(--map-block)" />
        ))}
        {ROADS_H.map((y) => (
          <line key={`h${y}`} x1="0" y1={y + 0.5} x2="100" y2={y + 0.5} stroke="var(--map-road)" strokeWidth="1.6" />
        ))}
        {ROADS_V.map((x) => (
          <line key={`v${x}`} x1={x + 0.5} y1="0" x2={x + 0.5} y2="100" stroke="var(--map-road)" strokeWidth="1.6" />
        ))}
        {route && (
          <>
            <path d={routePath} fill="none" stroke="var(--map-road)" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
            <path d={routePath} fill="none" stroke="var(--map-route)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={ROUTE.from[0]} cy={ROUTE.from[1]} r="1.9" fill="var(--map-road)" stroke="rgb(var(--color-text-rgb))" strokeWidth="0.9" />
            <rect x={ROUTE.to[0] - 2} y={ROUTE.to[1] - 2} width="4" height="4" rx="1" fill="var(--color-brand-yellow)" stroke="var(--color-on-yellow)" strokeWidth="0.7" />
          </>
        )}
      </svg>
      {children}
    </div>
  );
}
