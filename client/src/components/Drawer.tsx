import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel: string;
};

/**
 * Left slide-in drawer, rendered inline (no portal) so it stays confined to
 * PhoneFrame's phone mockup in the desktop preview instead of covering the
 * whole browser window.
 */
export function Drawer({ open, onClose, children, ariaLabel }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  function onPointerDown(e: React.PointerEvent) {
    dragStartX.current = e.clientX;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStartX.current == null || !panelRef.current) return;
    const dx = Math.min(0, e.clientX - dragStartX.current);
    panelRef.current.style.transform = `translateX(${dx}px)`;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragStartX.current == null || !panelRef.current) return;
    const dx = e.clientX - dragStartX.current;
    panelRef.current.style.transform = "";
    dragStartX.current = null;
    if (dx < -70) onClose();
  }

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="absolute inset-0 animate-fade-in bg-black/40 ios:bg-[var(--ios-backdrop)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="absolute inset-y-0 left-0 flex w-[82%] max-w-[320px] flex-col animate-drawer-in overflow-y-auto overscroll-contain bg-card shadow-soft will-change-transform ios:bg-[var(--ios-material)] ios:backdrop-blur-2xl ios:backdrop-saturate-150"
        style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {children}
      </div>
    </div>
  );
}
