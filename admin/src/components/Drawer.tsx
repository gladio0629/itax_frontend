import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

/** Right-side panel shared by every detail view and add/edit form.
 * Header stays put; body scrolls; optional footer is pinned to the bottom. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Callers pass inline arrows; keep the latest without re-running the focus effect.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 !m-0 flex justify-end">
      <div className="absolute inset-0 bg-ink/30 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[440px] flex-col bg-card shadow-2xl outline-none animate-slide-in-right"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
          <h2 id={titleId} className="truncate text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-button text-ink/60 hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">{children}</div>
        {footer && <div className="shrink-0 border-t border-border bg-card px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
