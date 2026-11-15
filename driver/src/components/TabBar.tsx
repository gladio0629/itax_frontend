import { NavLink } from "react-router-dom";
import { History, Home, User, Wallet } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

const TABS = [
  { to: "/", key: "tab.home", icon: Home, end: true },
  { to: "/wallet", key: "tab.wallet", icon: Wallet, end: false },
  { to: "/history", key: "tab.history", icon: History, end: false },
  { to: "/profile", key: "tab.profile", icon: User, end: false },
] as const;

/** Four fixed tabs. Active = yellow icon + label; inactive = muted. */
/** `badge`: true shows a dot; a number shows a counter (new requests on Asosiy). */
export function TabBar({ badge }: { badge?: Partial<Record<(typeof TABS)[number]["to"], boolean | number>> }) {
  const { t } = useT();
  return (
    <nav
      aria-label={t("tab.label")}
      className="relative z-30 shrink-0 border-t border-line bg-surface"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="grid h-[var(--tabbar-h)] grid-cols-4">
        {TABS.map(({ to, key, icon: Icon, end }) => (
          <li key={to} className="flex">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "press relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium",
                  isActive ? "text-gold" : "text-muted"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon className="h-6 w-6" />
                    {typeof badge?.[to] === "number" && (badge[to] as number) > 0 ? (
                      <span className="tabular absolute -right-2.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-fill px-1 text-xs font-bold text-white ring-2 ring-surface">
                        {(badge[to] as number) > 99 ? "99+" : (badge[to] as number)}
                      </span>
                    ) : (
                      badge?.[to] === true && <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface" />
                    )}
                  </span>
                  {t(key)}
                  {typeof badge?.[to] === "number" && (badge[to] as number) > 0 && <span className="sr-only">{t("tab.newCount", { n: badge[to] as number })}</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
