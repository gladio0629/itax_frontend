import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ErrorState } from "@/components/ErrorState";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useAuthStore } from "@/stores/authStore";
import { PageHeaderContext, usePageHeaderSlots } from "./PageHeader";
import { OpRequestHost } from "@/features/ops/OpRequestModal";
import type { SectionBadges } from "@/api/types";


export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { me, error: meError, loading: meLoading, retry } = usePermissions();
  const [badges, setBadges] = useState<SectionBadges>({});
  const slots = usePageHeaderSlots();

  useEffect(() => {
    if (!me || !api.capabilities.sectionBadges) return;
    api.getSectionBadges().then(setBadges).catch(() => {});
  }, [me, location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const { warning, secondsLeft, extend } = useIdleLogout(handleLogout);

  return (
    <PageHeaderContext.Provider value={{ titleEl: slots.titleEl, actionsEl: slots.actionsEl, claim: slots.claim }}>
      <div className="flex h-screen bg-surface">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-green px-4 py-2 text-sm font-extrabold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Asosiy kontentga o'tish
        </a>
        <Sidebar me={me} badges={badges} onLogout={handleLogout} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header titleRef={slots.setTitleEl} actionsRef={slots.setActionsEl} />
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-6 outline-none lg:px-8 lg:pt-7">
            <div className="flex min-w-0 flex-col gap-5">
              {meError && !me ? (
                <ErrorState message="Hisob ruxsatlarini yuklab bo'lmadi. Qayta urinib ko'ring." onRetry={retry} retrying={meLoading} />
              ) : (
                <Outlet />
              )}
              {/* "Menejerga so'rov" for ?request=<kind>:<id> on any operator page. */}
              <OpRequestHost />
            </div>
          </main>
        </div>

        <Modal
          open={warning}
          onClose={extend}
          width={440}
          title="Harakatsizlik tufayli chiqasiz"
          description={`${secondsLeft} soniyadan so'ng tizimdan avtomatik chiqasiz.`}
          icon={<Clock className="h-6 w-6" aria-hidden />}
          iconTone="warning"
          footer={
            <>
              <Button variant="soft" onClick={handleLogout}>
                Chiqish
              </Button>
              <Button onClick={extend} autoFocus>
                Davom etish
              </Button>
            </>
          }
        />
      </div>
    </PageHeaderContext.Provider>
  );
}
