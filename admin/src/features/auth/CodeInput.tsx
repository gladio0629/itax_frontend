import { useEffect, useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * One-time code boxes (design Main/Verify): 60px tall, radius 16.
 * Filled box = Ink with white digit; the box to type into = white with an
 * Ink border and soft-green ring; empty = surface. One <input> per digit,
 * each labelled "<label>, N-raqam". Paste spreads the digits; Backspace on
 * an empty box goes back one.
 */
export function CodeInput({
  length,
  value,
  onChange,
  label,
  invalid,
  disabled,
  autoFocus,
}: {
  length: number;
  value: string;
  onChange: (v: string) => void;
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  // The box to type into: the first empty one (or the last when full).
  const cursor = Math.min(value.length, length - 1);

  useEffect(() => {
    if (autoFocus) refs.current[cursor]?.focus();
    // Only on mount / when the box count changes (a new code was sent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, length]);

  function setAt(i: number, d: string) {
    const next = digits.slice();
    next[i] = d;
    // Keep the value contiguous: no gaps in the middle.
    const joined = next.join("").slice(0, length);
    onChange(joined);
  }

  function onInput(i: number, raw: string) {
    const d = raw.replace(/\D/g, "");
    if (!d) return;
    if (d.length > 1) {
      // Autofill / fast typing delivered several digits into one box.
      const merged = (value.slice(0, i) + d).slice(0, length);
      onChange(merged);
      refs.current[Math.min(merged.length, length - 1)]?.focus();
      return;
    }
    setAt(Math.min(i, value.length), d);
    refs.current[Math.min(i + 1, length - 1)]?.focus();
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!d) return;
    e.preventDefault();
    onChange(d);
    refs.current[Math.min(d.length, length - 1)]?.focus();
  }

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
      {digits.map((d, i) => {
        const filled = !!d;
        const current = i === cursor && !filled;
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={length}
            value={d}
            disabled={disabled}
            aria-label={`${label}, ${i + 1}-raqam`}
            aria-invalid={invalid || undefined}
            onChange={(e) => onInput(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            onFocus={(e) => e.target.select()}
            className={cn(
              "tabular h-[60px] min-w-0 rounded-field p-0 text-center text-2xl font-extrabold outline-none transition-colors disabled:opacity-60",
              invalid
                ? "bg-error-soft text-error shadow-[inset_0_0_0_2px_var(--error)]"
                : filled
                  ? "bg-ink text-white focus:shadow-[0_0_0_4px_var(--green-soft)]"
                  : current
                    ? "bg-white text-ink shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]"
                    : "bg-surface text-ink focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]"
            )}
          />
        );
      })}
    </div>
  );
}

/** "01:52" from seconds. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
