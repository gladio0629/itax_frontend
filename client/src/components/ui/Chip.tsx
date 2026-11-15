import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Capsule chip: gray fill, label, optional trailing icon ("Manzil +",
 * "Yetkazish haqida ⓘ"). 32px tall, full capsule (tokens). */
export function Chip({
  trailing,
  leading,
  selected,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { trailing?: ReactNode; leading?: ReactNode; selected?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-[var(--size-chip)] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip px-3.5 text-sub font-medium transition-colors",
        selected ? "bg-ink text-bg" : "bg-fill text-ink hover:bg-ink/10",
        className
      )}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
}
