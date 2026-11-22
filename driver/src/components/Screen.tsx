import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/** Top padding of the Ink header: the design's 56 at minimum, more under a tall status bar. */
const TOP_PAD = "max(calc(var(--safe-top) + 12px), 56px)";

/** Below this viewport height the Ink top compresses (keyboard open on Android, where the webview resizes; small phones). */
const COMPACT_MAX_H = 640;

function measureCompact(): boolean {
  const vv = window.visualViewport;
  // iOS: the webview keeps its height and the keyboard covers it (visual viewport shrinks).
  const keyboardOver = vv ? window.innerHeight - vv.height > 150 : false;
  return keyboardOver || window.innerHeight < COMPACT_MAX_H;
}

/**
 * True while the screen is short: the on-screen keyboard is open (either the
 * webview resized, or the keyboard covers it) or the phone is small. The Ink
 * top then gives its room to the sheet and the main button.
 */
export function useKeyboardOpen(): boolean {
  const [compact, setCompact] = useState(() => (typeof window === "undefined" ? false : measureCompact()));
  useEffect(() => {
    const update = () => setCompact(measureCompact());
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);
  return compact;
}

/** 44px round button on the Ink header (back, settings, notifications…). */
export function HeaderButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn("press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-night-line text-white", className)}
    >
      {children}
    </button>
  );
}

export function BackButton({ to }: { to?: string | true }) {
  const { t } = useT();
  const navigate = useNavigate();
  return (
    <HeaderButton
      label={t("common.back")}
      onClick={() => {
        if ((to === true || to === undefined) && window.history.state?.idx > 0) navigate(-1);
        else navigate(typeof to === "string" ? to : "/", { replace: true });
      }}
    >
      <ChevronLeft className="h-5 w-5" />
    </HeaderButton>
  );
}

type Props = {
  /** Screen title. With `back` it is centred (17/700); without, a large tab-root title (26/800). */
  title?: string;
  subtitle?: ReactNode;
  back?: string | true;
  /** Right slot of the title row (44px control). */
  right?: ReactNode;
  /** Replaces the whole title row (Home's greeting, etc.). */
  header?: ReactNode;
  /** Content under the title row on the Ink top (the key number). Hidden while the keyboard is open. */
  top?: ReactNode;
  /** Pinned under the scrolling sheet (main action); stays above the keyboard. */
  footer?: ReactNode;
  children: ReactNode;
  /** Classes for the sheet's scroll area. */
  bodyClassName?: string;
  /** false: the body doesn't scroll (it manages its own layout). */
  scroll?: boolean;
};

/**
 * Redesign v2 screen ("Tungi yo'l"): Ink top with the title and the most
 * important number, then a large rounded sheet (radius 32) with the fields
 * and lists. The sheet scrolls without a visible scrollbar and leaves room
 * for the floating tab bar.
 */
export function Screen({ title, subtitle, back, right, header, top, footer, children, bodyClassName, scroll = true }: Props) {
  const keyboard = useKeyboardOpen();
  return (
    <div className="flex h-full flex-col bg-night">
      <header className="on-night flex shrink-0 flex-col gap-4 px-5 pb-6 text-white" style={{ paddingTop: keyboard ? "calc(var(--safe-top) + 12px)" : TOP_PAD }}>
        {header ??
          (back ? (
            <div className="flex items-center justify-between gap-3">
              <BackButton to={back} />
              <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                {title && <h1 className="truncate text-17 font-bold">{title}</h1>}
                {subtitle && <p className="truncate text-xs font-semibold text-night-muted">{subtitle}</p>}
              </div>
              {right ?? <span className="h-11 w-11 shrink-0" aria-hidden="true" />}
            </div>
          ) : (
            <div className="flex min-h-11 items-center justify-between gap-3">
              <div className="min-w-0">
                {title && <h1 className="truncate text-[26px] font-extrabold leading-8">{title}</h1>}
                {subtitle && <p className="truncate text-13 font-semibold text-night-muted">{subtitle}</p>}
              </div>
              {right}
            </div>
          ))}
        {top && !keyboard && top}
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-sheet bg-bg">
        <div className={cn("min-h-0 flex-1", scroll && "no-scrollbar overflow-y-auto overscroll-contain px-5 pt-6", scroll && !footer && "pb-tabbar", bodyClassName)}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 bg-bg px-5 pt-3" style={{ paddingBottom: "calc(var(--safe-bottom) + var(--tabbar-space, 0px) + 16px)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
