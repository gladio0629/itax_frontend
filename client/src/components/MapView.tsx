import { Car } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";

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
  const { t } = useT();
  const [carX, carY] = cubicPoint(Math.min(1, Math.max(0, carProgress)));
  const pathD = `M ${PATH.p0[0]} ${PATH.p0[1]} C ${PATH.p1[0]} ${PATH.p1[1]}, ${PATH.p2[0]} ${PATH.p2[1]}, ${PATH.p3[0]} ${PATH.p3[1]}`;

  return (
    <svg
      viewBox="0 0 380 380"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", dim && "opacity-60", className)}
      role="img"
      aria-label={t("map.routeLabel")}
    >
      <rect width="380" height="380" className="fill-accent/10" />
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 38} y1="0" x2={i * 38} y2="380" className="stroke-accent/15" strokeWidth="1" />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 38} x2="380" y2={i * 38} className="stroke-accent/15" strokeWidth="1" />
      ))}
      <path d={pathD} fill="none" className="stroke-card" strokeWidth="10" strokeLinecap="round" opacity="0.9" />
      <path
        d={pathD}
        fill="none"
        className="stroke-accent"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 10"
      />
      {/* Origin marker */}
      <circle cx={PATH.p0[0]} cy={PATH.p0[1]} r="7" className="fill-ink" />
      <circle cx={PATH.p0[0]} cy={PATH.p0[1]} r="3" className="fill-card" />
      {/* Destination marker — brand-yellow pin with a navy ring, echoing the logo mark */}
      <circle cx={PATH.p3[0]} cy={PATH.p3[1]} r="8.5" className="fill-on-yellow" />
      <circle cx={PATH.p3[0]} cy={PATH.p3[1]} r="6" className="fill-brand-yellow" />
      <circle cx={PATH.p3[0]} cy={PATH.p3[1]} r="2.5" className="fill-on-yellow" />
      {showCar && (
        <g transform={`translate(${carX - 14}, ${carY - 14})`}>
          <circle cx="14" cy="14" r="16" className="fill-ink" opacity="0.08" />
          <circle cx="14" cy="14" r="13" className="fill-ink" />
          <foreignObject x="2" y="2" width="24" height="24">
            <div className="flex h-6 w-6 items-center justify-center text-white">
              <Car className="h-3.5 w-3.5" />
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
}
