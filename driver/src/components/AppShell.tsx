import { Suspense, useEffect, type CSSProperties } from "react";
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
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </ChunkBoundary>
      </main>
      {showTabs && <TabBar badge={{ "/wallet": !!debtWarn, "/": summary.data?.newRequests ?? 0 }} />}
    </div>
  );
}
