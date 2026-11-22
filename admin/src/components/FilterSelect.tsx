import { ChevronDown } from "lucide-react";

/** v2 toolbar filter: white pill "Label  Value ▾". A real <select> sits on
 * top (transparent) so keyboard and screen readers get the native control. */
export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  /** Visible prefix ("Tur", "Sana"); defaults to the aria-label. */
  label?: string;
  "aria-label": string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? "";
  return (
    <span className="relative inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3.5 text-ink shadow-hairline focus-within:shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]">
      <span aria-hidden className="text-xs font-semibold text-muted">
        {label ?? ariaLabel}
      </span>
      <span aria-hidden className="text-13 font-bold">
        {current}
      </span>
      <ChevronDown aria-hidden className="h-4 w-4 text-muted" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={ariaLabel}
        className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
