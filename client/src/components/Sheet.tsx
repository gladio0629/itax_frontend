import { useEffect, useRef, useState, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function useSheetA11y(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLDivElement>) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

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
  }, [open, onClose, panelRef]);
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel: string;
};

/**
 * Simple modal bottom sheet — fixed height to content, swipe-down or
 * backdrop tap to dismiss. For the multi-snap-point drag sheet used by the
 * home order flow, see `DragSheet` below.
 */
export function Sheet({ open, onClose, children, ariaLabel }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  useSheetA11y(open, onClose, panelRef);

  if (!open) return null;

  function onPointerDown(e: React.PointerEvent) {
    dragStartY.current = e.clientY;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStartY.current == null || !panelRef.current) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    panelRef.current.style.transform = `translateY(${dy}px)`;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragStartY.current == null || !panelRef.current) return;
    const dy = e.clientY - dragStartY.current;
    panelRef.current.style.transform = "";
    dragStartY.current = null;
    if (dy > 90) onClose();
  }

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 flex max-h-[88%] animate-slide-up flex-col rounded-t-sheet bg-card shadow-soft will-change-transform"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center bg-card pt-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="h-1.5 w-10 rounded-full bg-ink/15" />
        </div>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

export type SnapPoint = "collapsed" | "half" | "full";

type DragSheetProps = {
  snap: SnapPoint;
  onSnapChange: (snap: SnapPoint) => void;
  heightsVh: Record<SnapPoint, number>;
  children: ReactNode;
  ariaLabel: string;
};

const SNAP_ORDER: SnapPoint[] = ["collapsed", "half", "full"];

/**
 * Three-snap-point draggable sheet for the home order flow. Snapping is
 * position-based (nearest snap point on release), not velocity-based —
 * a deliberate simplification for this demo.
 */
export function DragSheet({ snap, onSnapChange, heightsVh, children, ariaLabel }: DragSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  function pxHeight(pct: number) {
    const containerHeight = containerRef.current?.parentElement?.clientHeight ?? window.innerHeight;
    return (pct / 100) * containerHeight;
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, startHeight: pxHeight(heightsVh[snap]) };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY;
    const min = pxHeight(heightsVh.collapsed) * 0.7;
    const max = pxHeight(heightsVh.full);
    setDragHeight(Math.max(min, Math.min(max, drag.current.startHeight + dy)));
  }
  function onPointerUp() {
    if (!drag.current) return;
    const current = dragHeight ?? pxHeight(heightsVh[snap]);
    let nearest: SnapPoint = snap;
    let best = Infinity;
    for (const point of SNAP_ORDER) {
      const d = Math.abs(pxHeight(heightsVh[point]) - current);
      if (d < best) {
        best = d;
        nearest = point;
      }
    }
    drag.current = null;
    setDragHeight(null);
    onSnapChange(nearest);
  }

  const height = dragHeight ?? pxHeight(heightsVh[snap]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={ariaLabel}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-sheet bg-card shadow-soft"
      style={{ height, transition: dragHeight == null ? "height 300ms cubic-bezier(0.2,0.8,0.2,1)" : "none" }}
    >
      <div
        className="flex shrink-0 cursor-grab touch-none items-center justify-center py-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="h-1.5 w-10 rounded-full bg-ink/15" />
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain no-scrollbar">{children}</div>
    </div>
  );
}
