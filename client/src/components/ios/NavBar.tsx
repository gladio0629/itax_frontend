import { useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Menu } from "@/lib/icons";
import { ShellNavContext } from "@/lib/shellNav";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/** Large-title row height: 41px line + 3px top + 8px bottom (UIKit's 52pt). */
const LARGE_TITLE_H = 52;
/** iOS truncates the back label to "Back" when the previous title is long. */
const BACK_LABEL_MAX = 12;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Main scroll areas of a screen (sheets' own scrollers are ignored). */
function isMainScroller(el: EventTarget | null): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    el.matches(".scroll-pb, .scroll-pb-bar") &&
    !el.closest('[role="dialog"], [role="alertdialog"]')
  );
}

/**
 * iOS navigation bar (iOS mode only; ScreenHeader / PageTitle render it).
 *
 * An overlay at the top of the screen: 44px + the status-bar inset, with a
 * translucent blurred material that appears once content scrolls under it
 * (transparent at the scroll edge, as on iOS 15+). The screen's scroll area
 * reserves the bar's height as padding (design/ios.css, via --nav-inset), so
 * content scrolls underneath the material.
 *
 * `large`: a 34pt Large Title below the bar that moves up with the content
 * and hands over to the small centred title once it has passed under the bar;
 * on pull-down it follows the content and grows slightly, like UIKit.
 * `accessory` (e.g. a segmented control) sits under the large title and pins
 * below the bar when collapsed.
 *
 * Everything is driven by transforms/opacity from the scroll position in a
 * rAF — no layout changes, so the scroller never resizes while scrolling.
 */
