import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { BarChart3, Car, ClipboardList, Clock3, Headset, LogOut, MessageSquareWarning, ScrollText, Search, SlidersHorizontal, UserRound, Users, UsersRound, Wallet, TrendingUp } from "lucide-react";
import { opPath } from "@/features/ops/paths";
import { cn } from "@/lib/cn";
import { ROLE_LABEL } from "@/lib/roles";
import { AdminBrand, Logo } from "./Logo";
import { Avatar } from "./Avatar";
import type { Action, Me, Section, SectionBadges } from "@/api/types";

type NavItem = {
  to: string;
  section: Section;
  label: string;
  icon: typeof Car;
  /** Also needs this action from getMe (operator work vs supervising). */
  action?: Action;
  end?: boolean;
  /** The section's count badge is shown on this item only. */
  noBadge?: boolean;
  /** Other label for someone without that section (marketolog: the
   * Marketing page is their "Umumiy statistika"). */
  altLabel?: { whenMissing: Section; label: string };
};

/** Sidebar groups (design-v2). An item shows only when getMe().sections has
 * its section; a group shows only when it has items. Never a role check. */
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Asosiy",
    items: [
      { to: "/dashboard", section: "stats", label: "Umumiy statistika", icon: BarChart3 },
      { to: "/marketing", section: "marketing", label: "Marketing", icon: TrendingUp, altLabel: { whenMissing: "stats", label: "Umumiy statistika" } },
      { to: "/orders", section: "orders", label: "Buyurtmalar", icon: ClipboardList },
      { to: "/drivers", section: "drivers", label: "Haydovchilar", icon: Car },
      { to: "/passengers", section: "passengers", label: "Yo'lovchilar", icon: Users },
      { to: "/complaints", section: "complaints", label: "Shikoyatlar", icon: MessageSquareWarning },
    ],
  },
  {
    // Operator windows (2026-11-24): shown for the "operatorWork" action.
    // Search and the driver/passenger cards are another terminal's pages,
    // linked by the shared route contract.
    title: "Operator",
    items: [
      { to: opPath.queue, section: "operators", action: "operatorWork", label: "Navbat", icon: Headset },
      { to: opPath.search, section: "operators", action: "operatorWork", label: "Qidiruv", icon: Search, noBadge: true },
      { to: opPath.orders, section: "operators", action: "operatorWork", label: "Buyurtmalar", icon: ClipboardList, noBadge: true },
      { to: opPath.drivers, section: "operators", action: "operatorWork", label: "Haydovchilar", icon: Car, noBadge: true },
      { to: opPath.passengers, section: "operators", action: "operatorWork", label: "Yo'lovchilar", icon: Users, noBadge: true },
      { to: opPath.tasks, section: "operators", action: "operatorWork", label: "Tarix", icon: Clock3, noBadge: true },
    ],
  },
  {
    title: "Pul",
    items: [
      { to: "/wallet", section: "wallet", label: "Hamyon va to'lovlar", icon: Wallet },
      { to: "/tariffs", section: "tariffs", label: "Tariflar", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Jamoa",
    items: [
      { to: "/operators", section: "operators", action: "operatorSupervise", label: "Operatorlar", icon: Headset, end: true },
      { to: "/staff", section: "staff", label: "Xodimlar", icon: UsersRound },
      { to: "/audit", section: "audit", label: "Audit jurnali", icon: ScrollText },
    ],
  },
];

/**
 * Dark v2 sidebar. ≥1280px: 256px with labels and group titles. Below that
 * (down to tablet) it becomes a 76px icon rail: labels turn into tooltips and
 * accessible names, so tables keep their room.
 */
export function Sidebar({ me, badges, onLogout }: { me: Me | null; badges: SectionBadges; onLogout: () => void }) {
  const sections = me?.sections ?? [];
  const actions = me?.actions ?? [];
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => sections.includes(i.section) && (!i.action || actions.includes(i.action)))
      .map((i) => (i.altLabel && !sections.includes(i.altLabel.whenMissing) ? { ...i, label: i.altLabel.label } : i)),
  })).filter((g) => g.items.length > 0);

  return (
    <aside
      aria-label="Asosiy menyu"
      className="flex h-screen w-[var(--sidebar-rail-w)] shrink-0 flex-col gap-[26px] bg-ink px-3 pb-5 pt-6 text-ink-muted xl:w-[var(--sidebar-w)] xl:px-4"
    >
      <div className="flex justify-center px-0 xl:justify-start xl:px-2">
        <span className="hidden xl:block">
          <AdminBrand />
        </span>
        <span className="xl:hidden">
          <Logo height={24} />
        </span>
      </div>

      <nav aria-label="Bo'limlar" className="no-scrollbar -mx-3 flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-3 xl:-mx-4 xl:px-4">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-0.5">
            <span className="label-caps hidden px-3 pb-1.5 text-ink-label xl:block">{g.title}</span>
            <span aria-hidden className="mx-auto mb-1.5 h-px w-6 bg-ink-border xl:hidden" />
            <ul className="flex flex-col gap-0.5">
              {g.items.map(({ to, section, label, icon: Icon, end, noBadge }) => {
                const badge = noBadge ? undefined : badges[section];
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      title={label}
                      aria-label={badge ? `${label}, ${badge} ta yangi` : label}
                      className={({ isActive }) =>
                        cn(
                          "relative flex h-11 items-center justify-center gap-3 rounded-nav px-3 text-sm xl:justify-start",
                          "focus-visible:outline-green",
                          isActive ? "bg-ink-2 font-bold text-white" : "font-semibold text-ink-muted hover:bg-[rgba(20,34,53,0.6)] hover:text-white"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span aria-hidden className="absolute -left-3 bottom-2.5 top-2.5 w-1 rounded-r bg-green" />}
                          <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-green" : "")} aria-hidden />
                          <span className="hidden min-w-0 flex-1 truncate xl:block">{label}</span>
                          {!!badge && (
                            <span
                              aria-hidden
                              className={cn(
                                "tabular flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-green px-[7px] text-2xs font-extrabold text-ink",
                                "absolute -right-1 -top-1 xl:static xl:ml-auto"
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
          </div>
        ))}
      </nav>

      {me && <UserCard me={me} onLogout={onLogout} />}
    </aside>
  );
}

/** Signed-in staff card at the bottom: opens the profile menu (Profil,
 * Chiqish); the icon button logs out directly, as in the design. */
function UserCard({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const role = ROLE_LABEL[me.role];
  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2.5 rounded-2xl bg-ink-2 p-1.5 xl:p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`${me.name}, ${role}: profil menyusi`}
          className="flex min-w-0 flex-1 items-center justify-center gap-2.5 rounded-nav text-left xl:justify-start"
        >
          <Avatar name={me.name} size={40} tone="green" />
          <span className="hidden min-w-0 flex-col gap-0.5 xl:flex">
            <span className="truncate text-sm font-bold text-white">{me.name}</span>
            <span className="text-xs font-semibold text-ink-muted">{role}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Chiqish"
          title="Chiqish"
          className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink hover:text-white xl:flex"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
      {open && (
        <div
          role="menu"
          aria-label="Profil menyusi"
          className="absolute bottom-full left-0 z-30 mb-2 w-56 overflow-hidden rounded-field bg-white p-1.5 shadow-pop animate-fade-in"
        >
          <Link
            ref={firstItem}
            to="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-11 items-center gap-2.5 rounded-box px-3 text-sm font-bold text-ink hover:bg-surface"
          >
            <UserRound className="h-4 w-4 text-muted" aria-hidden /> Profil
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex h-11 w-full items-center gap-2.5 rounded-box px-3 text-left text-sm font-bold text-error hover:bg-error-soft"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Chiqish
          </button>
        </div>
      )}
    </div>
  );
}
