import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/useQuery";
import { useSession } from "@/stores/sessionStore";
import { Bell, FlaskConical, Gift, Globe, Info, LifeBuoy, LogOut, Moon, Sun, User } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/Stars";
import { Switch } from "@/components/Switch";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { LanguageSheet } from "@/components/LanguageSheet";
import { isDemo } from "@/api/client";
import { cn } from "@/lib/cn";

export default function ProfileScreen() {
  const { t, locale } = useT();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const setSession = useSession((s) => s.set);
  const profile = useQuery(() => api.getProfile(), []);
  const bonus = useQuery(() => api.getBonus(), []);
  const [langOpen, setLangOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const p = profile.data;

  async function logout() {
    setLoggingOut(true);
    try {
      const s = await api.logout();
      setSession(s);
      navigate("/register", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("profile.title")} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {profile.error && !p ? (
          <ErrorState error={profile.error} onRetry={() => profile.reload()} />
        ) : (
          <section aria-label={p?.name ?? t("profile.title")} className="mb-5 flex flex-col items-center text-center">
            <div className="relative">
              {p ? <Avatar seed={p.avatarSeed} name={p.name} size={96} silhouette /> : <Skeleton className="h-24 w-24 rounded-full" />}
              {p && (
                <span
                  role="img"
                  aria-label={p.online ? t("profile.statusOnline") : t("profile.statusOffline")}
                  className={cn("absolute bottom-1 right-1 h-5 w-5 rounded-full ring-4 ring-bg", p.online ? "bg-yellow" : "bg-ink/40")}
                />
              )}
            </div>
            {p ? (
              <>
                <h2 className="mt-3 text-xl font-bold text-ink">{p.name}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <Stars value={p.rating} />
                  <span className="tabular text-sm text-muted">({t("profile.ratingCount", { n: p.ratingCount })})</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex h-8 items-center gap-2 rounded-button bg-surface px-3 text-sm text-ink shadow-1">
                    <span aria-hidden="true" className="h-3 w-3 rounded-full ring-1 ring-ink/20" style={{ background: p.car.colorHex }} />
                    {p.car.model}, {t(`color.${p.car.color}` as never)}
                  </span>
                  <span translate="no" className="tabular inline-flex h-8 items-center rounded-button border-2 border-ink/80 bg-white px-2 text-sm font-bold tracking-wide text-[#0e1630]">{p.car.plate}</span>
                </div>
                <p className="tabular mt-2 text-sm text-muted">
                  {t("profile.trips", { n: p.totalTrips })}, {t("profile.since", { year: p.memberSinceYear })}
                </p>
              </>
            ) : (
              <>
                <Skeleton className="mt-3 h-6 w-40" />
                <Skeleton className="mt-2 h-4 w-28" />
              </>
            )}
          </section>
        )}

        <SettingsGroup label={t("profile.groupAccount")}>
          <SettingsRow icon={User} tile="blue" label={t("profile.personal")} to="/profile/personal" />
          <SettingsRow
            icon={Gift}
            tile="yellow"
            label={t("profile.bonus")}
            value={bonus.data ? t("profile.bonusValue", { pct: bonus.data.commissionPct }) : undefined}
            to="/profile/bonus"
          />
          <SettingsRow icon={Bell} tile="red" label={t("profile.notifications")} to="/profile/notifications" />
        </SettingsGroup>

        <SettingsGroup label={t("profile.groupApp")}>
          <SettingsRow
            icon={theme === "dark" ? Moon : Sun}
            tile="purple"
            label={t("profile.theme")}
            value={theme === "dark" ? t("profile.themeDark") : t("profile.themeLight")}
            trailing={<Switch checked={theme === "dark"} onChange={toggleTheme} label={theme === "dark" ? t("profile.toLight") : t("profile.toDark")} />}
          />
          <SettingsRow icon={Globe} tile="teal" label={t("profile.language")} value={t(`settings.languageName.${locale}`)} onClick={() => setLangOpen(true)} />
        </SettingsGroup>

        <SettingsGroup label={t("profile.groupSupport")}>
          <SettingsRow icon={LifeBuoy} tile="green" label={t("profile.help")} to="/profile/help" />
          <SettingsRow icon={Info} tile="slate" label={t("profile.about")} to="/profile/about" />
          {isDemo && <SettingsRow icon={FlaskConical} tile="orange" label={t("profile.demo")} to="/profile/demo" />}
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow icon={LogOut} tile="red" label={t("profile.logout")} danger onClick={() => setLogoutOpen(true)} />
        </SettingsGroup>
      </div>

      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />
      <Sheet open={logoutOpen} onClose={() => setLogoutOpen(false)} title={t("profile.logoutTitle")}>
        <p className="mb-5 text-base text-muted">{t("profile.logoutDesc")}</p>
        <div className="grid grid-cols-2 gap-3 pb-1">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" loading={loggingOut} onClick={logout}>
            {t("profile.logout")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