export function NavBar({
  title,
  large,
  right,
  accessory,
  scrollKey,
}: {
  title: string;
  large?: boolean;
  right?: ReactNode;
  accessory?: ReactNode;
  /** Change it when the visible scroll area changes (e.g. History tabs). */
  scrollKey?: string | number;
}) {
  const nav = useContext(ShellNavContext);
  const { t } = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const smallTitleRef = useRef<HTMLElement>(null);
  const largeRef = useRef<HTMLDivElement>(null);
  const accRef = useRef<HTMLDivElement>(null);
  const metrics = useRef({ bar: 0, acc: 0 });
  const lastY = useRef(0);
  const frame = useRef(0);
  const sideLeftRef = useRef<HTMLDivElement>(null);
  const sideRightRef = useRef<HTMLDivElement>(null);
  const titleBoxRef = useRef<HTMLDivElement>(null);
  // Back label as space allows, like UIKit: previous title → "Orqaga" → chevron only.
  const [backMode, setBackMode] = useState<0 | 1 | 2>(0);

  useLayoutEffect(() => nav?.registerBar(title), [nav, title]);

  function paint(y: number) {
    const { acc } = metrics.current;
    if (large) {
      const c = clamp(y, 0, LARGE_TITLE_H);
      if (largeRef.current) {
        largeRef.current.style.transform =
          y < 0 ? `translateY(${-y}px) scale(${1 + Math.min(-y, 120) / 900})` : `translateY(${-c}px)`;
      }
      if (accRef.current) accRef.current.style.transform = `translateY(${y < 0 ? -y : -c}px)`;
      const handover = clamp((y - (LARGE_TITLE_H - 14)) / 14, 0, 1);
      if (smallTitleRef.current) smallTitleRef.current.style.opacity = String(handover);
      if (bgRef.current) bgRef.current.style.opacity = String(handover);
    } else if (bgRef.current) {
      bgRef.current.style.opacity = String(clamp(y / 8, 0, 1));
    }
    if (bgRef.current) bgRef.current.style.height = `${metrics.current.bar + acc}px`;
  }

  function schedule(y: number) {
    lastY.current = y;
    if (!frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        paint(lastY.current);
      });
  }

  // Measure, publish --nav-inset for the scroll area, and follow its scroll.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const screen = root?.parentElement;
    if (!root || !screen) return;
    screen.setAttribute("data-ios-nav", "");

    const measure = () => {
      const bar = barRef.current?.offsetHeight ?? 0;
      const acc = accRef.current?.offsetHeight ?? 0;
      metrics.current = { bar, acc };
      screen.style.setProperty("--nav-inset", `${bar + (large ? LARGE_TITLE_H : 0) + acc}px`);
      paint(lastY.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);

    const onScroll = (e: Event) => {
      if (isMainScroller(e.target)) schedule(e.target.scrollTop);
    };
    screen.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      ro.disconnect();
      screen.removeEventListener("scroll", onScroll, { capture: true });
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      screen.removeAttribute("data-ios-nav");
      screen.style.removeProperty("--nav-inset");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [large]);

  // A different scroll area became visible (tab switch): resync to it.
  useLayoutEffect(() => {
    const screen = rootRef.current?.parentElement;
    if (!screen) return;
    const active = [...screen.querySelectorAll<HTMLElement>(".scroll-pb, .scroll-pb-bar")].find(
      (el) => isMainScroller(el) && !el.closest("[inert]")
    );
    schedule(active?.scrollTop ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  const backTitle = nav?.backTitle;
  const fullLabel = backTitle && backTitle.length <= BACK_LABEL_MAX ? backTitle : t("common.back");
  const backLabel = backMode === 0 ? fullLabel : backMode === 1 ? t("common.back") : "";

  useLayoutEffect(() => setBackMode(0), [title, fullLabel]);

  // Keep the small title centred between the side controls; if it would be
  // cut off, shorten the back label first.
  useLayoutEffect(() => {
    const lw = sideLeftRef.current?.offsetWidth ?? 0;
    const rw = sideRightRef.current?.offsetWidth ?? 0;
    const box = titleBoxRef.current;
    const heading = smallTitleRef.current;
    if (!box || !heading) return;
    const side = Math.max(lw, rw, 52) + 8;
    box.style.left = `${side}px`;
    box.style.right = `${side}px`;
    if (!large && heading.scrollWidth > heading.clientWidth + 1 && backMode < 2 && nav?.leading === "back") {
      setBackMode((m) => (m < 2 ? ((m + 1) as 1 | 2) : m));
    }
  });

  return (
    <div ref={rootRef} className="ios-nav-overlay pointer-events-none absolute inset-x-0 top-0 z-30">
      {/* Bar material: covers the bar and a pinned accessory; fades in as content goes under it. */}
      <div
        ref={bgRef}
        aria-hidden="true"
        className="ios-sep absolute inset-x-0 top-0 bg-[var(--ios-bar-bg)] opacity-0 backdrop-blur-xl backdrop-saturate-[1.8]"
        style={{ ["--sep-inset" as string]: "0px" }}
      />

      <div ref={barRef} className="relative" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="relative flex h-11 items-center justify-between px-2">
          <div ref={sideLeftRef} className="pointer-events-auto relative z-[1] flex min-w-[44px] items-center">
            {nav?.leading === "back" && (
              <button
                type="button"
                onClick={nav.goBack}
                className="ios-body flex h-11 max-w-[42vw] items-center gap-[5px] pl-1 pr-2 text-accent transition-opacity active:opacity-40"
              >
                <svg width="13" height="21" viewBox="0 0 13 21" aria-hidden="true" className="shrink-0">
                  <path d="M11 1.5 2.5 10.5l8.5 9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only">{t("common.back")}: </span>
                {backLabel ? <span className="truncate">{backLabel}</span> : <span className="sr-only">{fullLabel}</span>}
              </button>
            )}
            {nav?.leading === "menu" && (
              <button
                type="button"
                onClick={nav.openDrawer}
                aria-label={t("drawer.open")}
                className="flex h-11 w-11 items-center justify-center text-accent transition-opacity active:opacity-40"
              >
                <Menu className="h-6 w-6" strokeWidth={2.2} />
              </button>
            )}
          </div>
          <div ref={titleBoxRef} className="pointer-events-none absolute inset-y-0 flex items-center justify-center" style={{ left: 96, right: 96 }}>
          {large ? (
            <p
              ref={smallTitleRef as React.RefObject<HTMLParagraphElement>}
              aria-hidden="true"
              className="ios-headline min-w-0 max-w-full truncate text-center text-ink opacity-0"
            >
              {title}
            </p>
          ) : (
            <h1
              ref={smallTitleRef as React.RefObject<HTMLHeadingElement>}
              className="ios-headline min-w-0 max-w-full truncate text-center text-ink"
            >
              {title}
            </h1>
          )}
          </div>
          <div ref={sideRightRef} className="pointer-events-auto relative z-[1] flex min-w-[44px] items-center justify-end">{right}</div>
        </div>
      </div>

      {(large || accessory) && (
        // Clips the large title as it slides under the bar (top edge only, so
        // the pull-down stretch isn't cut off).
        <div className="relative" style={{ clipPath: "inset(0 0 -400px 0)" }}>
          {large && (
            <div ref={largeRef} className="origin-left px-4 pt-[3px] will-change-transform" style={{ height: LARGE_TITLE_H }}>
              <h1 className="ios-large-title truncate text-ink">{title}</h1>
            </div>
          )}
          {accessory && (
            <div ref={accRef} className={cn("pointer-events-auto px-4 pb-2 pt-1 will-change-transform")}>
              {accessory}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
