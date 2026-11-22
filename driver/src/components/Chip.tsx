import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Selectable pill: 40 tall as drawn, with the hit area stretched to 44.
 * Selected = Ink fill + white text; otherwise the soft field fill.
 */
export function Chip({ selected, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "press focus-inset relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-13 font-bold",
        "after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-['']",
        selected ? "bg-night text-white dark:bg-white dark:text-night" : "bg-raised text-ink",
        className
      )}
      {...rest}
    />
  );
}

/** Non-interactive tag (status, kind). `tone` picks the fill. */
export function Tag({
  tone = "soft",
  className,
  children,
}: {
  tone?: "soft" | "brand" | "night" | "danger" | "warning";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    soft: "bg-raised text-ink",
    brand: "bg-brand-soft text-brand-ink",
    night: "bg-night text-white",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
  } as const;
  return (
    <span className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold", tones[tone], className)}>
      {children}
    </span>
  );
}
