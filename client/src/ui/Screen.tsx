import { useContext, useEffect, useRef, type ReactNode } from "react";
import { ShellNavContext } from "@/lib/shellNav";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import { useLiftFloatingControl } from "@/stores/floatingControlStore";
import { useStatusBar } from "./statusBar";
import { IconButton } from "./Button";

/**
 * Header row of the dark top: 44px back button, 17px title, right slot.
 * The right slot keeps a 44px spacer so the title stays centred.
 */
export function HeaderBar({
  title,
  onBack,
  backLabel,
  right,
  className,
}: {
  title?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  className?: string;
}) {
  const { t } = useT();
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {onBack ? <IconButton icon="back" label={backLabel ?? t("common.back")} onClick={onBack} /> : <span className="h-11 w-11 shrink-0" aria-hidden />}
      {title != null && <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-bold text-iz-head-text">{title}</h1>}
      {right ?? <span className="h-11 w-11 shrink-0" aria-hidden />}
    </div>
  );
}

/** Step dots in the dark top of the order flows (1 Safar — 2 — 3). */
export function Steps({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex items-center gap-2.5">
      {steps.map((name, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={i} className={cn("flex items-center gap-2.5", i > 0 && "flex-1")} aria-current={active ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={cn("h-0.5 flex-1 rounded-full", done || active ? "bg-iz-green" : "bg-iz-head-border")} />}
            <span
              className={cn(
                "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold",
                active || done ? "bg-iz-green text-iz-on-green" : "border-2 border-iz-head-border-strong text-iz-head-muted"
              )}
            >
              {i + 1}
            </span>
            {active && <span className="text-[13px] font-bold text-iz-head-text">{name}</span>}
            {!active && <span className="sr-only">{name}</span>}
          </li>
        );
      })}
    </ol>
  );
}

type ScreenProps = {
  title?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  headerRight?: ReactNode;
  /** Under the header row on the dark top (big number, steps, profile card).
   * Hidden while the keyboard is open — the dark top shrinks. */
  top?: ReactNode;
  /** Like `top`, but stays visible with the keyboard open. */
  topKeep?: ReactNode;
  /** Pinned under the sheet's scroll area (the main button). Stays above
   * the keyboard. */
  footer?: ReactNode;
  children: ReactNode;
  /** Classes for the scrollable sheet body (padding, gap). */
  bodyClassName?: string;
  /** Content overlapping the sheet's top edge (Account avatar). */
  sheetOverlap?: ReactNode;
  /** Replace the default header row entirely. */
  header?: ReactNode;
};

/**
 * The "Tungi yo'l" screen: dark top (title and the most important number),
 * then a big white sheet rounded 32 at the top with the fields and lists.
 *
 * Keyboard open (html[data-kb=open]): the dark top loses `top` and most of
 * its padding; the sheet's footer sits right above the keyboard
 * (`--kb-inset` covers browsers where the web view does not shrink).
 */
export function Screen({
  title,
  onBack,
  backLabel,
  headerRight,
  top,
  topKeep,
  footer,
  children,
  bodyClassName,
  sheetOverlap,
  header,
}: ScreenProps) {
  useStatusBar("light");
  const shell = useShellChrome();
  const { t } = useT();
  // Inside the app shell the header's leading button is the shell's: the
  // menu on top-level screens (design: arrow back to the Menu), back elsewhere.
  const back = onBack ?? shell?.action;
  const label = backLabel ?? (onBack ? undefined : shell?.leading === "menu" ? t("drawer.open") : undefined);
  return (
    <div className="flex h-full min-h-0 flex-col bg-iz-head">
      <div
        className="flex shrink-0 flex-col gap-5 px-5 pb-6 pt-[calc(var(--safe-top)+12px)] transition-[padding] kb:gap-3 kb:pb-3"
      >
        {header ?? <HeaderBar title={title} onBack={back} backLabel={label} right={headerRight} />}
        {topKeep}
        {top && <div className="flex flex-col gap-5 kb:hidden">{top}</div>}
      </div>
      <Sheet overlap={sheetOverlap} footer={footer} bodyClassName={bodyClassName}>
        {children}
      </Sheet>
    </div>
  );
}

/** The white sheet of a Screen; usable alone under a custom top (maps). */
export function Sheet({
  children,
  footer,
  bodyClassName,
  overlap,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  overlap?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative flex min-h-0 flex-1 flex-col rounded-t-iz-sheet bg-iz-sheet", className)}>
      {overlap}
      <div className={cn("no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-4 pt-6", bodyClassName)}>
        {children}
      </div>
      {footer && <SheetFooter>{footer}</SheetFooter>}
      {!footer && <div aria-hidden className="h-[var(--safe-bottom)] shrink-0 kb:h-[var(--kb-inset)]" />}
    </section>
  );
}

/** Sheet footer; registers itself so the sample-data test button never covers the main button. */
function SheetFooter({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLiftFloatingControl(ref);
  return (
    <div ref={ref} className="flex shrink-0 flex-col gap-1 px-5 pb-[calc(max(var(--safe-bottom),16px)+8px)] pt-3 kb:pb-[calc(var(--kb-inset)+12px)]">
      {children}
    </div>
  );
}

/**
 * For screens that draw their own top controls inside AppShell: hides the
 * shell's floating menu/back button while mounted, and returns what the
 * leading button should do. Null outside the shell (login screens).
 */
export function useShellChrome() {
  const nav = useContext(ShellNavContext);
  const claim = nav?.claimChrome;
  useEffect(() => (claim ? claim() : undefined), [claim]);
  if (!nav) return null;
  return {
    leading: nav.leading,
    openDrawer: nav.openDrawer,
    action: nav.leading === "menu" ? nav.openDrawer : nav.goBack,
  };
}
