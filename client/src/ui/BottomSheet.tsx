import { useRef, type ReactNode } from "react";
import { useDialogA11y } from "./useDialogA11y";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";

/**
 * Modal bottom sheet (design v2): white, rounded 32 at the top, grabber,
 * dark translucent backdrop. Closes on backdrop tap, Escape or a drag down
 * on the grabber. Focus is trapped inside while open. With the keyboard
 * open the sheet rises above it.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** Heading; also the dialog's accessible name. */
  title: string;
  children: ReactNode;
  /** Pinned under the content (main button). */
  footer?: ReactNode;
  /** Label for the X button; no X when omitted. */
  closeLabel?: string;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  useDialogA11y(open, onClose, panelRef);
  if (!open) return null;

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (panelRef.current) panelRef.current.style.transition = "none";
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !panelRef.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panelRef.current.style.transform = `translateY(${drag.current.dy}px)`;
  }
  function onPointerUp() {
    const panel = panelRef.current;
    const dy = drag.current?.dy ?? 0;
    drag.current = null;
    if (!panel) return;
    panel.style.transition = "";
    if (dy > 90) onClose();
    else panel.style.transform = "";
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div aria-hidden className="absolute inset-0 animate-[fade-in_160ms_ease-out] bg-[var(--iz-backdrop)]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[88%] flex-col rounded-t-iz-sheet bg-iz-sheet transition-transform duration-200",
          "animate-[ios-sheet-in_260ms_cubic-bezier(0.32,0.72,0,1)]",
          "pb-[max(var(--safe-bottom),16px)] kb:pb-[calc(var(--kb-inset)+12px)]",
          className
        )}
      >
        <div
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-iz-chip-border" />
        </div>
        <div className="flex shrink-0 items-center gap-3 px-5 pb-2">
          <h2 className="min-w-0 flex-1 text-[20px] font-extrabold leading-7 text-iz-ink">{title}</h2>
          {closeLabel && <IconButton icon="close" label={closeLabel} tone="sheet" onClick={onClose} />}
        </div>
        <div className="no-scrollbar flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-2 pt-2">{children}</div>
        {footer && <div className="flex shrink-0 flex-col gap-1 px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}
