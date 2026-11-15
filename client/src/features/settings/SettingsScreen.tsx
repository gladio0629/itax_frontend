import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Bell, Sun, Moon, Globe, HelpCircle, Info, LogOut, ChevronRight, ShieldCheck } from "@/lib/icons";
import { api } from "@/api/client";
import type { Profile } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { SkeletonCard } from "@/components/Skeleton";
import { LanguageSheet } from "@/components/LanguageSheet";
import { PageTitle } from "@/components/PageTitle";
import { Switch } from "@/components/Switch";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { useIsIOS } from "@/lib/platform";
import { IconTile, ListRow, ListSection } from "@/components/ios/List";
import { Alert } from "@/components/ios/Alert";

function Row({
  icon: Icon,
  label,
  value,
  onClick,
  to,
  danger,
}: {
  icon: typeof User;
  label: string;
  value?: string;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
}) {
  const className = "flex min-h-[68px] w-full items-center gap-3 p-4 text-left hover:bg-ink/5 active:bg-ink/5";
  const body = (
    <>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          danger ? "bg-danger/10 text-danger" : "bg-accent-10 text-accent"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className={cn("flex-1 text-sm font-normal", danger ? "text-danger" : "text-ink")}>{label}</span>
      {value && <span className="text-sm text-ink/60">{value}</span>}
      {(onClick || to) && !danger && <ChevronRight className="h-4 w-4 text-ink/60" />}
    </>
  );
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <button onClick={onClick} className={className}>
      {body}
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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const ios = useIsIOS();

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col bg-bg">
      <PageTitle>{t("drawer.sozlamalar")}</PageTitle>

      {ios ? (
        <div className="scroll-pb flex-1 overflow-y-auto overscroll-contain pt-2">
          <ListSection>
            <ListRow
              large
              to="/settings/account"
              chevron
              leading={
                profile ? (
                  <Avatar seed={profile.avatarSeed} name={profile.name} size={60} />
                ) : (
                  <span className="h-[60px] w-[60px] shrink-0 animate-pulse rounded-full bg-[var(--ios-fill-tertiary)]" />
                )
              }
              title={profile?.name ?? "\u00a0"}
              subtitle={profile?.phoneMasked ?? "\u00a0"}
            />
          </ListSection>

          <ListSection>
            <ListRow leading={<IconTile icon={Bell} tone="danger" />} title={t("settings.notifications")} to="/settings/notifications" />
            <ListRow leading={<IconTile icon={ShieldCheck} />} title={t("settings.safety")} to="/settings/safety" />
          </ListSection>

          <ListSection>
            <ListRow
              leading={<IconTile icon={theme === "dark" ? Moon : Sun} />}
              title={t("settings.theme")}
              accessory={
                <Switch
                  checked={theme === "dark"}
                  onChange={toggleTheme}
                  label={theme === "dark" ? t("theme.toggleToLight") : t("theme.toggleToDark")}
                />
              }
            />
            <ListRow
              leading={<IconTile icon={Globe} />}
              title={t("settings.language")}
              value={t(`settings.languageName.${locale}` as TranslationKey)}
              chevron
              onClick={() => setLanguageOpen(true)}
            />
          </ListSection>

          <ListSection>
            <ListRow leading={<IconTile icon={HelpCircle} tone="gray" />} title={t("history.help")} to="/help" />
            <ListRow leading={<IconTile icon={Info} tone="gray" />} title={t("settings.about")} to="/settings/about" />
          </ListSection>

          <ListSection>
            <ListRow centered destructive title={t("settings.logout")} onClick={() => setLogoutOpen(true)} />
          </ListSection>
        </div>
      ) : (
      <div className="scroll-pb flex-1 overflow-y-auto overscroll-contain px-4 pt-2">
        <Link
          to="/settings/account"
          className="mb-5 flex w-full items-center gap-4 rounded-2xl bg-card p-4 shadow-softer transition-transform hover:bg-ink/[0.02] active:scale-[0.99]"
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
        </Link>

        <div className="mb-4 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-softer">
          <Row icon={Bell} label={t("settings.notifications")} to="/settings/notifications" />
          <Row icon={ShieldCheck} label={t("settings.safety")} to="/settings/safety" />
        </div>

        <div className="mb-4 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-softer">
          <div className="flex min-h-[68px] items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-10 text-accent">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </span>
            <span className="flex-1 text-sm font-normal text-ink">{t("settings.theme")}</span>
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
          <Row icon={HelpCircle} label={t("history.help")} to="/help" />
          <Row icon={Info} label={t("settings.about")} to="/settings/about" />
        </div>

        <button
          onClick={() => setLogoutOpen(true)}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-danger hover:bg-danger/5"
        >
          <LogOut className="h-4 w-4" /> {t("settings.logout")}
        </button>
      </div>
      )}

      {languageOpen && <LanguageSheet onClose={() => setLanguageOpen(false)} />}
      {ios ? (
        <Alert
          open={logoutOpen}
          title={t("settings.logoutConfirmTitle")}
          message={t("settings.logoutConfirmDesc")}
          onCancel={() => setLogoutOpen(false)}
          actions={[
            { label: t("common.cancel"), style: "cancel", onPress: () => setLogoutOpen(false) },
            {
              label: t("settings.logout"),
              style: "destructive",
              onPress: () => {
                logout();
                navigate("/auth/phone", { replace: true });
              },
            },
          ]}
        />
      ) : (
      <Sheet open={logoutOpen} onClose={() => setLogoutOpen(false)} ariaLabel={t("settings.logoutConfirmTitle")}>
        <div className="px-5 pb-3 pt-3">
          <h2 className="mb-2 text-sm font-semibold text-ink">{t("settings.logoutConfirmTitle")}</h2>
          <p className="mb-5 text-sm text-ink/70">{t("settings.logoutConfirmDesc")}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setLogoutOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                logout();
                navigate("/auth/phone", { replace: true });
              }}
            >
              {t("settings.logout")}
            </Button>
          </div>
        </div>
      </Sheet>
      )}
    </div>
  );
}
