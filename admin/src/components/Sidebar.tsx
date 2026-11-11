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

export const NAV: { to: string; section: Section; label: string; icon: typeof LayoutDashboard }[] = [
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

/**
 * Navy sidebar. ≥1280px: full width with labels. Below that it collapses to an
 * icon rail (labels become tooltips + accessible names) so tables keep room.
 */
export function Sidebar({ sections, badges }: { sections: Section[]; badges: SectionBadges }) {
  const items = NAV.filter((n) => sections.includes(n.section));
  return (
    <aside
      aria-label="Asosiy menyu"
      className="flex h-screen w-[var(--sidebar-rail-w)] shrink-0 flex-col bg-sidebar-bg text-sidebar-text xl:w-[var(--sidebar-w)]"
    >
      <div className="flex h-16 shrink-0 items-center justify-center gap-3 border-b border-sidebar-border px-4 xl:justify-start xl:px-6">
        <Logo size={32} />
        <div className="hidden min-w-0 xl:block">
          <p className="truncate text-sm font-semibold text-white">IZGO Admin</p>
          <p className="truncate text-xs text-sidebar-text/60">Boshqaruv paneli</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map(({ to, section, label, icon: Icon }) => {
            const badge = badges[section];
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  title={label}
                  aria-label={badge ? `${label}, ${badge}` : label}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex h-10 items-center justify-center gap-3 rounded-button px-3 text-sm xl:justify-start",
                      "focus-visible:outline-brand-yellow",
                      isActive ? "bg-white/10 font-semibold text-white" : "text-sidebar-text/70 hover:text-white"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Hover wash fades in (opacity only). */}
                      {!isActive && (
                        <span aria-hidden className="absolute inset-0 rounded-button bg-white/[0.06] opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                      {isActive && <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-brand-yellow" />}
                      <Icon className={cn("relative h-5 w-5 shrink-0", isActive ? "text-brand-yellow" : "text-sidebar-text/60 group-hover:text-white")} aria-hidden />
                      <span className="relative hidden min-w-0 flex-1 truncate xl:block">{label}</span>
                      {!!badge && (
                        <span
                          aria-hidden
                          className={cn(
                            "tabular relative flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-yellow px-1 text-xs font-semibold text-on-yellow",
                            "absolute right-1 top-0 xl:static"
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="h-20 shrink-0 border-t border-sidebar-border xl:flex xl:items-center xl:pl-[72px] xl:pr-6">
        <p className="hidden text-xs text-sidebar-text/60 xl:block">Demo rejimi</p>
      </div>
    </aside>
  );
}
