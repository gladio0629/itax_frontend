import { Star } from "@/lib/icons";
import { cn } from "@/lib/cn";

/** Rating as stars + number; the number is the accessible text. */
export function Stars({ value, size = 16, showValue = true, className }: { value: number; size?: number; showValue?: boolean; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="inline-flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            style={{ width: size, height: size }}
            className={i < full ? "fill-brand text-brand" : "fill-transparent text-ink/25"}
          />
        ))}
      </span>
      {showValue && <span className="tabular text-sm font-bold text-ink">{value.toFixed(1)}</span>}
    </span>
  );
}
