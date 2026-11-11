import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tab = { id: string; label: string; content: ReactNode };

/**
 * Two (or more) equal-width tabs over a horizontally scroll-snapped track,
 * so panels can be swiped. The yellow underline follows the scroll position
 * via transform only.
 */
export function SwipeTabs({ tabs, index, onIndexChange, label }: { tabs: Tab[]; index: number; onIndexChange: (i: number) => void; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const settled = useRef(index);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    if (Math.round(el.scrollLeft / el.clientWidth) !== index) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && settled.current !== index;
      el.scrollTo({ left: index * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
    }
    settled.current = index;
  }, [index]);

  function onScroll() {
    const el = track.current;
    if (!el || !bar.current) return;
    const ratio = el.scrollLeft / el.clientWidth;
    bar.current.style.transform = `translateX(${ratio * 100}%)`;
    const nearest = Math.round(ratio);
    if (Math.abs(ratio - nearest) < 0.02 && nearest !== settled.current) {
      settled.current = nearest;
      onIndexChange(nearest);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onIndexChange(next);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label={label} className="relative mx-4 grid shrink-0 border-b border-line" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }} onKeyDown={onKeyDown}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-controls={`panel-${t.id}`}
            tabIndex={i === index ? 0 : -1}
            onClick={() => onIndexChange(i)}
            className={cn("h-12 text-base font-bold", i === index ? "text-ink" : "text-muted")}
          >
            {t.label}
          </button>
        ))}
        <span
          ref={bar}
          aria-hidden="true"
          className="absolute bottom-[-1px] left-0 h-[3px] rounded-full bg-yellow"
          style={{ width: `${100 / tabs.length}%`, transform: `translateX(${index * 100}%)` }}
        />
      </div>
      <div ref={track} onScroll={onScroll} className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {tabs.map((t, i) => (
          <section
            key={t.id}
            id={`panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${t.id}`}
            // React 18 has no typed `inert`; off-screen panel leaves tab order.
            {...(i !== index ? ({ inert: "" } as Record<string, string>) : {})}
            className="h-full w-full shrink-0 snap-start overflow-y-auto overscroll-contain"
          >
            {t.content}
          </section>
        ))}
      </div>
    </div>
  );
}
