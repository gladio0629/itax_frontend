import { cn } from "@/lib/cn";

/**
 * 30 ticks around a circle; each elapsed second dims one tick (opacity only,
 * no stroke animation). The seconds number sits in the middle.
 */
export function CountdownRing({ total, remaining, label }: { total: number; remaining: number; label: string }) {
  const urgent = remaining <= 10;
  return (
    <div
      role="timer"
      aria-label={label}
      className={cn("relative flex h-16 w-16 shrink-0 items-center justify-center", urgent && "animate-breathe")}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <line
            key={i}
            x1="32"
            y1="3"
            x2="32"
            y2="10"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${(360 / total) * i} 32 32)`}
            className={cn(
              "transition-opacity duration-300",
              urgent ? "stroke-danger" : "stroke-yellow",
              i < remaining ? "opacity-100" : "opacity-15"
            )}
          />
        ))}
      </svg>
      <span className={cn("tabular text-xl font-bold", urgent ? "text-danger" : "text-ink")} aria-hidden="true">
        {remaining}
      </span>
    </div>
  );
}
