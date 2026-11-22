import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button";

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
  // Opener captured during the opening render (before autoFocus moves focus).
  const openerRef = useRef<HTMLElement | null>(null);
  if (!open) openerRef.current = null;
  else if (openerRef.current === null && document.activeElement instanceof HTMLElement) openerRef.current = document.activeElement;

  useEffect(() => {
    if (!open) return;
    const prev = openerRef.current;
    // Respect autoFocus inside the drawer; otherwise move focus to the panel.
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (prev?.isConnected) prev.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 !m-0 flex justify-end">
      <div className="absolute inset-0 bg-ink/45 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[480px] flex-col rounded-l-sheet bg-white shadow-pop outline-none animate-slide-in-right"
      >
        <div className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-line px-6">
          <h2 id={titleId} className="truncate text-lg font-extrabold text-ink">
            {title}
          </h2>
          <IconButton label="Yopish" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-white px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
