import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * v2 dialog shell (design: LedgerFix): Ink 45% backdrop, white card radius 24,
 * icon tile + title + description, body, right-aligned footer.
 * Focus moves inside on open, Tab is trapped, Escape closes (unless `busy`),
 * focus returns to the opener on close.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  iconTone = "info",
  children,
  footer,
  busy,
  width = 560,
  role = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  iconTone?: "info" | "green" | "danger" | "warning";
  children?: ReactNode;
  footer?: ReactNode;
  /** While true, Escape/backdrop/close do nothing (a request is running). */
  busy?: boolean;
  width?: number;
  role?: "dialog" | "alertdialog";
}) {
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = panel.current;
    // Respect autoFocus inside; otherwise focus the first control.
    if (node && !node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>("[autofocus]") ?? node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus();
    }
    function onKey(e: KeyboardEvent) {
      if (!node) return;
      if (e.key === "Escape") {
        // Close only the top-most layer.
        e.stopPropagation();
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
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
    node?.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const tiles = {
    info: "bg-info-soft text-info",
    green: "bg-green-soft text-green-text",
    danger: "bg-error-soft text-error",
    warning: "bg-warn-soft text-warn",
  } as const;

  return (
    <div className="fixed inset-0 z-50 !m-0 flex items-center justify-center overflow-y-auto bg-ink/45 p-4 animate-fade-in">
      <div className="absolute inset-0" aria-hidden onClick={() => !busy && onClose()} />
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        style={{ maxWidth: width }}
        className="relative my-auto flex w-full flex-col overflow-hidden rounded-sheet bg-white shadow-pop outline-none animate-scale-in"
      >
        <div className="flex items-start gap-3.5 px-6 pt-6 sm:px-7">
          {icon && <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", tiles[iconTone])}>{icon}</span>}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-22 font-extrabold text-ink">
              {title}
            </h2>
            {description && (
              <span id={descId} className="text-sm leading-5 text-muted">
                {description}
              </span>
            )}
          </span>
          <IconButton label="Yopish" size={40} onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
        {children && <div className="flex flex-col gap-3 px-6 py-5 sm:px-7">{children}</div>}
        {footer && <div className={cn("flex flex-wrap justify-end gap-2.5 px-6 pb-6 sm:px-7", !children && "pt-5")}>{footer}</div>}
      </div>
    </div>
  );
}

/** Grey info strip inside a modal (design: the audit note under the form). */
export function ModalNote({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-field bg-surface px-3.5 py-3 text-13 leading-[19px] text-muted">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
