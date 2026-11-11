import { useId } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

type TabItem<K extends string> = { key: K; label: string; count?: number };

function onArrow<K extends string>(e: KeyboardEvent, items: TabItem<K>[], value: K, onChange: (k: K) => void, id: string) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  const i = items.findIndex((t) => t.key === value);
  const next = items[(i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
  onChange(next.key);
  document.getElementById(`${id}-${next.key}`)?.focus();
}

/** Section tabs: underline style, yellow indicator on the active tab, optional counters. */
export function Tabs<K extends string>({ items, value, onChange, label }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void; label: string }) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className="flex gap-6 border-b border-border" onKeyDown={(e) => onArrow(e, items, value, onChange, id)}>
      {items.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            id={`${id}-${t.key}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={cn("relative -mb-px flex h-11 items-center gap-2 text-sm font-semibold", active ? "text-ink" : "text-ink/60 hover:text-ink")}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "tabular flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold",
                  active ? "bg-brand-yellow text-on-yellow" : "bg-ink/[0.06] text-ink/60"
                )}
              >
                {t.count}
              </span>
            )}
            <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-yellow transition-opacity", active ? "opacity-100" : "opacity-0")} />
          </button>
        );
      })}
    </div>
  );
}

/** Compact segmented control (e.g. period picker). Active segment is yellow. */
export function Segmented<K extends string>({ items, value, onChange, label }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-button border border-border bg-card p-1">
      {items.map((p) => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.key)}
            className={cn("h-8 rounded-[6px] px-3 text-sm font-semibold", active ? "bg-brand-yellow text-on-yellow" : "text-ink/60 hover:text-ink")}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
