import type { ComponentType, KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

type Option<T extends string> = { id: T; label: string; icon?: ComponentType<{ className?: string }> };

/**
 * iOS segmented control (UISegmentedControl): gray track, white sliding pill
 * (#636366 in dark), 32px tall, Footnote text, semibold when selected. The
 * visual track is 32px; each segment's hit area extends to 44px.
 *
 * Renders as a radiogroup by default, or as a tablist when `tabs` is given
 * (History tabs keep their tab/tabpanel wiring).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  tabs,
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  tabs?: { id: (id: T) => string; controls: (id: T) => string };
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const n = options.length;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (index + delta + n) % n;
    onChange(options[next].id);
    (e.currentTarget.querySelectorAll("button")[next] as HTMLElement | undefined)?.focus();
  }

  return (
    <div
      role={tabs ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn("relative grid h-8 rounded-[9px] bg-[var(--ios-fill-tertiary)] p-[2px]", className)}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-[2px] left-[2px] top-[2px] rounded-[7px] bg-[var(--ios-segment-pill)] shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{ width: `calc((100% - 4px) / ${n})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o, i) => {
        const selected = i === index;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role={tabs ? "tab" : "radio"}
            id={tabs?.id(o.id)}
            aria-controls={tabs?.controls(o.id)}
            aria-selected={tabs ? selected : undefined}
            aria-checked={tabs ? undefined : selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.id)}
            className={cn(
              "ios-footnote relative z-[1] flex min-w-0 items-center justify-center gap-1.5 rounded-[7px] px-2 text-ink transition-opacity active:opacity-60",
              // 44px hit area around the 28px segment.
              "before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
              selected ? "font-semibold" : "font-medium"
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
