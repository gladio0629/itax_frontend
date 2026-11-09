import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import type { AdminUser } from "@/api/types";

const TITLES: Record<string, string> = {
  "/dashboard": "Boshqaruv paneli",
  "/verification": "Haydovchilarni tekshirish",
  "/drivers": "Haydovchilar",
  "/passengers": "Yo'lovchilar",
  "/orders": "Buyurtmalar",
  "/wallet": "Hamyon va to'lovlar",
  "/tariffs": "Tariflar",
  "/support": "Qo'llab-quvvatlash",
  "/risk": "Xavf va firibgarlik",
  "/roles": "Rollar",
  "/audit": "Audit jurnali",
  "/settings": "Sozlamalar",
};

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [badges, setBadges] = useState<Partial<Record<string, number>>>({});

  useEffect(() => {
    api.getCurrentAdmin().then(setAdmin).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getDashboardStats()
      .then((s) =>
        setBadges({
          "/verification": s.pendingVerifications || undefined,
          "/support": s.openSupportTickets || undefined,
          "/risk": s.flaggedRiskItems || undefined,
        })
      )
      .catch(() => {});
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const title = TITLES[location.pathname] ?? "IZGO Admin";

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar badges={badges} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} admin={admin} onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
