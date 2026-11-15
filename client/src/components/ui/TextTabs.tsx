import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * Text tabs with a thick underline under the active one ("Shahar ichi /
 * Shaharlararo / Marketpleysga"). Underline 3px navy, as wide as the label;
 * 16px between tabs (measured 16.6, photo 5).
 */
export function TextTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  uppercase,
  className,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  /** The route screen's service tabs are set in caps, like the reference. */
  uppercase?: boolean;
  className?: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  function onKeyDown(e: KeyboardEvent) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.id === value);
    const next = options[(i + d + options.length) % options.length];
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  }
  return (
    <div role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown} className={cn("no-scrollbar flex gap-4 overflow-x-auto", className)}>
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
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative flex min-h-[44px] shrink-0 flex-col items-stretch justify-center whitespace-nowrap pb-2 pt-1 text-control font-semibold transition-colors",
              uppercase && "font-bold uppercase tracking-[0.02em]",
              on ? "text-ink" : "text-ink/45 hover:text-ink/70"
            )}
          >
            {o.label}
            <span
              aria-hidden="true"
              className={cn("absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-accent transition-opacity", on ? "opacity-100" : "opacity-0")}
            />
          </button>
        );
      })}
    </div>
  );
}
