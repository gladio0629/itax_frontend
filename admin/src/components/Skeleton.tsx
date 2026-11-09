import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer-bg animate-shimmer rounded-xl", className)} />;
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-softer">
      <Skeleton className="mb-3 h-3.5 w-1/2" />
      <Skeleton className="h-7 w-2/3" />
    </div>
  );
}
