import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Clock, Home, User, Wallet } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

export const TAB_ROOTS = ["/", "/wallet", "/history", "/profile"] as const;
type TabRoot = (typeof TAB_ROOTS)[number];

const TABS = [
  { to: "/", key: "tab.home", icon: Home, end: true },
  { to: "/wallet", key: "tab.wallet", icon: Wallet, end: false },
  { to: "/history", key: "tab.history", icon: Clock, end: false },
  { to: "/profile", key: "tab.profile", icon: User, end: false },
] as const;

type Box = { x: number; y: number; w: number; h: number };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Floating Ink tab bar (radius 32, 24 above the bottom edge). The active
 * tab is a green pill with icon + label; the others are icon-only with an
 * accessible name. `badge`: true shows a dot; a number shows a counter.
 *
 * The green pill is one element under the links that slides to the active
 * tab (FLIP: transform only, 200 ms), so it stays smooth on low-end phones.
 * No slide on first mount (the bar remounts after every sub page) or with
 * reduced motion.
 */
export function TabBar({ badge }: { badge?: Partial<Record<TabRoot, boolean | number>> }) {
  const { t, locale } = useT();
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const last = useRef<Box | null>(null);
  // The icon pop plays only on a tab switch, not when the bar appears.
  const [switched, setSwitched] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const place = (animate: boolean) => {
      const link = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!link) {
        pill.style.opacity = "0";
        last.current = null;
        return;
      }
      const box = { x: link.offsetLeft, y: link.offsetTop, w: link.offsetWidth, h: link.offsetHeight };
      const from = last.current;
      pill.style.opacity = "1";
      pill.style.width = `${box.w}px`;
      pill.style.height = `${box.h}px`;
      pill.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
      if (animate && from && (from.x !== box.x || from.w !== box.w) && !reducedMotion() && pill.animate) {
        pill.animate(
          [
            { transform: `translate3d(${from.x}px, ${box.y}px, 0) scaleX(${from.w / box.w})` },
            { transform: `translate3d(${box.x}px, ${box.y}px, 0)` },
          ],
          { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
      }
      last.current = box;
    };
    place(true);
    // Fonts, language and width changes move the tabs: follow without a slide.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => place(false)) : null;
    ro?.observe(nav);
    nav.querySelectorAll("a").forEach((a) => ro?.observe(a));
    return () => ro?.disconnect();
  }, [pathname, locale]);

  return (
    <nav
      ref={navRef}
      aria-label={t("tab.label")}
      className="on-night absolute inset-x-5 z-30 flex h-[var(--tabbar-h)] items-center justify-between rounded-[32px] bg-night px-2 shadow-float"
      style={{ bottom: "calc(var(--safe-bottom) + var(--tabbar-gap))" }}
    >
      <span
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 origin-left rounded-full bg-brand opacity-0"
      />
      {TABS.map(({ to, key, icon: Icon, end }) => {
        const b = badge?.[to];
        const count = typeof b === "number" && b > 0 ? b : 0;
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSwitched(true)}
            aria-label={count > 0 ? `${t(key)}, ${t("tab.newCount", { n: count })}` : t(key)}
            className={({ isActive }) =>
              cn(
                "press relative z-[1] flex h-12 items-center justify-center gap-2 rounded-full text-sm font-extrabold",
                isActive ? "px-[18px] text-on-brand" : "w-[52px] text-night-muted"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn("relative", isActive && switched && "tab-pop")}>
                  <Icon className={isActive ? "h-5 w-5" : "h-[22px] w-[22px]"} strokeWidth={isActive ? 2.2 : 2} />
                  {count > 0 ? (
                    <span className="tabular absolute -right-2.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-on-brand ring-2 ring-night">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : (
                    b === true && <span className="absolute -right-1 -top-0.5 h-[9px] w-[9px] rounded-full bg-warning-icon ring-2 ring-night" />
                  )}
                </span>
                {isActive && <span aria-hidden="true">{t(key)}</span>}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
