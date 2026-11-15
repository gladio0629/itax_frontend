import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useAuthStore } from "@/stores/authStore";
import type { SectionBadges } from "@/api/types";

const TITLES: Record<string, string> = {
  "/dashboard": "Umumiy statistika",
  "/drivers": "Haydovchilar",
  "/passengers": "Yo'lovchilar",
  "/orders": "Buyurtmalar",
  "/wallet": "Hamyon va to'lovlar",
  "/tariffs": "Tariflar",
  "/complaints": "Shikoyatlar",
  "/staff": "Xodimlar",
  "/operators": "Operatorlar",
  "/audit": "Audit jurnali",
  "/account": "Profil",
};

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { me, error: meError, loading: meLoading, retry } = usePermissions();
  const [badges, setBadges] = useState<SectionBadges>({});

  useEffect(() => {
    if (!me || !api.capabilities.sectionBadges) return;
    api.getSectionBadges().then(setBadges).catch(() => {});
  }, [me, location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const { warning, secondsLeft, extend } = useIdleLogout(handleLogout);

  const title = TITLES[location.pathname] ?? "IZGO Admin";

  return (
    <div className="flex h-screen bg-bg">
      <a
        href="#main"
        className="sr-only z-50 rounded-button bg-brand-yellow px-4 py-2 text-sm font-semibold text-on-yellow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Asosiy kontentga o'tish
      </a>
      <Sidebar sections={me?.sections ?? []} badges={badges} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} me={me} onLogout={handleLogout} />
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto outline-none overscroll-contain px-6 py-6 xl:px-8 xl:py-8">
          {/* Content never stretches past 1280px on wide screens. */}
          <div className="mx-auto w-full max-w-[1280px]">
            {meError && !me ? (
              <ErrorState message="Hisob ruxsatlarini yuklab bo'lmadi. Qayta urinib ko'ring." onRetry={retry} retrying={meLoading} />
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>

      {warning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="w-full max-w-sm rounded-sheet bg-card p-6 text-center shadow-2xl animate-fade-in">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-ink">Harakatsizlik tufayli chiqasiz</p>
            <p className="mt-2 text-sm text-ink/60">
              {secondsLeft} soniyadan so'ng avtomatik tizimdan chiqasiz.
            </p>
            <Button fullWidth className="mt-5" onClick={extend}>
              Davom etish
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
