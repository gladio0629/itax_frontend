import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SegmentOption<T extends string> = { id: T; label: ReactNode; ariaLabel?: string; disabled?: boolean };

/**
 * Gray track with a white raised pill (Kuzov S–3XL, Yukchilar, Narx hisobi).
 * Equal-width segments, arrow keys move between the enabled ones.
 * Track 48px (sm 40px), radius 17, 2px inset — measured, see tokens.css.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  ariaLabelledBy,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  size?: "md" | "sm";
  className?: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  function onKeyDown(e: KeyboardEvent) {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const usable = options.filter((o) => !o.disabled);
    const i = usable.findIndex((o) => o.id === value);
    const next = usable[(i + d + usable.length) % usable.length];
    if (next) {
      onChange(next.id);
      refs.current.get(next.id)?.focus();
    }
  }
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onKeyDown={onKeyDown}
      className={cn(
        "grid min-w-0 rounded-control bg-fill p-[2px]",
        size === "md" ? "min-h-[var(--size-track)]" : "min-h-[var(--size-track-sm)]",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              if (el) refs.current.set(o.id, el);
              else refs.current.delete(o.id);
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            aria-disabled={o.disabled || undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => !o.disabled && onChange(o.id)}
            className={cn(
              "min-w-0 rounded-[15px] px-1 text-control leading-tight transition-[background-color,color,box-shadow] duration-150",
              on ? "bg-card font-medium text-ink shadow-[0_2px_6px_rgba(0,0,0,0.12)]" : "text-ink/60 hover:text-ink",
              o.disabled && "cursor-not-allowed text-ink/30 hover:text-ink/30"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
