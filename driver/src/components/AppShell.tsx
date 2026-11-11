import { Suspense, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { TabBar } from "./TabBar";
import { useSession } from "@/stores/sessionStore";
import { useQuery } from "@/lib/useQuery";
import { api } from "@/api/client";
import { RouteFallback } from "./RouteFallback";

/** Tab-bar layout for every signed-in screen. The tab bar stays on sub-pages. */
export function AppShell() {
  const session = useSession((s) => s.session);
  const location = useLocation();
  const summary = useQuery(() => api.getHomeSummary(), [location.pathname], { pollMs: 15000 });

  useEffect(() => {
    document.getElementById("app-main")?.focus({ preventScroll: true });
  }, [location.pathname]);

  if (session && session.stage !== "active") return <Navigate to="/register" replace />;

  const debtWarn = summary.data && summary.data.debt.level !== "ok";
  return (
    <div className="flex h-full flex-col">
      <main id="app-main" tabIndex={-1} className="relative min-h-0 flex-1 outline-none">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <TabBar badge={{ "/wallet": !!debtWarn }} />
    </div>
  );
}
