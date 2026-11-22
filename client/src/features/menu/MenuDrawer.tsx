import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Profile } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon, Initials, Logo, useDialogA11y, type IconName } from "@/ui";

type NavItem = { to: string; labelKey: TranslationKey; icon: IconName };

const NAV_ITEMS: NavItem[] = [
  { to: "/home", labelKey: "drawer.asosiy", icon: "homeFilled" },
  // Bonuses only where the adapter supports them (no endpoint in the API yet).
  ...(api.capabilities.bonuses ? [{ to: "/bonus", labelKey: "drawer.bonuslar", icon: "gift" } as NavItem] : []),
  { to: "/history", labelKey: "drawer.tarix", icon: "clock" },
  // Not in the design's menu: the inbox needs an entry now that Home has no bell.
  { to: "/notifications", labelKey: "menu.notifications", icon: "bell" },
  { to: "/settings", labelKey: "drawer.sozlamalar", icon: "sliders" },
];

/**
 * Side menu (design: Menu): dark panel from the left, rounded 32 on the
 * right, profile, bonus balance, the four destinations and "Yordam kerakmi?".
 */
export function MenuDrawer({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile | null }) {
  const { t } = useT();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const [bonus, setBonus] = useState<number | null>(null);
  useDialogA11y(open, onClose, panelRef);

  useEffect(() => {
    if (!open || !api.capabilities.bonuses) return;
    api
      .getBonusSummary()
      .then((b) => setBonus(b.balance))
      .catch(() => setBonus(null));
  }, [open]);

  if (!open) return null;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div className="absolute inset-0 z-40">
      <div aria-hidden className="absolute inset-0 animate-fade-in bg-[var(--iz-backdrop)]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("drawer.open")}
        className="no-scrollbar absolute inset-y-0 left-0 flex w-[82%] max-w-[318px] animate-drawer-in flex-col gap-5 overflow-y-auto overscroll-contain rounded-r-iz-sheet bg-iz-head px-4 pb-[max(var(--safe-bottom),20px)] pt-[calc(var(--safe-top)+16px)] will-change-transform"
        onPointerDown={(e) => (drag.current = e.clientX)}
        onPointerMove={(e) => {
          if (drag.current == null || !panelRef.current) return;
          panelRef.current.style.transform = `translateX(${Math.min(0, e.clientX - drag.current)}px)`;
        }}
        onPointerUp={(e) => {
          if (drag.current == null || !panelRef.current) return;
          const dx = e.clientX - drag.current;
          drag.current = null;
          panelRef.current.style.transform = "";
          if (dx < -70) onClose();
        }}
      >
        <button type="button" onClick={() => go("/settings/account")} className="flex items-center gap-3.5 px-1 text-left active:opacity-70">
          <Initials name={profile?.name ?? ""} size={56} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[18px] font-extrabold text-iz-head-text">{profile?.name || "—"}</span>
            <span className="truncate text-[13px] font-semibold text-iz-head-muted">{profile?.phoneMasked ?? ""}</span>
          </span>
          <Icon name="chevronRight" size={18} className="shrink-0 text-iz-head-muted" />
          <span className="sr-only">{t("menu.account")}</span>
        </button>

        {api.capabilities.bonuses && (
          <button type="button" onClick={() => go("/bonus")} className="flex items-center justify-between rounded-[22px] bg-iz-head-card p-4 text-left active:opacity-80">
            <span className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-head-muted">{t("menu.bonusLabel")}</span>
              <span className="text-[26px] font-extrabold tabular-nums text-iz-head-text">{bonus != null ? formatNumber(bonus) : "…"}</span>
            </span>
            <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-iz-green text-iz-on-green">
              <Icon name="arrowRight" strokeWidth={2.4} />
            </span>
          </button>
        )}

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex h-[60px] items-center gap-3.5 rounded-iz-field px-2 text-[16px]",
                  isActive ? "bg-iz-head-card font-extrabold text-iz-head-text" : "font-semibold text-iz-head-soft active:bg-iz-head-card/60"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-iz-tile",
                      isActive ? "bg-iz-green text-iz-on-green" : "bg-iz-head-card text-iz-head-text"
                    )}
                  >
                    <Icon name={item.icon} />
                  </span>
                  {t(item.labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {api.capabilities.help && (
          <button
            type="button"
            onClick={() => go("/help")}
            className="mt-auto flex h-[60px] shrink-0 items-center gap-3.5 rounded-iz-field border border-iz-head-border px-2 text-left text-[15px] font-bold text-iz-head-text active:opacity-70"
          >
            <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-iz-tile bg-iz-head-card">
              <Icon name="support" />
            </span>
            {t("menu.help")}
          </button>
        )}
        <Logo width={56} className={cn("ml-2 mt-1 opacity-90", !api.capabilities.help && "mt-auto")} />
      </div>
    </div>
  );
}
