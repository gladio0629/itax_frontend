import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Profile } from "@/api/types";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { BottomSheet, DangerButton, Icon, Initials, ListRow, Screen, Segmented, TextButton } from "@/ui";

/**
 * Sozlamalar (design v2: Settings): the profile card (opens Akkaunt),
 * notifications, light / dark, language, help, about, and log out with a
 * confirmation.
 */
export function SettingsScreen() {
  const navigate = useNavigate();
  const { t, locale } = useT();
  const { theme, toggleTheme } = useTheme();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  function loadProfile() {
    setProfileError(false);
    api
      .getProfile()
      .then(setProfile)
      .catch(() => setProfileError(true));
  }
  useEffect(loadProfile, []);

  return (
    <Screen
      title={t("drawer.sozlamalar")}
      top={
        profileError ? (
          <button type="button" onClick={loadProfile} className="flex h-[88px] items-center justify-center gap-2 rounded-iz-card bg-iz-head-card text-[14px] font-bold text-iz-head-text">
            <Icon name="refresh" size={18} />
            {t("common.loadFailedRetry")}
          </button>
        ) : (
          <Link to="/settings/account" className="flex items-center gap-3.5 rounded-iz-card bg-iz-head-card p-4 active:opacity-80">
            {profile ? <Initials name={profile.name} size={56} /> : <span aria-hidden className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-iz-head-border" />}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-[18px] font-extrabold text-iz-head-text">{profile?.name ?? " "}</span>
              <span className="truncate text-[13px] font-semibold text-iz-head-muted">{profile?.phoneMasked ?? " "}</span>
            </span>
            <span className="flex h-9 shrink-0 items-center rounded-full border border-iz-head-border-strong px-3.5 text-[13px] font-bold text-iz-head-text">{t("account.edit")}</span>
          </Link>
        )
      }
      bodyClassName="gap-0 pt-4"
      footer={
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="flex h-14 items-center justify-center gap-2.5 rounded-full bg-iz-danger-soft text-[15px] font-extrabold text-iz-danger active:opacity-80"
        >
          <Icon name="logout" size={18} />
          {t("settings.logout")}
        </button>
      }
    >
      <ListRow icon="bell" title={t("settings.notifications")} onClick={() => navigate("/settings/notifications")} />
      <ListRow
        icon="moon"
        title={t("settings.theme")}
        chevron={false}
        trailing={
          <Segmented
            size="sm"
            label={t("settings.theme")}
            value={theme === "dark" ? "dark" : "light"}
            onChange={(v) => {
              if ((v === "dark") !== (theme === "dark")) toggleTheme();
            }}
            options={[
              { value: "light", label: t("settings.themeLight") },
              { value: "dark", label: t("settings.themeDark") },
            ]}
          />
        }
      />
      <ListRow icon="globe" title={t("settings.language")} value={t(`language.name.${locale}` as TranslationKey)} onClick={() => navigate("/language")} />
      {api.capabilities.help && <ListRow icon="support" title={t("history.help")} onClick={() => navigate("/help")} />}
      <ListRow icon="info" title={t("settings.about")} onClick={() => navigate("/settings/about")} last />

      <BottomSheet
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title={t("settings.logoutConfirmTitle")}
        closeLabel={t("common.close")}
        footer={
          <>
            <DangerButton
              icon="logout"
              onClick={() => {
                setLogoutOpen(false);
                logout();
                navigate("/auth/phone", { replace: true });
              }}
            >
              {t("settings.logout")}
            </DangerButton>
            <TextButton onClick={() => setLogoutOpen(false)}>{t("common.cancel")}</TextButton>
          </>
        }
      >
        <p className="text-[15px] leading-[22px] text-iz-muted">{t("settings.logoutConfirmDesc")}</p>
      </BottomSheet>
    </Screen>
  );
}
