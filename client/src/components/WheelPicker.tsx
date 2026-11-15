import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";

// Row pitch 51 and band 58.5 (measured: photo 1, the date and time sheet).
const ITEM_HEIGHT = 52;
const BAND_HEIGHT = 58;
const VISIBLE_COUNT = 5;
const PAD = Math.floor(VISIBLE_COUNT / 2) * ITEM_HEIGHT;
/** Rows either side of centre that get the drum transform. */
const DRUM_REACH = 4;

/**
 * iOS-style drum roller: native momentum scroll + `scroll-snap`, rows tilt
 * away from the centre band (rotateX/scale/opacity on each visible row,
 * written straight to the DOM in a rAF so React doesn't re-render per frame).
 *
 * The wheel is controlled. When it settles it reports the row under the band;
 * the parent may correct that (e.g. a past time, or "gacha" before "dan" +
 * 30 min) — and if the corrected value is the one it already had, the wheel
 * still scrolls back to it, so it never rests on a row that isn't the value.
 * `isDimmed` greys rows the parent will steer away from.
 */
export function WheelPicker({
  options,
  value,
  onChange,
  ariaLabel,
  isDimmed,
  format,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  isDimmed?: (option: string) => boolean;
  /** Display label for an option (defaults to the option itself). */
  format?: (option: string) => string;
}) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const resyncTimer = useRef<ReturnType<typeof setTimeout>>();
  const frame = useRef(0);
  const styled = useRef<Set<number>>(new Set());
  const valueRef = useRef(value);
  valueRef.current = value;
  const mounted = useRef(false);
  /** True from the first scroll event until the wheel settles. */
  const scrolling = useRef(false);

  const reducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function paint() {
    frame.current = 0;
    const el = containerRef.current;
    if (!el) return;
    const centre = el.scrollTop / ITEM_HEIGHT;
    const lo = Math.max(0, Math.floor(centre) - DRUM_REACH);
    const hi = Math.min(options.length - 1, Math.ceil(centre) + DRUM_REACH);
    const next = new Set<number>();
    for (let i = lo; i <= hi; i++) {
      const node = itemRefs.current[i];
      if (!node) continue;
      const d = i - centre;
      const a = Math.min(Math.abs(d), 3);
      const lift = Math.max(0, 1 - a * 1.6) * 0.12; // centre row is a touch larger
      node.style.transform = `rotateX(${(-d * 20).toFixed(2)}deg) scale(${(1 - a * 0.07 + lift).toFixed(3)})`;
      node.style.opacity = String(Math.max(0.15, 1 - a * 0.3));
      next.add(i);
    }
    styled.current.forEach((i) => {
      if (!next.has(i) && itemRefs.current[i]) {
        itemRefs.current[i]!.style.transform = "";
        itemRefs.current[i]!.style.opacity = "";
      }
    });
    styled.current = next;
  }
  function schedulePaint() {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }

  function scrollToIndex(idx: number, smooth: boolean) {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * ITEM_HEIGHT, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
    schedulePaint();
  }

  // Follow `value` (keyboard, parent corrections, option list changes).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // A parent re-render mid-fling must not yank the wheel; settle() resyncs.
    if (scrolling.current) return;
    const want = Math.max(0, options.indexOf(value));
    if (Math.round(el.scrollTop / ITEM_HEIGHT) !== want) scrollToIndex(want, mounted.current);
    else schedulePaint();
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, value]);

  useEffect(
    () => () => {
      clearTimeout(settleTimer.current);
      clearTimeout(resyncTimer.current);
      cancelAnimationFrame(frame.current);
    },
    []
  );

  function settle() {
    scrolling.current = false;
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
    const landed = options[idx];
    if (landed !== undefined && landed !== valueRef.current) onChange(landed);
    // Give the parent a beat to correct, then make sure we rest on the value.
    clearTimeout(resyncTimer.current);
    resyncTimer.current = setTimeout(() => {
      const want = options.indexOf(valueRef.current);
      const now = Math.round((containerRef.current?.scrollTop ?? 0) / ITEM_HEIGHT);
      if (want >= 0 && want !== now) scrollToIndex(want, true);
    }, 60);
  }

  function handleScroll() {
    scrolling.current = true;
    schedulePaint();
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, 140);
  }

  function step(delta: number) {
    const idx = options.indexOf(value);
    const next = options[Math.max(0, Math.min(options.length - 1, idx + delta))];
    if (next !== undefined && next !== value) onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const map: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -VISIBLE_COUNT, PageDown: VISIBLE_COUNT };
    if (e.key in map) {
      e.preventDefault();
      step(map[e.key]);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const next = e.key === "Home" ? options[0] : options[options.length - 1];
      if (next !== value) onChange(next);
    }
  }

  const activeIdx = options.indexOf(value);

  return (
    <div className="relative select-none" style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}>
      {/* Highlight band behind the centre row */}
      <div
        // Gray selection band (measured: #f4f4f4, radius 16), one design everywhere.
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-[16px] bg-fill-subtle"
        style={{ height: BAND_HEIGHT }}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
        className="no-scrollbar relative h-full overflow-y-auto overscroll-contain rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
        style={{
          scrollSnapType: "y mandatory",
          perspective: "600px",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0, #000 30%, #000 70%, transparent 100%)",
          maskImage: "linear-gradient(180deg, transparent 0, #000 30%, #000 70%, transparent 100%)",
        }}
      >
        <div style={{ height: PAD }} aria-hidden="true" />
        {options.map((opt, i) => {
          const dimmed = isDimmed?.(opt) ?? false;
          const selected = opt === value;
          return (
            <div
              key={opt}
              id={`${listId}-${i}`}
              ref={(el) => (itemRefs.current[i] = el)}
              role="option"
              aria-selected={selected}
              aria-disabled={dimmed || undefined}
              onClick={() => scrollToIndex(i, true)}
              className={cn(
                "flex cursor-pointer items-center justify-center whitespace-nowrap px-1 text-lead tabular will-change-transform",
                selected ? "font-medium text-ink" : dimmed ? "text-ink/20" : "text-ink/55"
              )}
              // 288 rows: let the browser skip off-screen ones (fixed height, so
              // scroll maths is unaffected).
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: "center",
                transformOrigin: "50% 50%",
                contentVisibility: "auto",
                containIntrinsicSize: `auto ${ITEM_HEIGHT}px`,
              }}
            >
              {format ? format(opt) : opt}
            </div>
          );
        })}
        <div style={{ height: PAD }} aria-hidden="true" />
      </div>
    </div>
  );
}
