import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  Car,
  Users,
  Route,
  Wallet,
  SlidersHorizontal,
  LifeBuoy,
  AlertTriangle,
  KeySquare,
  History,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/dashboard", label: "Boshqaruv paneli", icon: LayoutDashboard },
  { to: "/verification", label: "Haydovchilarni tekshirish", icon: ShieldCheck },
  { to: "/drivers", label: "Haydovchilar", icon: Car },
  { to: "/passengers", label: "Yo'lovchilar", icon: Users },
  { to: "/orders", label: "Buyurtmalar", icon: Route },
  { to: "/wallet", label: "Hamyon va to'lovlar", icon: Wallet },
  { to: "/tariffs", label: "Tariflar", icon: SlidersHorizontal },
  { to: "/support", label: "Qo'llab-quvvatlash", icon: LifeBuoy },
  { to: "/risk", label: "Xavf va firibgarlik", icon: AlertTriangle },
  { to: "/roles", label: "Rollar", icon: KeySquare },
  { to: "/audit", label: "Audit jurnali", icon: History },
  { to: "/settings", label: "Sozlamalar", icon: Settings },
] as const;

export function Sidebar({ badges }: { badges: Partial<Record<string, number>> }) {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-sidebar-bg text-sidebar-text">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-white font-bold text-sm">IZ</div>
        <div>
          <p className="text-sm font-semibold text-sidebar-text">IZGO Admin</p>
          <p className="text-xs text-sidebar-text/50">Boshqaruv paneli</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {NAV.map(({ to, label, icon: Icon }) => {
          const badge = badges[to];
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-white/10 text-white" : "text-sidebar-text/70 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              {!!badge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-6 py-4 text-[11px] text-sidebar-text/40">
        IZGO Admin · Demo rejimi
      </div>
    </aside>
  );
}
