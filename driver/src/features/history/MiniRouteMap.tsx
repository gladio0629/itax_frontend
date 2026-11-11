import type { Place } from "@/api/types";

/** Decorative route preview: two pins joined by a curved yellow line. */
export function MiniRouteMap({ pickup, dropoff, label }: { pickup: Place; dropoff: Place; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative h-36 overflow-hidden rounded-card bg-[var(--map-ground)]">
      <svg viewBox="0 0 340 144" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((c) =>
          [0, 1, 2].map((r) => <rect key={`${c}-${r}`} x={6 + c * 50} y={6 + r * 48} width={42} height={40} rx={4} fill="var(--map-block)" />)
        )}
        <path d="M44 106 C 120 120, 150 30, 296 40" stroke="var(--map-major)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M44 106 C 120 120, 150 30, 296 40" stroke="var(--color-yellow)" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="44" cy="106" r="9" fill="var(--color-yellow)" stroke="var(--color-surface)" strokeWidth="3" />
        <circle cx="296" cy="40" r="9" fill="rgb(var(--color-text-rgb))" stroke="var(--color-surface)" strokeWidth="3" />
      </svg>
      <span className="absolute bottom-3 left-3 rounded-button bg-surface/90 px-2.5 py-1 text-xs font-medium text-ink shadow-1">{pickup.city.name}</span>
      <span className="absolute right-3 top-3 rounded-button bg-surface/90 px-2.5 py-1 text-xs font-medium text-ink shadow-1">{dropoff.city.name}</span>
    </div>
  );
}
