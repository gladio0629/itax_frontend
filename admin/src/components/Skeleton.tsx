import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer-bg animate-shimmer rounded-lg", className)} />;
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="h-12 px-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
