import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export type RowMenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "danger";
  hidden?: boolean;
};

/**
 * Row "…" menu. The 36px trigger lives inside a table row (the only place
 * 36px controls are allowed). The menu is portalled with fixed position so
 * the table's scroll box can't clip it, and clicks never reach the row.
 * Arrow keys move between items, Escape closes and returns focus.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const visible = items.filter((i) => !i.hidden);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const height = visible.length * 44 + 12;
    const up = r.bottom + height + 8 > window.innerHeight && r.top > height;
    setPos({ top: up ? r.top - height - 6 : r.bottom + 6, left: Math.max(8, r.right - 224), up });
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true });
    const close = () => setOpen(false);
    function onDown(e: MouseEvent) {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close();
    }
    // A fixed menu would drift when the page scrolls: close it then. Start
    // listening a frame later so the opening click's own scroll is ignored.
    const raf = requestAnimationFrame(() => window.addEventListener("scroll", close, true));
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", close);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (visible.length === 0) return null;

  function onMenuKey(e: React.KeyboardEvent) {
    const els = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus({ preventScroll: true });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus({ preventScroll: true });
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      setOpen(false);
      btn.current?.focus();
    }
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink hover:bg-line"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            onClick={(e) => e.stopPropagation()}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[60] w-56 overflow-hidden rounded-field bg-white p-1.5 shadow-pop animate-fade-in"
          >
            {visible.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={cn(
                  "flex h-11 w-full items-center gap-2.5 rounded-box px-3 text-left text-sm font-bold outline-none",
                  it.tone === "danger" ? "text-error hover:bg-error-soft focus:bg-error-soft" : "text-ink hover:bg-surface focus:bg-surface"
                )}
              >
                {it.icon && <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{it.icon}</span>}
                {it.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
