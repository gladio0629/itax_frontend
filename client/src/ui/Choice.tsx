import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Chip (design v2): 44px capsule. Selected = Ink fill, white text and a
 * green check. Toggle semantics (aria-pressed); for a single choice in a
 * row use `ChipGroup`.
 */
export function Chip({
  selected,
  onClick,
  children,
  className,
  disabled,
  check = true,
  compact,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Show the check on the selected chip (off for amount chips). */
  check?: boolean;
  /** Equal-width chips in a grid (tip amounts): no side padding. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full text-[14px] transition-colors disabled:opacity-40",
        compact ? "px-2 text-[13px] font-bold" : selected && check ? "pl-3 pr-4" : "px-4",
        selected
          ? "border border-transparent bg-iz-selected font-bold text-iz-on-selected"
          : cn("border border-iz-chip-border bg-iz-sheet text-iz-ink", compact ? "font-bold" : "font-semibold"),
        className
      )}
    >
      {selected && check && !compact && <Icon name="check" size={18} strokeWidth={2.4} className="text-iz-selected-accent" />}
      {children}
    </button>
  );
}

export type SegmentOption<T extends string> = { value: T; label: ReactNode; disabled?: boolean };

/**
 * Segmented control (design v2). `size="md"`: 54px track filling the width
 * (Hozir / Aniq vaqt / Oraliq). `size="sm"`: 44px inline track (Och / To'q).
 * Radio-group semantics with arrow-key navigation.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** Accessible name of the group. */
  label: string;
  size?: "md" | "sm";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    for (let i = 1; i <= options.length; i++) {
      const next = (index + step * i + options.length) % options.length;
      if (!options[next].disabled) {
        onChange(options[next].value);
        refs.current[next]?.focus();
        return;
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "bg-iz-field",
        size === "md"
          ? "grid h-[54px] w-full gap-1 rounded-[27px] p-[5px]"
          : "inline-flex h-11 shrink-0 gap-0.5 rounded-[22px] p-1",
        className
      )}
      style={size === "md" ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "min-w-0 truncate transition-colors disabled:opacity-40",
              size === "md" ? "rounded-[22px] px-2 text-[14px]" : "h-9 rounded-[18px] px-3.5 text-[13px]",
              selected ? "bg-iz-selected font-extrabold text-iz-on-selected" : "font-bold text-iz-ink"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Switch (design v2): 52×32 track inside a 60×44 target.
 * `tone="sheet"` (on white): on = Ink track + green knob.
 * `tone="head"` (on the dark top): on = green track + Ink knob.
 * Off: grey track, white knob.
 */
export function Switch({
  checked,
  onChange,
  label,
  tone = "sheet",
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  tone?: "sheet" | "head";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-[60px] shrink-0 items-center justify-center disabled:opacity-40"
    >
      <span
        className={cn(
          "flex h-8 w-[52px] items-center rounded-2xl p-[3px] transition-colors",
          checked ? "justify-end" : "justify-start",
          !checked && "bg-iz-switch-off",
          checked && tone === "sheet" && "bg-iz-selected",
          checked && tone === "head" && "bg-iz-green"
        )}
      >
        <span
          className={cn(
            "h-[26px] w-[26px] rounded-full",
            !checked && "bg-white",
            checked && tone === "sheet" && "bg-iz-selected-accent",
            checked && tone === "head" && "bg-[var(--iz-on-green)]"
          )}
        />
      </span>
    </button>
  );
}

/** 44px stepper ("Bagaj soni"): − value +. Bounds come from the server. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  decLabel,
  incLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  decLabel: string;
  incLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={decLabel}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-iz-field text-iz-ink disabled:opacity-40"
      >
        <Icon name="minus" />
      </button>
      <span aria-live="polite" className="min-w-8 text-center text-[20px] font-extrabold tabular-nums text-iz-ink">
        {value}
      </span>
      <button
        type="button"
        aria-label={incLabel}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-iz-selected text-iz-on-selected disabled:opacity-40"
      >
        <Icon name="plusSmall" />
      </button>
    </div>
  );
}
