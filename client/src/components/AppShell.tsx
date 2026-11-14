import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Menu, ArrowLeft, Home, Gift, Clock, Settings } from "@/lib/icons";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Profile } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Drawer } from "@/components/Drawer";
import { useT } from "@/lib/i18n/provider";
import { armPop, clearPendingTransition, setTransitionKind, supportsViewTransitions } from "@/lib/navigation";
import { HeaderToneContext, type HeaderTone } from "@/lib/headerTone";
import { useModalOpen } from "@/lib/useModalOpen";
import { isStandalone, useIsIOS } from "@/lib/platform";
import { ShellNavContext, type ShellNav } from "@/lib/shellNav";
import { IconTile, ListRow, ListSection } from "@/components/ios/List";
import { cn } from "@/lib/cn";

const APP_VERSION = "1.1.0";

const NAV_ITEMS = [
  { to: "/home", labelKey: "drawer.asosiy" as const, icon: Home },
  { to: "/bonus", labelKey: "drawer.bonuslar" as const, icon: Gift },
  { to: "/history", labelKey: "drawer.tarix" as const, icon: Clock },
  { to: "/settings", labelKey: "drawer.sozlamalar" as const, icon: Settings },
];

const TOP_LEVEL_PATHS = new Set(["/home", "/bonus", "/history", "/settings"]);

/** iOS back labels: each history entry's bar title, keyed by its history index. */
const barTitles = new Map<number, string>();
function historyIndex(): number {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" ? idx : 0;
}

/** Edge-swipe back (iOS standalone only): start zone and commit thresholds. */
const EDGE_ZONE = 20;
const COMMIT_FRACTION = 0.35;
const COMMIT_VELOCITY = 0.45; // px per ms

