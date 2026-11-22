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

/** Section tabs (v2): 44px, 800 when active, 3px green underline, optional counters. */
export function Tabs<K extends string>({ items, value, onChange, label }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void; label: string }) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar flex gap-7 overflow-x-auto border-b border-line" onKeyDown={(e) => onArrow(e, items, value, onChange, id)}>
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
            className={cn(
              "relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-1 text-sm",
              active ? "font-extrabold text-ink shadow-[inset_0_-3px_0_var(--green)]" : "font-semibold text-muted hover:text-ink"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "tabular flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-extrabold",
                  active ? "bg-ink text-white" : "bg-surface text-muted"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control (v2): surface track, active segment white with a soft shadow. */
export function Segmented<K extends string>({ items, value, onChange, label }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-box bg-surface p-1">
      {items.map((p) => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.key)}
            className={cn(
              "h-11 rounded-[10px] px-3.5 text-13",
              active ? "bg-white font-extrabold text-ink shadow-[0_1px_3px_rgba(11,21,36,0.12)]" : "font-bold text-muted hover:text-ink"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
