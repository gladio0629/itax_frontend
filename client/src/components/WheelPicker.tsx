import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;
const PAD = Math.floor(VISIBLE_COUNT / 2) * ITEM_HEIGHT;

/**
 * Single-column scroll-snap wheel (hour/minute style). Snaps natively via
 * CSS `scroll-snap-type`; a debounced scroll-end check is what tells React
 * which value landed, since there's no universal `scrollend` event yet.
 */
export function WheelPicker({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const programmaticScroll = useRef(false);

  useEffect(() => {
    const idx = Math.max(0, options.indexOf(value));
    const el = containerRef.current;
    if (!el) return;
    programmaticScroll.current = true;
    el.scrollTo({ top: idx * ITEM_HEIGHT, behavior: "auto" });
    const id = setTimeout(() => {
      programmaticScroll.current = false;
    }, 50);
    return () => clearTimeout(id);
    // Re-centers on `value` too, not just `options` — needed so a keyboard
    // step (which changes `value` without the user scrolling) still moves
    // the wheel to match, the same way a touch-driven scroll already does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, value]);

  function handleScroll() {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (programmaticScroll.current) return;
      const el = containerRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const next = options[Math.max(0, Math.min(options.length - 1, idx))];
      if (next !== undefined && next !== value) onChange(next);
    }, 120);
  }

  function step(delta: number) {
    const idx = options.indexOf(value);
    const next = options[Math.max(0, Math.min(options.length - 1, idx + delta))];
    if (next !== undefined && next !== value) onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(1);
    }
  }

  return (
    <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}>
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-xl border-y-2 border-brand-yellow/60"
        style={{ height: ITEM_HEIGHT }}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="listbox"
        aria-label={ariaLabel}
        className="no-scrollbar h-full overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-yellow"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ height: PAD }} aria-hidden="true" />
        {options.map((opt) => (
          <div
            key={opt}
            role="option"
            aria-selected={opt === value}
            className={cn(
              "flex items-center justify-center text-base tabular transition-colors",
              opt === value ? "font-semibold text-ink" : "text-ink/60"
            )}
            style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
          >
            {opt}
          </div>
        ))}
        <div style={{ height: PAD }} aria-hidden="true" />
      </div>
    </div>
  );
}
