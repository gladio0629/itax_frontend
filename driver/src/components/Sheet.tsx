import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/provider";
import { X } from "@/lib/icons";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Modal bottom sheet (radius 32, the page colour). Fits content up to 88%; drag the handle
 * down, tap the backdrop or press Escape to close. Focus is trapped while
 * open and restored on close.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  hideTitle,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  hideTitle?: boolean;
}) {
  const { t } = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragY = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE))?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onCloseRef.current();
      if (e.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items.length) return;
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
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const node = (
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-night/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 flex max-h-[88%] animate-sheet-up flex-col rounded-t-sheet bg-bg shadow-2"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
      >
        <div
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
          aria-hidden="true"
          onPointerDown={(e) => {
            dragY.current = e.clientY;
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragY.current == null || !panelRef.current) return;
            panelRef.current.style.transform = `translateY(${Math.max(0, e.clientY - dragY.current)}px)`;
          }}
          onPointerUp={(e) => {
            if (dragY.current == null || !panelRef.current) return;
            const dy = e.clientY - dragY.current;
            panelRef.current.style.transform = "";
            dragY.current = null;
            if (dy > 90) onClose();
          }}
        >
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2">
          <h2 className={hideTitle ? "sr-only" : "text-xl font-extrabold text-ink"}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="press ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-raised text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-1">{children}</div>
      </div>
    </div>
  );
  // Portal to the app-level overlay root so the sheet covers the tab bar.
  const root = document.getElementById("overlay-root");
  return root ? createPortal(node, root) : node;
}
