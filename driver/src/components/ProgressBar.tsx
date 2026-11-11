import { cn } from "@/lib/cn";

/** Track + fill scaled on X (transform only). Optional milestone ticks (0..1). */
export function ProgressBar({
  value,
  tone = "yellow",
  label,
  milestones,
  className,
}: {
  value: number;
  tone?: "yellow" | "danger" | "warning";
  label: string;
  milestones?: number[];
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cn("relative h-2 overflow-hidden rounded-full bg-ink/10", className)}
    >
      <div
        className={cn(
          "absolute inset-0 origin-left rounded-full transition-transform duration-[280ms]",
          tone === "yellow" ? "bg-yellow" : tone === "danger" ? "bg-danger" : "bg-warning"
        )}
        style={{ transform: `scaleX(${v})` }}
      />
      {milestones?.map((m) => (
        <span key={m} className="absolute top-0 h-full w-0.5 bg-bg/70" style={{ left: `${m * 100}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}
