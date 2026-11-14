import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

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
 * Modal bottom sheet — height fits content (max 88%), swipe the handle down,
 * tap the backdrop or press Escape to dismiss.
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
      <div className="absolute inset-0 animate-fade-in bg-black/40 ios:bg-[var(--ios-backdrop)] ios:backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 flex max-h-[88%] animate-slide-up flex-col rounded-t-sheet bg-card shadow-soft will-change-transform ios:animate-ios-sheet-in ios:shadow-none"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pt-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-hidden="true"
        >
          <div className="h-1.5 w-10 rounded-full bg-ink/15 ios:h-[5px] ios:w-9 ios:bg-[var(--ios-grabber)]" />
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

export type SnapPoint = "collapsed" | "half" | "full";

const SNAP_ORDER: SnapPoint[] = ["collapsed", "half", "full"];

// The full snap stops below the row of floating map controls (hamburger,
// greeting, bell — 44px tall at safe-top + 16px) plus a 24px gap, so the sheet
// never slices through them.
const FULL_TOP_CLEARANCE = 84;

function snapHeights(containerH: number, safeTop: number): Record<SnapPoint, number> {
  const full = Math.max(0, containerH - safeTop - FULL_TOP_CLEARANCE);
  return {
    collapsed: Math.min(full, Math.max(280, Math.min(360, containerH * 0.44))),
    half: Math.min(full, containerH * 0.6),
    full,
  };
}

type DragSheetProps = {
  snap: SnapPoint;
  onSnapChange: (snap: SnapPoint) => void;
  children: ReactNode;
  ariaLabel: string;
  /** Accessible name for the drag handle, which is also a button (tap or ↑/↓ keys change the snap). */
  handleLabel: string;
  /** Settled visible height in px, e.g. so floating chrome can sit above the sheet. */
  onVisibleHeightChange?: (px: number) => void;
};

/**
 * Three-snap-point draggable sheet for the home order flow. The panel is
 * always the full-snap height and moves with translateY (compositor-only);
 * layout is measured in effects, never during render. Snapping is
 * position-based (nearest snap point on release).
 */
export function DragSheet({ snap, onSnapChange, children, ariaLabel, handleLabel, onVisibleHeightChange }: DragSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ h: 0, safeTop: 0 });
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const parent = sheetRef.current?.parentElement;
    if (!parent) return;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;height:var(--safe-top)";
    const measure = () => {
      parent.appendChild(probe);
      const safeTop = probe.offsetHeight;
      probe.remove();
      setBox({ h: parent.clientHeight, safeTop });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const heights = snapHeights(box.h, box.safeTop);
  const visible = dragHeight ?? heights[snap];

  useEffect(() => {
    if (box.h) onVisibleHeightChange?.(heights[snap]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, box.h, box.safeTop]);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, startHeight: heights[snap], moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY;
    if (Math.abs(dy) > 4) drag.current.moved = true;
    if (!drag.current.moved) return;
    setDragHeight(Math.max(heights.collapsed * 0.7, Math.min(heights.full, drag.current.startHeight + dy)));
  }
  function onPointerUp() {
    if (!drag.current) return;
    const moved = drag.current.moved;
    const current = dragHeight ?? heights[snap];
    drag.current = null;
    setDragHeight(null);
    if (!moved) return;
    let nearest: SnapPoint = snap;
    let best = Infinity;
    for (const point of SNAP_ORDER) {
      const d = Math.abs(heights[point] - current);
      if (d < best) {
        best = d;
        nearest = point;
      }
    }
    onSnapChange(nearest);
  }
  function step(delta: number) {
    const i = SNAP_ORDER.indexOf(snap);
    const next = SNAP_ORDER[Math.max(0, Math.min(SNAP_ORDER.length - 1, i + delta))];
    if (next !== snap) onSnapChange(next);
  }

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label={ariaLabel}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-sheet bg-card shadow-soft will-change-transform"
      style={{
        height: heights.full,
        transform: `translateY(${heights.full - visible}px)`,
        transition: dragHeight == null ? "transform 300ms cubic-bezier(0.2,0.8,0.2,1)" : "none",
        visibility: box.h ? undefined : "hidden",
      }}
    >
      <button
        type="button"
        aria-label={handleLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          // Pointer taps are handled (or ignored) in onPointerUp; this is the keyboard Enter/Space path.
          if (e.detail === 0) step(snap === "collapsed" ? 1 : -1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          }
        }}
        className="flex h-11 w-full shrink-0 cursor-grab touch-none items-center justify-center rounded-t-sheet"
      >
        <span className="h-1.5 w-10 rounded-full bg-ink/15 ios:h-[5px] ios:w-9 ios:bg-[var(--ios-grabber)]" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar">{children}</div>
    </div>
  );
}
