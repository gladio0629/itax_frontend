import { useRef, type ReactNode } from "react";
import { useSheetA11y } from "@/components/Sheet";
import { cn } from "@/lib/cn";

export type ActionSheetAction = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  /** Marks the current choice (e.g. the active language). */
  checked?: boolean;
};

/**
 * iOS action sheet (UIAlertController .actionSheet): grouped options on a
 * blurred material panel, a separate "Bekor qilish" group below, sliding up
 * from the bottom above the home indicator. Rendered inline (no portal) so it
 * stays inside the phone frame, like Sheet.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  message,
  actions,
  cancelLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  message?: ReactNode;
  actions: ActionSheetAction[];
  cancelLabel: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useSheetA11y(open, onClose, panelRef);
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : cancelLabel}>
      <div className="absolute inset-0 animate-ios-backdrop-in bg-[var(--ios-backdrop)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 animate-ios-sheet-in px-2"
        style={{ paddingBottom: "max(var(--safe-bottom), 8px)" }}
      >
        <div className="overflow-hidden rounded-[14px] bg-[var(--ios-material)] backdrop-blur-xl backdrop-saturate-150 ios-squircle">
          {(title || message) && (
            <div className="ios-sep relative px-4 py-[14px] text-center" style={{ ["--sep-inset" as string]: "0px" }}>
              {title && <p className="ios-footnote font-semibold text-[color:var(--ios-label-secondary)]">{title}</p>}
              {message && <p className="ios-footnote mt-0.5 text-[color:var(--ios-label-secondary)]">{message}</p>}
            </div>
          )}
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onSelect}
              aria-current={a.checked || undefined}
              className={cn(
                "ios-sep relative flex h-[57px] w-full items-center justify-center px-12 text-[20px] leading-[25px] tracking-[-0.45px] transition-colors duration-100 hover:bg-[var(--ios-fill-quaternary)] focus-visible:outline-offset-[-2px] active:bg-[var(--ios-material-pressed)]",
                a.destructive ? "text-danger" : "text-accent",
                a.checked && "font-semibold"
              )}
              style={{ ["--sep-inset" as string]: "0px" }}
            >
              <span className="truncate">{a.label}</span>
              {a.checked && (
                <svg width="17" height="14" viewBox="0 0 17 14" aria-hidden="true" className="absolute right-5">
                  <path d="M1.5 7.5 6 12 15.5 1.5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex h-[57px] w-full items-center justify-center rounded-[14px] bg-[var(--ios-elevated)] text-[20px] font-semibold leading-[25px] tracking-[-0.45px] text-accent transition-colors duration-100 hover:bg-[var(--ios-fill-quaternary)] active:bg-[var(--ios-row-pressed)] ios-squircle"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
