import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/**
 * Compact number input for editable tables (tariffs): grouped digits while
 * not focused ("10 600"), the raw number while typing; unit on the right.
 * `size="row"` = 36px (inside table rows only), `md` = 44px.
 * `onChange(null)` = the box is empty or not a number (the caller blocks Save).
 */
export function NumberField({
  value,
  onChange,
  unit,
  label,
  decimals = 0,
  size = "md",
  width = 140,
  changed,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  /** Accessible name ("Gaz, 1 litr narxi"). */
  label: string;
  decimals?: number;
  size?: "row" | "md";
  /** px, or "full" to fill the parent. */
  width?: number | "full";
  /** Mark as edited (differs from the saved value). */
  changed?: boolean;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(value === null ? "" : String(value));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focused) setText(value === null ? "" : String(value));
  }, [value, focused]);
  // On focus the box switches from "2 500" to "2500": select it all after
  // that re-render, so typing replaces the value instead of appending.
  useEffect(() => {
    if (focused) input.current?.select();
  }, [focused]);

  const shown = focused ? text : value === null ? "" : decimals ? String(value).replace(".", ",") : formatNumber(value);
  return (
    <label
      htmlFor={id}
      style={width === "full" ? undefined : { width }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-nav px-3 transition-colors",
        width === "full" && "w-full",
        size === "row" ? "h-9" : "h-11",
        focused ? "bg-white shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]" : changed ? "bg-green-soft" : "bg-surface"
      )}
    >
      <input
        ref={input}
        id={id}
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        aria-label={label}
        value={shown}
        onFocus={() => {
          setFocused(true);
          setText(value === null ? "" : String(value));
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\s/g, "").replace(",", ".");
          if (!/^\d*(\.\d*)?$/.test(raw)) return;
          setText(raw);
          const n = raw === "" || raw === "." ? NaN : Number(raw);
          onChange(Number.isFinite(n) ? (decimals ? Math.round(n * 10 ** decimals) / 10 ** decimals : Math.round(n)) : null);
        }}
        className="tabular w-full min-w-0 bg-transparent text-right text-15 font-extrabold text-ink outline-none"
      />
      {unit && <span className="shrink-0 whitespace-nowrap text-xs font-bold text-muted">{unit}</span>}
    </label>
  );
}
