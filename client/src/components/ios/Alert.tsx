import { useRef, type ReactNode } from "react";
import { useSheetA11y } from "@/components/Sheet";
import { cn } from "@/lib/cn";

export type AlertAction = {
  label: string;
  onPress: () => void;
  style?: "default" | "cancel" | "destructive";
  loading?: boolean;
};

/**
 * iOS alert (UIAlertController .alert): centered, 270px wide, 14px radius,
 * blurred material, Headline title + Footnote message. Two short actions sit
 * side by side; longer or more actions stack. Cancel is semibold, destructive
 * is red. Escape (or the hardware back of an attached keyboard) cancels;
 * tapping outside does nothing, as on iOS.
 */
export function Alert({
  open,
  title,
  message,
  actions,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  actions: AlertAction[];
  /** Called on Escape. */
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useSheetA11y(open, onCancel, panelRef);
  if (!open) return null;

  const sideBySide = actions.length === 2 && actions.every((a) => a.label.length <= 14);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center px-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ios-alert-title"
      aria-describedby={message ? "ios-alert-message" : undefined}
    >
      <div className="absolute inset-0 animate-ios-backdrop-in bg-[var(--ios-backdrop)]" aria-hidden="true" />
      <div
        ref={panelRef}
        className="relative w-[270px] animate-ios-alert-in overflow-hidden rounded-[14px] bg-[var(--ios-material)] backdrop-blur-xl backdrop-saturate-150 ios-squircle"
      >
        <div className="px-4 pb-[19px] pt-[19px] text-center">
          <h2 id="ios-alert-title" className="ios-headline text-ink">
            {title}
          </h2>
          {message && (
            <p id="ios-alert-message" className="ios-footnote mt-0.5 text-ink">
              {message}
            </p>
          )}
        </div>
        <div className={cn("relative", sideBySide ? "grid grid-cols-2" : "flex flex-col")}>
          {actions.map((a, i) => (
            <button
              key={a.label}
              type="button"
              disabled={a.loading}
              onClick={a.onPress}
              className={cn(
                "ios-body relative flex h-11 items-center justify-center px-3 transition-colors duration-100 hover:bg-[var(--ios-fill-quaternary)] focus-visible:outline-offset-[-2px] active:bg-[var(--ios-material-pressed)] disabled:opacity-50",
                // Hairline above every button, and between side-by-side ones.
                "before:absolute before:inset-x-0 before:top-0 before:h-px before:origin-top before:scale-y-[var(--hairline-scale,1)] before:bg-[var(--ios-bar-hairline)] before:content-['']",
                sideBySide && i === 1 && "after:absolute after:inset-y-0 after:left-0 after:w-px after:origin-left after:scale-x-[var(--hairline-scale,1)] after:bg-[var(--ios-bar-hairline)] after:content-['']",
                a.style === "destructive" ? "text-danger" : "text-accent",
                a.style === "cancel" && "font-semibold"
              )}
            >
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
