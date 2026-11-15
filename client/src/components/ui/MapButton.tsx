import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Floating round map button (back, locate): 48px white circle, soft shadow. */
export function MapButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[var(--size-map-button)] w-[var(--size-map-button)] items-center justify-center rounded-full bg-card text-ink shadow-[0_2px_12px_rgba(0,0,0,0.16)] transition-transform active:scale-95",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
