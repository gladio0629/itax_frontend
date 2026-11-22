import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Card on the sheet: radius 24. `tone="soft"` is the field fill, otherwise a hairline border. */
export function Card({ className, tone = "outline", ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: "outline" | "soft" | "selected" }) {
  return (
    <div
      className={cn(
        "rounded-card",
        tone === "soft" ? "bg-raised" : tone === "selected" ? "border-2 border-ink bg-surface" : "border border-line bg-surface",
        className
      )}
      {...rest}
    />
  );
}

/** Small caps section heading (11px / 700 / 0.8px). */
export function SectionLabel({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("label-caps mb-2 text-muted", className)}>
      {children}
    </h2>
  );
}
