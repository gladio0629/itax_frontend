import { cn } from "@/lib/cn";

/**
 * 44×24 visual track inside a 56×44 hit area. The negative margins keep the
 * row's layout height at the track's 24px so rows with and without a switch
 * line up, while the tappable box still meets the 44px minimum.
 * Checked uses a navy thumb on the yellow track: white-on-yellow is ~1.6:1,
 * too faint to read as the state on its own.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="-my-2.5 -mr-1.5 flex h-11 w-14 shrink-0 items-center justify-center rounded-xl disabled:opacity-40"
    >
      <span
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors duration-200",
          checked ? "bg-brand-yellow" : "bg-ink/15 ring-1 ring-inset ring-ink/20"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow-softer transition-transform duration-200",
            checked ? "translate-x-5 bg-on-yellow" : "translate-x-0 bg-white"
          )}
        />
      </span>
    </button>
  );
}