export function AppShell() {
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const ios = useIsIOS();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tone, setToneState] = useState<HeaderTone>("auto");
  const setTone = useCallback((next: HeaderTone) => setToneState(next), []);
  const iconColor = tone === "onDark" ? "text-white" : "text-ink";
  // Screen sheets render inside the screen's own stacking context, below this
  // control; step it out of the way while any modal is open instead.
  const modalOpen = useModalOpen();
  // iOS screens with a navigation bar carry their own menu/back control.
  const [barCount, setBarCount] = useState(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const controlClass = cn(
    "absolute left-4 z-30 flex h-11 w-11 items-center justify-center rounded-xl transition-opacity active:scale-95",
    // iOS (map screens without a bar): a round blurred map button.
    "ios:rounded-full ios:bg-[var(--ios-bar-bg)] ios:shadow-soft ios:backdrop-blur-xl",
    modalOpen && "pointer-events-none opacity-0"
  );

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  // Drawer destinations fade-through rather than slide, per spec.
  useEffect(() => {
    if (open) setTransitionKind("fade");
    else if (ios) clearPendingTransition();
  }, [open, ios]);

  // One floating control for every screen: the hamburger on top-level drawer
  // destinations, a back arrow on nested pages. ScreenHeader/PageTitle only
  // reserve the matching 44px row so titles centre on it.
  const isTopLevel = TOP_LEVEL_PATHS.has(location.pathname);

  const goBack = useCallback(
    (animated = true) => {
      setTransitionKind("pop");
      if (ios) armPop(animated ? "pop" : "none");
      if (window.history.state?.idx > 0) navigate(-1);
      else {
        if (ios) setTransitionKind(animated ? "pop" : "none");
        navigate("/home", { replace: true });
      }
    },
    [ios, navigate]
  );

  // Home has no bar, but it is a back destination: give it a title.
  if (location.pathname === "/home") barTitles.set(historyIndex(), t("drawer.asosiy"));

  const registerBar = useCallback((title: string) => {
    barTitles.set(historyIndex(), title);
    setBarCount((n) => n + 1);
    return () => setBarCount((n) => n - 1);
  }, []);

  const idx = historyIndex();
  const shellNav = useMemo<ShellNav>(
    () => ({
      leading: isTopLevel ? "menu" : "back",
      openDrawer: () => setOpen(true),
      goBack: () => goBack(true),
      backTitle: idx > 0 ? barTitles.get(idx - 1) ?? null : null,
      registerBar,
    }),
    // location.key: recompute the back title on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTopLevel, goBack, registerBar, idx, location.key]
  );

  // Standalone (home-screen) iOS app only: swipe from the left edge to go
  // back. In Safari the browser owns that edge, so no gesture there. The page
  // follows the finger over the grouped background (there is a single route
  // outlet, so the previous screen isn't rendered underneath), then pops
  // without a second animation.
  useEffect(() => {
    const shell = shellRef.current;
    if (!ios || !isStandalone() || isTopLevel || !shell) return;
    let start: { x: number; y: number } | null = null;
    let active = false;
    let dx = 0;
    let last = { x: 0, t: 0 };
    let vx = 0;

    const page = () => pageRef.current;
    const reset = (animate: boolean) => {
      const el = page();
      if (!el) return;
      el.style.transition = animate ? "transform 300ms cubic-bezier(0.32,0.72,0,1)" : "";
      el.style.transform = "";
      el.style.boxShadow = "";
    };

    const onStart = (e: TouchEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const touch = e.touches[0];
      const left = shell.getBoundingClientRect().left;
      if (!touch || touch.clientX - left > EDGE_ZONE) return;
      start = { x: touch.clientX, y: touch.clientY };
      active = false;
      dx = 0;
      last = { x: touch.clientX, t: e.timeStamp };
      vx = 0;
    };
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!start || !touch) return;
      const mx = touch.clientX - start.x;
      const my = touch.clientY - start.y;
      if (!active) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
          start = null;
          return;
        }
        if (mx < 8 || mx < Math.abs(my) * 1.2) return;
        active = true;
      }
      e.preventDefault();
      dx = Math.max(0, mx);
      const dt = e.timeStamp - last.t;
      if (dt > 0) vx = (touch.clientX - last.x) / dt;
      last = { x: touch.clientX, t: e.timeStamp };
      const el = page();
      if (el) {
        el.style.transition = "none";
        el.style.transform = `translateX(${dx}px)`;
        el.style.boxShadow = "-8px 0 24px rgba(0,0,0,0.14)";
      }
    };
    const onEnd = () => {
      if (!start) return;
      start = null;
      if (!active) return;
      active = false;
      const width = shell.clientWidth;
      const el = page();
      if (el && (dx > width * COMMIT_FRACTION || vx > COMMIT_VELOCITY)) {
        el.style.transition = "transform 220ms cubic-bezier(0.32,0.72,0,1)";
        el.style.transform = `translateX(${width}px)`;
        window.setTimeout(() => goBack(false), 220);
      } else {
        reset(true);
      }
    };

    shell.addEventListener("touchstart", onStart, { passive: true });
    shell.addEventListener("touchmove", onMove, { passive: false });
    shell.addEventListener("touchend", onEnd);
    shell.addEventListener("touchcancel", onEnd);
    return () => {
      shell.removeEventListener("touchstart", onStart);
      shell.removeEventListener("touchmove", onMove);
      shell.removeEventListener("touchend", onEnd);
      shell.removeEventListener("touchcancel", onEnd);
    };
  }, [ios, isTopLevel, goBack, location.pathname]);

  // The floating control is replaced by the iOS bar wherever a bar is shown.
  const showFloating = !(ios && barCount > 0);
  // iOS with view transitions: the slide is the page transition; no extra fade.
  const pageAnimation = ios && supportsViewTransitions() ? "" : "animate-fade-in";

  useLayoutEffect(() => {
    pageRef.current?.style.removeProperty("transform");
  }, [location.pathname]);

  return (
    <ShellNavContext.Provider value={shellNav}>
    <HeaderToneContext.Provider value={setTone}>
    <div ref={shellRef} className="relative h-full w-full overflow-hidden">
      {showFloating &&
        (isTopLevel ? (
          <button
            onClick={() => setOpen(true)}
            aria-label={t("drawer.open")}
            aria-hidden={modalOpen || undefined}
            tabIndex={modalOpen ? -1 : undefined}
            className={controlClass}
            style={{ top: "calc(var(--safe-top) + 16px)" }}
          >
            <Menu className={cn("h-6 w-6 drop-shadow-sm transition-colors ios:drop-shadow-none", iconColor)} />
          </button>
        ) : (
          <button
            onClick={() => goBack(true)}
            aria-label={t("common.back")}
            aria-hidden={modalOpen || undefined}
            tabIndex={modalOpen ? -1 : undefined}
            className={controlClass}
            style={{ top: "calc(var(--safe-top) + 16px)" }}
          >
            <ArrowLeft className={cn("h-6 w-6 drop-shadow-sm transition-colors ios:drop-shadow-none", iconColor)} />
          </button>
        ))}

      <Drawer open={open} onClose={() => setOpen(false)} ariaLabel={t("drawer.open")}>
        {ios ? (
          <>
            <div className="px-5 pb-6 pt-6">
              <Avatar seed={profile?.avatarSeed ?? "izgo"} name={profile?.name ?? ""} size={64} />
              <p className="ios-title2 mt-3 truncate text-ink">{profile?.name ?? "—"}</p>
              <p className="ios-subheadline truncate text-[color:var(--ios-label-secondary)]">{profile?.phoneMasked ?? ""}</p>
            </div>
            <ListSection>
              {NAV_ITEMS.map(({ to, labelKey, icon }) => {
                const active = location.pathname === to;
                return (
                  <ListRow
                    key={to}
                    to={to}
                    current={active}
                    onClick={() => {
                      if (!active) setTransitionKind("fade");
                      setOpen(false);
                    }}
                    leading={<IconTile icon={icon} tone={active ? "accent" : "gray"} />}
                    title={t(labelKey)}
                    chevron={false}
                  />
                );
              })}
            </ListSection>
            <p className="ios-footnote mt-auto px-5 pb-4 pt-6 text-[color:var(--ios-label-secondary)]">
              {t("drawer.version", { version: APP_VERSION })}
            </p>
          </>
        ) : (
          <>
        <div className="flex items-center gap-3 border-b border-border px-4 pb-4 pt-5">
          <Avatar seed={profile?.avatarSeed ?? "izgo"} name={profile?.name ?? ""} size={48} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{profile?.name ?? "—"}</p>
            <p className="truncate text-xs text-ink/60">{profile?.phoneMasked ?? ""}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 px-4 py-3">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 text-sm font-normal transition-colors",
                  isActive ? "bg-accent-10 text-accent" : "text-ink/80 hover:bg-ink/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                  {t(labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <p className="mt-auto px-5 pb-4 pt-6 text-xs text-ink/60">
          {t("drawer.version", { version: APP_VERSION })}
        </p>
          </>
        )}
      </Drawer>

      <div ref={pageRef} key={location.pathname} className={cn("vt-root h-full w-full", pageAnimation)}>
        <Outlet />
      </div>
    </div>
    </HeaderToneContext.Provider>
    </ShellNavContext.Provider>
  );
}
