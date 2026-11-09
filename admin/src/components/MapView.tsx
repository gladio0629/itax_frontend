import { cn } from "@/lib/cn";

// Stylized, fully static SVG "map" — no real map tiles or external service.
// Used in the Orders detail drawer to show a route at a glance.
const PATH = { p0: [40, 300], p1: [120, 80], p2: [260, 340], p3: [340, 60] };

export function MapView({ className }: { className?: string }) {
  const pathD = `M ${PATH.p0[0]} ${PATH.p0[1]} C ${PATH.p1[0]} ${PATH.p1[1]}, ${PATH.p2[0]} ${PATH.p2[1]}, ${PATH.p3[0]} ${PATH.p3[1]}`;

  return (
    <svg viewBox="0 0 380 380" className={cn("h-full w-full", className)} role="img" aria-label="Yo'nalish xaritasi">
      <defs>
        <linearGradient id="mapBgAdmin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef5f1" />
          <stop offset="100%" stopColor="#dce8e1" />
        </linearGradient>
      </defs>
      <rect width="380" height="380" fill="url(#mapBgAdmin)" />
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 38} y1="0" x2={i * 38} y2="380" stroke="#c7d6cd" strokeWidth="1" opacity="0.6" />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 38} x2="380" y2={i * 38} stroke="#c7d6cd" strokeWidth="1" opacity="0.6" />
      ))}
      <path d={pathD} fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" opacity="0.9" />
      <path d={pathD} fill="none" stroke="#0FB67C" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />
      <circle cx={PATH.p0[0]} cy={PATH.p0[1]} r="7" fill="#0e1a16" />
      <circle cx={PATH.p0[0]} cy={PATH.p0[1]} r="3" fill="#ffffff" />
      <circle cx={PATH.p3[0]} cy={PATH.p3[1]} r="7" fill="#0FB67C" />
      <circle cx={PATH.p3[0]} cy={PATH.p3[1]} r="3" fill="#ffffff" />
    </svg>
  );
}
