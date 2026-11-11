import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Cards float on elevation, not borders. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card bg-surface shadow-1", className)} {...rest} />;
}

export function SectionLabel({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("mb-2 px-1 text-sm font-medium text-muted", className)}>
      {children}
    </h2>
  );
}
