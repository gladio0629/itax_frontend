import { Car } from "lucide-react";
import { cn } from "@/lib/cn";

// Stylized, fully static SVG "map" — no real map tiles or external service.
// A single cubic bezier represents the route; cubicPoint() lets us place a
// car marker anywhere along it for the trip-progress animation.
const PATH = { p0: [40, 300], p1: [120, 80], p2: [260, 340], p3: [340, 60] };

function cubicPoint(t: number): [number, number] {
  const { p0, p1, p2, p3 } = PATH;
  const mt = 1 - t;
  const x =
    mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0];
  const y =
    mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1];
  return [x, y];
}

export function MapView({
  showCar = false,
  carProgress = 0.5,
  className,
  dim = false,
}: {
  showCar?: boolean;
  carProgress?: number;
  className?: string;
  dim?: boolean;
}) {
  const [carX, carY] = cubicPoint(Math.min(1, Math.max(0, carProgress)));
  const pathD = `M ${PATH.p0[0]} ${PATH.p0[1]} C ${PATH.p1[0]} ${PATH.p1[1]}, ${PATH.p2[0]} ${PATH.p2[1]}, ${PATH.p3[0]} ${PATH.p3[1]}`;

  return (
    <svg
      viewBox="0 0 380 380"
      className={cn("h-full w-full", dim && "opacity-60", className)}
      role="img"
      aria-label="Yo'nalish xaritasi"
    >
      <defs>
        <linearGradient id="mapBgDriver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16261F" />
          <stop offset="100%" stopColor="#0E1A16" />
        </linearGradient>
      </defs>
      <rect width="380" height="380" fill="url(#mapBgDriver)" />
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 38} y1="0" x2={i * 38} y2="380" stroke="#24352D" strokeWidth="1" opacity="0.5" />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 38} x2="380" y2={i * 38} stroke="#24352D" strokeWidth="1" opacity="0.5" />
      ))}
      <path d={pathD} fill="none" stroke="#0E1A16" strokeWidth="10" strokeLinecap="round" opacity="0.9" />
      <path
        d={pathD}
        fill="none"
        stroke="#1ED697"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 10"
      />
      <circle cx={PATH.p0[0]} cy={PATH.p0[1]} r="7" fill="#F6F8F7" />
      <circle cx={PATH.p0[0]} cy={PATH.p0[1]} r="3" fill="#0E1A16" />
      <circle cx={PATH.p3[0]} cy={PATH.p3[1]} r="7" fill="#1ED697" />
      <circle cx={PATH.p3[0]} cy={PATH.p3[1]} r="3" fill="#0E1A16" />
      {showCar && (
        <g transform={`translate(${carX - 14}, ${carY - 14})`}>
          <circle cx="14" cy="14" r="16" fill="#1ED697" opacity="0.18" />
          <circle cx="14" cy="14" r="13" fill="#1ED697" />
          <foreignObject x="2" y="2" width="24" height="24">
            <div className="flex h-6 w-6 items-center justify-center text-[#0b1512]">
              <Car className="h-3.5 w-3.5" />
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
}
