import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { DEMO_MODE, SITE_URL } from "@/config";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { useDevicePrefs, type NavigatorApp } from "@/lib/devicePrefs";
import { useSession } from "@/stores/sessionStore";
import { Bell, ExternalLink, FileText, FlaskConical, Globe, HelpCircle, Info, LogOut, Moon, Navigation, Shield, Trash2, Volume2 } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { Switch } from "@/components/Switch";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { LanguageSheet } from "@/components/LanguageSheet";
import { TEST_PANEL_PROFILE_PATH } from "@/features/testPanel/paths";
import { testPanelText } from "@/features/testPanel/strings";

const NAV_APPS: NavigatorApp[] = ["system", "yandex", "google"];

/** Sozlamalar (design v2): app settings, help and legal pages, sign out, delete account. */
export default function SettingsScreen() {
  const { t, locale } = useT();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const setSession = useSession((s) => s.set);
  const prefs = useDevicePrefs();
  const info = useQuery(() => api.getAppInfo(), []);
  const [langOpen, setLangOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      setSession(await api.logout());
      navigate("/register", { replace: true });
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      const s = await api.deleteAccount();
      toast(t("delete.done"), "success");
      setSession(s);
      navigate("/register", { replace: true });
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back="/profile" title={t("settings.title")}>
      <div className="flex flex-col gap-2">
        <SettingsGroup label={t("settings.app")}>
          <SettingsRow
            icon={Moon}
            label={t("settings.night")}
            description={t("settings.nightHint")}
            trailing={<Switch checked={theme === "dark"} onChange={toggleTheme} label={t("settings.night")} />}
          />
          <SettingsRow icon={Globe} label={t("profile.language")} value={t(`settings.languageName.${locale}` as TranslationKey)} onClick={() => setLangOpen(true)} />
          {/* The sound plays with the in-app new-request alert; without alerts there is nothing to play. */}
          {api.capabilities.requestAlerts && (
            <SettingsRow
              icon={Volume2}
              label={t("settings.sound")}
              trailing={<Switch checked={prefs.requestSound} onChange={() => prefs.set({ requestSound: !prefs.requestSound })} label={t("settings.sound")} />}
            />
          )}
          <SettingsRow icon={Navigation} label={t("settings.navigator")} value={t(`settings.nav.${prefs.navigator}`)} onClick={() => setNavOpen(true)} />
          <SettingsRow icon={Bell} label={t("settings.notifPrefs")} to="/profile/notifications" />
        </SettingsGroup>

        <span className="-mx-5 h-2 bg-raised" aria-hidden="true" />

        <SettingsGroup label={t("settings.helpGroup")}>
          {api.capabilities.help && <SettingsRow icon={HelpCircle} label={t("settings.helpCenter")} to="/profile/help" />}
          {SITE_URL && (
            <>
              <SettingsRow icon={FileText} label={t("settings.terms")} href={`${SITE_URL}/terms`} />
              <SettingsRow icon={Shield} label={t("settings.privacy")} href={`${SITE_URL}/privacy`} />
            </>
          )}
          <SettingsRow icon={Info} label={t("profile.about")} to="/profile/about" />
          {DEMO_MODE && <SettingsRow icon={FlaskConical} tile="orange" label={testPanelText(locale, "title")} to={TEST_PANEL_PROFILE_PATH} />}
        </SettingsGroup>

        <span className="-mx-5 h-2 bg-raised" aria-hidden="true" />

        <div className="flex flex-col">
          <SettingsRow icon={LogOut} label={t("profile.logout")} danger onClick={() => setLogoutOpen(true)} />
          <SettingsRow icon={Trash2} label={t("settings.delete")} danger onClick={() => setDeleteOpen(true)} />
        </div>
        {info.data && <p className="tabular py-3 text-center text-xs font-semibold text-muted">{t("settings.version", { v: info.data.version })}</p>}
      </div>

      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />

      <Sheet open={navOpen} onClose={() => setNavOpen(false)} title={t("settings.navigator")}>
        <div className="flex flex-col pb-2" role="radiogroup" aria-label={t("settings.navigator")}>
          {NAV_APPS.map((app) => (
            <button
              key={app}
              type="button"
              role="radio"
              aria-checked={prefs.navigator === app}
              onClick={() => {
                prefs.set({ navigator: app });
                setNavOpen(false);
              }}
              className="press focus-inset flex min-h-[56px] items-center justify-between border-b border-line text-left text-15 font-bold text-ink last:border-b-0"
            >
              {t(`settings.nav.${app}`)}
              {prefs.navigator === app && <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden="true" />}
            </button>
          ))}
          <p className="pt-3 text-13 text-muted">{t("settings.navHint")}</p>
        </div>
      </Sheet>

      <Sheet open={logoutOpen} onClose={() => setLogoutOpen(false)} title={t("profile.logoutTitle")}>
        <p className="mb-5 text-sm text-muted">{t("profile.logoutDesc")}</p>
        <div className="grid grid-cols-2 gap-3 pb-1">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" loading={busy} onClick={logout}>
            {t("profile.logout")}
          </Button>
        </div>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t("delete.title")}>
        <p className="mb-5 text-sm text-muted">{t("delete.desc")}</p>
        {api.capabilities.deleteAccount ? (
          <div className="grid grid-cols-2 gap-3 pb-1">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={busy} onClick={deleteAccount}>
              {t("delete.confirm")}
            </Button>
          </div>
        ) : SITE_URL ? (
          <>
            <p className="mb-4 text-sm font-semibold text-ink">{t("delete.web")}</p>
            <a
              href={`${SITE_URL}/delete-account`}
              target="_blank"
              rel="noopener noreferrer"
              className="press mb-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-danger-soft text-sm font-bold text-danger"
            >
              {t("delete.webOpen")}
              <ExternalLink className="h-4 w-4" />
            </a>
          </>
        ) : (
          <p className="pb-2 text-sm font-semibold text-ink">{t("delete.noSite")}</p>
        )}
      </Sheet>
    </Screen>
  );
}
