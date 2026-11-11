import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Selectable pill (48px tall). Selected = yellow. */
export function Chip({ selected, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "press focus-inset inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-button px-4 text-sm font-medium",
        selected ? "bg-yellow text-on-yellow" : "bg-raised text-ink",
        className
      )}
      {...rest}
    />
  );
}
