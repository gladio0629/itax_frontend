import { cn } from "@/lib/cn";

/** Shimmer via a translating highlight (transform only). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-full bg-raised", className)} aria-hidden="true">
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/5" />
    </div>
  );
}

/** Loading list: outlined cards with a tile, two lines, an amount and a footer line. */
export function SkeletonList({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-card border border-line p-4" style={{ opacity: 1 - i * 0.2 }}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-[60px] w-[54px] rounded-tile" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-[60%]" />
              <Skeleton className="h-3.5 w-[42%]" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-3 w-[40%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
