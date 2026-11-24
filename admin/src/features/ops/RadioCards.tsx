import { useId } from "react";
import { cn } from "@/lib/cn";

/** Design radio tiles (OpCancel, OpRequest): grey tile, the chosen one white
 * with a 2px Ink ring and a filled dot. Native radios, so arrow keys and
 * screen readers work as usual. */
export function RadioCards<K extends string>({
  label,
  items,
  value,
  onChange,
  columns = 2,
}: {
  label: string;
  items: { value: K; label: string; hint?: string | null }[];
  value: K | null;
  onChange: (v: K) => void;
  columns?: 1 | 2;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
      {items.map((it) => {
        const checked = value === it.value;
        return (
          <label
            key={it.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3.5 py-3 text-ink transition-colors",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-green",
              checked ? "bg-white shadow-[inset_0_0_0_2px_var(--ink)]" : "bg-surface hover:bg-line"
            )}
          >
            <input type="radio" name={name} value={it.value} checked={checked} onChange={() => onChange(it.value)} className="sr-only" />
            <span
              aria-hidden
              className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2", checked ? "border-ink" : "border-[#B8C2CF]")}
            >
              {checked && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-bold">{it.label}</span>
              {it.hint && <span className="text-xs font-semibold text-muted">{it.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
