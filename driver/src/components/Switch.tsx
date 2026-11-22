import { cn } from "@/lib/cn";

/** 50×30 track inside a 48px hit area. On = green track; the thumb is white either way. */
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
      className="-my-2 -mr-1 flex h-12 w-14 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
    >
      <span className={cn("relative h-[30px] w-[50px] rounded-full transition-colors", checked ? "bg-brand" : "bg-control-off")}>
        <span
          className={cn(
            "absolute left-[3px] top-[3px] h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(11,21,36,0.25)] transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </span>
    </button>
  );
}
