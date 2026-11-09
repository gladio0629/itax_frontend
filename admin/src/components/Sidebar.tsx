import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Users,
  Route,
  Wallet,
  SlidersHorizontal,
  MessageSquareWarning,
  UsersRound,
  Headset,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import type { Section, SectionBadges } from "@/api/types";

const NAV: { to: string; section: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { to: "/dashboard", section: "stats", label: "Umumiy statistika", icon: LayoutDashboard },
  { to: "/drivers", section: "drivers", label: "Haydovchilar", icon: Car },
  { to: "/passengers", section: "passengers", label: "Yo'lovchilar", icon: Users },
  { to: "/orders", section: "orders", label: "Buyurtmalar", icon: Route },
  { to: "/wallet", section: "wallet", label: "Hamyon va to'lovlar", icon: Wallet },
  { to: "/tariffs", section: "tariffs", label: "Tariflar", icon: SlidersHorizontal },
  { to: "/complaints", section: "complaints", label: "Shikoyatlar", icon: MessageSquareWarning },
  { to: "/staff", section: "staff", label: "Xodimlar", icon: UsersRound },
  { to: "/operators", section: "operators", label: "Operatorlar", icon: Headset },
  { to: "/audit", section: "audit", label: "Audit jurnali", icon: ClipboardList },
];

export function Sidebar({ sections, badges }: { sections: Section[]; badges: SectionBadges }) {
  const items = NAV.filter((n) => sections.includes(n.section));
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-sidebar-bg text-sidebar-text">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <Logo size={36} />
        <div>
          <p className="text-sm font-semibold text-sidebar-text">IZGO Admin</p>
          <p className="text-xs text-sidebar-text/50">Boshqaruv paneli</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {items.map(({ to, section, label, icon: Icon }) => {
          const badge = badges[section];
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
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-bg">
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
