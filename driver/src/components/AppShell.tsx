import { Suspense, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { TabBar } from "./TabBar";
import { useSession } from "@/stores/sessionStore";
import { useQuery } from "@/lib/useQuery";
import { api } from "@/api/client";
import { RouteFallback } from "./RouteFallback";
import { ChunkBoundary } from "./ChunkBoundary";
import { useT } from "@/lib/i18n/provider";
import { useFeedSignal } from "@/stores/feedSignal";
import { RequestBanner } from "./RequestBanner";

/** Tab-bar layout for every signed-in screen. The tab bar stays on sub-pages. */
export function AppShell() {
  const session = useSession((s) => s.session);
  const { t } = useT();
  const location = useLocation();
  const signal = useFeedSignal((s) => s.version);
  const summary = useQuery(() => api.getHomeSummary(), [location.pathname, signal], { pollMs: 15000 });

  useEffect(() => {
    document.getElementById("app-main")?.focus({ preventScroll: true });
  }, [location.pathname]);

  if (session && session.stage !== "active") return <Navigate to="/register" replace />;

  const debtWarn = summary.data && summary.data.debt.level !== "ok";
  return (
    <div className="relative flex h-full flex-col">
      <RequestBanner />
      <a
        href="#app-main"
        className="sr-only z-[70] rounded-button bg-yellow px-4 text-sm font-bold text-on-yellow focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:flex focus:h-12 focus:items-center"
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
      <TabBar badge={{ "/wallet": !!debtWarn, "/": summary.data?.newRequests ?? 0 }} />
    </div>
  );
}
