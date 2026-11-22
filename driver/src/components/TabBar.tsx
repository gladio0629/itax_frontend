import { NavLink } from "react-router-dom";
import { Clock, Home, User, Wallet } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

export const TAB_ROOTS = ["/", "/wallet", "/history", "/profile"] as const;
type TabRoot = (typeof TAB_ROOTS)[number];

const TABS = [
  { to: "/", key: "tab.home", icon: Home, end: true },
  { to: "/wallet", key: "tab.wallet", icon: Wallet, end: false },
  { to: "/history", key: "tab.history", icon: Clock, end: false },
  { to: "/profile", key: "tab.profile", icon: User, end: false },
] as const;

/**
 * Floating Ink tab bar (radius 32, 24 above the bottom edge). The active
 * tab is a green pill with icon + label; the others are icon-only with an
 * accessible name. `badge`: true shows a dot; a number shows a counter.
 */
export function TabBar({ badge }: { badge?: Partial<Record<TabRoot, boolean | number>> }) {
  const { t } = useT();
  return (
    <nav
      aria-label={t("tab.label")}
      className="on-night absolute inset-x-5 z-30 flex h-[var(--tabbar-h)] items-center justify-between rounded-[32px] bg-night px-2 shadow-float"
      style={{ bottom: "calc(var(--safe-bottom) + var(--tabbar-gap))" }}
    >
      {TABS.map(({ to, key, icon: Icon, end }) => {
        const b = badge?.[to];
        const count = typeof b === "number" && b > 0 ? b : 0;
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={count > 0 ? `${t(key)}, ${t("tab.newCount", { n: count })}` : t(key)}
            className={({ isActive }) =>
              cn(
                "press relative flex h-12 items-center justify-center gap-2 rounded-full text-sm font-extrabold",
                isActive ? "bg-brand px-[18px] text-on-brand" : "w-[52px] text-night-muted"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className={isActive ? "h-5 w-5" : "h-[22px] w-[22px]"} strokeWidth={isActive ? 2.2 : 2} />
                  {count > 0 ? (
                    <span className="tabular absolute -right-2.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-on-brand ring-2 ring-night">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : (
                    b === true && <span className="absolute -right-1 -top-0.5 h-[9px] w-[9px] rounded-full bg-warning-icon ring-2 ring-night" />
                  )}
                </span>
                {isActive && <span aria-hidden="true">{t(key)}</span>}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
