import { Suspense, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useLocationReporting } from "@/lib/useLocationReporting";
import { TAB_ROOTS, TabBar } from "./TabBar";
import { useSession } from "@/stores/sessionStore";
import { useQuery } from "@/lib/useQuery";
import { api } from "@/api/client";
import { RouteFallback } from "./RouteFallback";
import { ChunkBoundary } from "./ChunkBoundary";
import { isKey, useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { useFeedSignal } from "@/stores/feedSignal";
import { RequestBanner } from "./RequestBanner";

/** Path depth: "/" 0, "/wallet" 1, "/wallet/topup" 2… */
const depth = (path: string) => path.split("/").filter(Boolean).length;
const SLIDE_PX = 24;

/**
 * Where the next screen slides in from: between two tab roots, the side of
 * the tab; deeper paths from the right (open), shallower from the left
 * (back); otherwise a plain fade (0). Path depth, not the navigation type,
 * because Back sometimes replaces instead of popping.
 */
function slideFrom(prev: string | null, next: string): -1 | 0 | 1 {
  if (prev === null || prev === next) return 0;
  const roots = TAB_ROOTS as readonly string[];
  const a = roots.indexOf(prev);
  const b = roots.indexOf(next);
  if (a >= 0 && b >= 0) return b > a ? 1 : -1;
  const d = depth(next) - depth(prev);
  return d > 0 ? 1 : d < 0 ? -1 : 0;
}

/** Layout for every signed-in screen. The floating tab bar shows on the four tab roots only. */
export function AppShell() {
  const session = useSession((s) => s.session);
  const { t } = useT();
  const location = useLocation();
  const signal = useFeedSignal((s) => s.version);
  const bump = useFeedSignal((s) => s.bump);
  const refreshSession = useSession((s) => s.refresh);
  const [params] = useSearchParams();
  const summary = useQuery(() => api.getHomeSummary(), [location.pathname, signal], { pollMs: 15000 });

  useEffect(() => {
    document.getElementById("app-main")?.focus({ preventScroll: true });
  }, [location.pathname]);

  // Page transition: keyed on the path only (Home's ?tab= must not replay it).
  const prevPath = useRef<string | null>(null);
  const dir = useMemo(() => slideFrom(prevPath.current, location.pathname), [location.pathname]);
  useEffect(() => {
    prevPath.current = location.pathname;
  }, [location.pathname]);

  // Server pushes (WebSocket): refetch what changed; some come with a notice.
  useEffect(
    () =>
      api.subscribe((e) => {
        if (e.type === "session") refreshSession().catch(() => {});
        else bump();
        if (e.noticeKey && isKey(e.noticeKey)) toast(t(e.noticeKey), "danger");
      }),
    [bump, refreshSession, t]
  );

  // GPS only while the request feed is open or a trip is underway.
  const feedOpen = location.pathname === "/" && params.get("tab") !== "accepted";
  useLocationReporting(feedOpen || !!summary.data?.tripActive);

  if (session && session.stage !== "active") return <Navigate to="/register" replace />;

  const debtWarn = summary.data && summary.data.debt.level !== "ok";
  const showTabs = (TAB_ROOTS as readonly string[]).includes(location.pathname);
  return (
    <div
      className="relative flex h-full flex-col"
      // Room the scroll areas leave for the floating tab bar (.pb-tabbar, Screen footer).
      style={{ "--tabbar-space": showTabs ? "calc(var(--tabbar-h) + var(--tabbar-gap) + var(--safe-bottom))" : "0px" } as CSSProperties}
    >
      <RequestBanner />
      <a
        href="#app-main"
        className="sr-only z-[70] rounded-full bg-brand px-4 text-sm font-bold text-on-brand focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:flex focus:h-12 focus:items-center"
      >
        {t("common.skip")}
      </a>
      <main id="app-main" tabIndex={-1} className="relative min-h-0 flex-1 outline-none">
        <ChunkBoundary key={location.pathname} title={t("error.loadTitle")} action={t("common.retry")}>
          <div className="route-enter h-full" data-dir={dir} style={{ "--route-dx": `${dir * SLIDE_PX}px` } as CSSProperties}>
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </ChunkBoundary>
      </main>
      {showTabs && <TabBar badge={{ "/wallet": !!debtWarn, "/": summary.data?.newRequests ?? 0 }} />}
    </div>
  );
}
