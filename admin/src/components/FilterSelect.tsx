export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  "aria-label": string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      aria-label={ariaLabel}
      className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
