import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Bell, Sun, Moon, Globe, HelpCircle, Info, LogOut, ChevronRight } from "lucide-react";
import { api } from "@/api/client";
import type { Profile } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { SkeletonCard } from "@/components/Skeleton";
import { LanguageSheet } from "@/components/LanguageSheet";
import { PageTitle } from "@/components/PageTitle";
import { Switch } from "@/components/Switch";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

function Row({
  icon: Icon,
  label,
  value,
  onClick,
  danger,
}: {
  icon: typeof User;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[68px] w-full items-center gap-3 p-4 text-left active:bg-ink/5"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          danger ? "bg-danger/10 text-danger" : "bg-accent-10 text-accent"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className={cn("flex-1 text-sm font-medium", danger ? "text-danger" : "text-ink")}>{label}</span>
      {value && <span className="text-sm text-ink/60">{value}</span>}
      {onClick && !danger && <ChevronRight className="h-4 w-4 text-ink/40" />}
    </button>
  );
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { t, locale } = useT();
  const { theme, toggleTheme } = useTheme();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [languageOpen, setLanguageOpen] = useState(false);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col bg-bg">
      <PageTitle>{t("drawer.sozlamalar")}</PageTitle>

      <div className="scroll-pb flex-1 overflow-y-auto overscroll-contain px-4 pt-2">
        <button
          onClick={() => navigate("/settings/account")}
          className="mb-5 flex w-full items-center gap-4 rounded-2xl bg-card p-4 shadow-softer active:scale-[0.99] transition-transform"
        >
          {profile ? (
            <Avatar seed={profile.avatarSeed} name={profile.name} size={52} />
          ) : (
            <SkeletonCard />
          )}
          {profile && (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-base font-semibold text-ink">{profile.name}</p>
              <p className="text-xs text-ink/60">{profile.phoneMasked}</p>
            </div>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-ink/40" />
        </button>

        <div className="mb-4 overflow-hidden rounded-2xl bg-card shadow-softer">
          <Row icon={Bell} label={t("settings.notifications")} onClick={() => navigate("/settings/notifications")} />
        </div>

        <div className="mb-4 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-softer">
          <div className="flex min-h-[68px] items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-10 text-accent">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </span>
            <span className="flex-1 text-sm font-medium text-ink">{t("settings.theme")}</span>
            <Switch
              checked={theme === "dark"}
              onChange={toggleTheme}
              label={theme === "dark" ? t("theme.toggleToLight") : t("theme.toggleToDark")}
            />
          </div>
          <Row
            icon={Globe}
            label={t("settings.language")}
            value={t(`settings.languageName.${locale}` as TranslationKey)}
            onClick={() => setLanguageOpen(true)}
          />
        </div>

        <div className="mb-4 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-softer">
          <Row icon={HelpCircle} label={t("history.help")} onClick={() => navigate("/help")} />
          <Row icon={Info} label={t("settings.about")} onClick={() => navigate("/settings/about")} />
        </div>

        <button
          onClick={() => {
            logout();
            navigate("/auth/phone", { replace: true });
          }}
          className="flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-danger"
        >
          <LogOut className="h-4 w-4" /> {t("settings.logout")}
        </button>
      </div>

      {languageOpen && <LanguageSheet onClose={() => setLanguageOpen(false)} />}
    </div>
  );
}
