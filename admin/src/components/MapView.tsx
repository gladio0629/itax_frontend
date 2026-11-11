import { cn } from "@/lib/cn";

// Stylized, fully static SVG "map" — no real map tiles or external service.
// Used in the Orders detail drawer to show a route at a glance.
const PATH = { p0: [40, 300], p1: [120, 80], p2: [260, 340], p3: [340, 60] };

export function MapView({ className }: { className?: string }) {
  const pathD = `M ${PATH.p0[0]} ${PATH.p0[1]} C ${PATH.p1[0]} ${PATH.p1[1]}, ${PATH.p2[0]} ${PATH.p2[1]}, ${PATH.p3[0]} ${PATH.p3[1]}`;

  return (
    <svg viewBox="0 0 380 380" overflow="visible" className={cn("h-full w-full", className)} role="img" aria-label="Yo'nalish xaritasi">
      <defs>
        <linearGradient id="mapBgAdmin" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#eef1f8" />
          <stop offset="100%" stopColor="#dde4f1" />
        </linearGradient>
      </defs>
      {/* Background and grid run past the viewBox so a wide container is filled, not letterboxed. */}
      <rect x="-760" y="-380" width="1900" height="1140" fill="url(#mapBgAdmin)" />
      {Array.from({ length: 50 }).map((_, i) => (
        <line key={`v${i}`} x1={(i - 20) * 38} y1="-380" x2={(i - 20) * 38} y2="760" stroke="#cdd3e0" strokeWidth="1" opacity="0.6" />
      ))}
      {Array.from({ length: 30 }).map((_, i) => (
        <line key={`h${i}`} x1="-760" y1={(i - 10) * 38} x2="1140" y2={(i - 10) * 38} stroke="#cdd3e0" strokeWidth="1" opacity="0.6" />
      ))}
      <path d={pathD} fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" opacity="0.9" />
      <path d={pathD} fill="none" stroke="#264A9F" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />
      <circle cx={PATH.p0[0]} cy={PATH.p0[1]} r="7" fill="#16264d" />
      <circle cx={PATH.p0[0]} cy={PATH.p0[1]} r="3" fill="#ffffff" />
      <circle cx={PATH.p3[0]} cy={PATH.p3[1]} r="8" fill="#F6BF0E" stroke="#16264d" strokeWidth="2" />
      <circle cx={PATH.p3[0]} cy={PATH.p3[1]} r="3" fill="#16264d" />
    </svg>
  );
}
