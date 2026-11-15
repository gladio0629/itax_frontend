import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useIsIOS } from "@/lib/platform";
import { cn } from "@/lib/cn";
import { FloatingClose } from "@/components/ui/CloseButton";

/**
 * UIScrollView-style rubber band: past an edge the sheet follows the finger
 * with diminishing resistance, approaching `dim` asymptotically.
 */
function rubberBand(overshoot: number, dim: number) {
  return (1 - 1 / ((overshoot * 0.55) / dim + 1)) * dim;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useSheetA11y(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLDivElement>) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    // preventScroll: mid slide-in the control is still below the screen, and
    // a plain focus() would scroll the app's overflow-hidden shell to it.
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });

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
  /** Extra classes for the panel (e.g. the iOS grouped background). */
  panelClassName?: string;
  /** White round X floating above the sheet's top edge (reference). */
  floatingCloseLabel?: string;
};

/**
 * Modal bottom sheet — height fits content (max 88%), swipe the handle down,
 * tap the backdrop or press Escape to dismiss.
 */
export function Sheet({ open, onClose, children, ariaLabel, panelClassName, floatingCloseLabel }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragLast = useRef({ y: 0, t: 0, v: 0 });
  const ios = useIsIOS();
  useSheetA11y(open, onClose, panelRef);

  if (!open) return null;

  function onPointerDown(e: React.PointerEvent) {
    dragStartY.current = e.clientY;
    dragLast.current = { y: e.clientY, t: e.timeStamp, v: 0 };
    if (panelRef.current) panelRef.current.style.transition = "none";
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStartY.current == null || !panelRef.current) return;
    const raw = e.clientY - dragStartY.current;
    if (ios) {
      const dt = e.timeStamp - dragLast.current.t;
      if (dt > 0) dragLast.current.v = (e.clientY - dragLast.current.y) / dt;
      dragLast.current.y = e.clientY;
      dragLast.current.t = e.timeStamp;
    }
    // iOS: pulling up stretches with resistance instead of stopping dead.
    const dy = raw >= 0 ? raw : ios ? -rubberBand(-raw, 60) : 0;
    panelRef.current.style.transform = `translateY(${dy}px)`;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragStartY.current == null || !panelRef.current) return;
    const dy = e.clientY - dragStartY.current;
    // iOS: settle back with UIKit timing; a quick downward flick dismisses.
    panelRef.current.style.transition = ios ? "transform 380ms cubic-bezier(0.32,0.72,0,1)" : "";
    panelRef.current.style.transform = "";
    dragStartY.current = null;
    if (dy > 90 || (ios && dy > 20 && dragLast.current.v > 0.6)) onClose();
  }

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="absolute inset-0 animate-fade-in bg-black/40 ios:bg-[var(--ios-backdrop)] ios:backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[88%] animate-slide-up flex-col rounded-t-sheet bg-card shadow-soft will-change-transform ios:animate-ios-sheet-in ios:shadow-none",
          panelClassName
        )}
        style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}
      >
        {floatingCloseLabel && <FloatingClose onClick={onClose} label={floatingCloseLabel} className="absolute -top-[60px] right-3" />}
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
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean; lastY: number; lastT: number; v: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  // iOS detents: rubber band at both ends, flick velocity picks the detent.
  const ios = useIsIOS();

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
    drag.current = { startY: e.clientY, startHeight: heights[snap], moved: false, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY;
    if (Math.abs(dy) > 4) drag.current.moved = true;
    if (!drag.current.moved) return;
    if (ios) {
      const dt = e.timeStamp - drag.current.lastT;
      // Upward velocity in px/ms (positive grows the sheet), lightly smoothed.
      if (dt > 0) drag.current.v = 0.6 * ((drag.current.lastY - e.clientY) / dt) + 0.4 * drag.current.v;
      drag.current.lastY = e.clientY;
      drag.current.lastT = e.timeStamp;
      const raw = drag.current.startHeight + dy;
      const next =
        raw > heights.full
          ? heights.full + rubberBand(raw - heights.full, 120)
          : raw < heights.collapsed
          ? heights.collapsed - rubberBand(heights.collapsed - raw, 120)
          : raw;
      setDragHeight(next);
      return;
    }
    setDragHeight(Math.max(heights.collapsed * 0.7, Math.min(heights.full, drag.current.startHeight + dy)));
  }
  function onPointerUp() {
    if (!drag.current) return;
    const moved = drag.current.moved;
    // iOS: aim at where the flick would carry the sheet, not where it was let go.
    const current = (dragHeight ?? heights[snap]) + (ios ? drag.current.v * 180 : 0);
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
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-sheet bg-card shadow-soft will-change-transform",
        // iOS: a skirt below the sheet so a rubber-band pull past the full
        // detent never shows a gap under it.
        ios && "after:absolute after:inset-x-0 after:top-full after:h-[160px] after:bg-card after:content-['']"
      )}
      style={{
        height: heights.full,
        transform: `translateY(${heights.full - visible}px)`,
        transition:
          dragHeight == null
            ? ios
              ? "transform 480ms cubic-bezier(0.32,0.72,0,1)"
              : "transform 300ms cubic-bezier(0.2,0.8,0.2,1)"
            : "none",
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
