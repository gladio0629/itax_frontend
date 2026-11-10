import { useEffect, useState } from "react";
import { Menu, Home, Gift, Clock, Settings } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "@/api/client";
import type { Profile } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Drawer } from "@/components/Drawer";
import { useT } from "@/lib/i18n/provider";
import { setTransitionKind } from "@/lib/navigation";
import { cn } from "@/lib/cn";

const APP_VERSION = "1.1.0";

const NAV_ITEMS = [
  { to: "/home", labelKey: "drawer.asosiy" as const, icon: Home },
  { to: "/bonus", labelKey: "drawer.bonuslar" as const, icon: Gift },
  { to: "/history", labelKey: "drawer.tarix" as const, icon: Clock },
  { to: "/settings", labelKey: "drawer.sozlamalar" as const, icon: Settings },
];

export function AppShell() {
  const { t } = useT();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  // Drawer destinations fade-through rather than slide, per spec.
  useEffect(() => {
    if (open) setTransitionKind("fade");
  }, [open]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label={t("drawer.open")}
        className="absolute left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft active:scale-95"
        style={{ top: "calc(var(--safe-top) + 16px)" }}
      >
        <Menu className="h-5 w-5 text-ink" />
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} ariaLabel={t("drawer.open")}>
        <div className="flex items-center gap-3 border-b border-border px-5 pb-4 pt-5">
          <Avatar seed={profile?.avatarSeed ?? "izgo"} name={profile?.name ?? ""} size={48} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{profile?.name ?? "—"}</p>
            <p className="truncate text-xs text-ink/60">{profile?.phoneMasked ?? ""}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                  isActive ? "bg-accent-10 text-accent" : "text-ink/80 hover:bg-ink/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                  {t(labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <p className="mt-auto px-5 pb-4 pt-6 text-[11px] text-ink/40">
          {t("drawer.version", { version: APP_VERSION })}
        </p>
      </Drawer>

      <div key={location.pathname} className="vt-root h-full w-full animate-fade-in">
        <Outlet />
      </div>
    </div>
  );
}
