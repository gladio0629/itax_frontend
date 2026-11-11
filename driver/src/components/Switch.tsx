import { cn } from "@/lib/cn";

/** 48×48 hit area around a 44×26 track. Checked = navy thumb on yellow. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  describedBy,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onChange}
      className="-my-3 -mr-2 flex h-12 w-14 shrink-0 items-center justify-center rounded-button disabled:opacity-40"
    >
      <span className="relative h-[26px] w-11 overflow-hidden rounded-full bg-ink/15">
        <span
          className={cn("absolute inset-0 rounded-full bg-yellow transition-opacity", checked ? "opacity-100" : "opacity-0")}
        />
        <span
          className={cn(
            "absolute left-[3px] top-[3px] h-5 w-5 rounded-full shadow-1 transition-transform",
            checked ? "translate-x-[18px] bg-on-yellow" : "translate-x-0 bg-white"
          )}
        />
      </span>
    </button>
  );
}
