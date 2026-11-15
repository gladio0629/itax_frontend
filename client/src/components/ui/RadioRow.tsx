import type { ReactNode } from "react";
import { Check } from "@/lib/icons";
import { cn } from "@/lib/cn";

/** Radio list row with a round check on the right: selected = yellow circle
 * with a navy check, otherwise a gray circle (32px, measured). */
export function RadioRow({
  checked,
  onSelect,
  title,
  subtitle,
  value,
  leading,
  last,
  disabled,
}: {
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  leading?: ReactNode;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-[var(--size-row)] w-full items-center gap-3 py-2 text-left disabled:opacity-50",
        !last && "border-b border-hairline"
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-control text-ink">{title}</span>
        {subtitle && <span className="block text-sub text-ink/60">{subtitle}</span>}
      </span>
      {value != null && <span className="shrink-0 text-control text-ink tabular">{value}</span>}
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[var(--size-radio)] w-[var(--size-radio)] shrink-0 items-center justify-center rounded-full transition-colors",
          checked ? "bg-brand-yellow text-on-yellow" : "bg-fill"
        )}
      >
        {checked && <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />}
      </span>
    </button>
  );
}
