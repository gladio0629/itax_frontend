import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/** v2 status chips above a table ("Hammasi 1 284", "Faol 3 412"…).
 * One is selected (Ink fill). Counts are optional and always come from the
 * server; a chip without a count just shows its label. */
export function FilterChips<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { key: K; label: string; count?: number | null }[];
  value: K;
  onChange: (k: K) => void;
  /** Accessible group name. */
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(it.key)}
            className={cn(
              "inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-13 font-bold transition-colors",
              active ? "bg-ink text-white" : "bg-white text-ink shadow-hairline hover:bg-surface"
            )}
          >
            {it.label}
            {it.count != null && (
              <span
                className={cn(
                  "tabular inline-flex h-5 items-center rounded-full px-[7px] text-2xs font-extrabold",
                  active ? "bg-white/[0.16]" : "bg-surface"
                )}
              >
                {formatNumber(it.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
