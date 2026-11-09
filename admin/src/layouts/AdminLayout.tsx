import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/Button";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useAuthStore } from "@/stores/authStore";

const TITLES: Record<string, string> = {
  "/dashboard": "Umumiy statistika",
  "/drivers": "Haydovchilar",
  "/passengers": "Yo'lovchilar",
  "/orders": "Buyurtmalar",
  "/wallet": "Hamyon va to'lovlar",
  "/tariffs": "Tariflar",
  "/complaints": "Shikoyatlar",
  "/staff": "Xodimlar",
  "/operator/queue": "Operator: Navbat",
  "/operator/history": "Operator: Tarix",
  "/audit": "Audit jurnali",
  "/account": "Profil",
};

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { me } = usePermissions();
  const [badges, setBadges] = useState<Partial<Record<string, number>>>({});

  useEffect(() => {
    if (!me) return;
    if (me.sections.includes("complaints")) {
      api.getComplaints().then((items) => setBadges((b) => ({ ...b, "/complaints": items.filter((c) => c.status === "open").length || undefined }))).catch(() => {});
    }
    if (me.sections.includes("operatorQueue")) {
      api.getQueue().then((items) => setBadges((b) => ({ ...b, "/operator/queue": items.length || undefined }))).catch(() => {});
    }
  }, [me, location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const { warning, secondsLeft, extend } = useIdleLogout(handleLogout);

  const title = TITLES[location.pathname] ?? "IZGO Admin";

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar sections={me?.sections ?? []} badges={badges} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} me={me} onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>

      {warning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-2xl animate-fade-in">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-ink">Harakatsizlik tufayli chiqasiz</p>
            <p className="mt-1.5 text-sm text-ink/60">
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
