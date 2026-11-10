import { useEffect, useState } from "react";
import { Car, Megaphone, Gift } from "@/lib/icons";
import { api } from "@/api/client";
import type { NotificationPrefs } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { SkeletonList } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Toast } from "@/components/Toast";
import { useT } from "@/lib/i18n/provider";
import { Switch } from "@/components/Switch";

export function NotificationsSettingsScreen() {
  const { t } = useT();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function load() {
    setLoadError(false);
    api.getNotificationPrefs().then(setPrefs).catch(() => setLoadError(true));
  }
  useEffect(load, []);

  async function patch(key: keyof NotificationPrefs) {
    if (!prefs) return;
    const prev = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      setPrefs(await api.setNotificationPrefs({ [key]: next[key] }));
    } catch {
      setPrefs(prev);
      setSaveError(true);
    }
  }

  if (!prefs) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title={t("notifPrefs.title")} />
        {loadError ? <ErrorState onRetry={load} /> : <div className="px-4 pt-4"><SkeletonList count={2} /></div>}
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <ScreenHeader title={t("notifPrefs.title")} />
      <div className="scroll-pb flex-1 overflow-y-auto overscroll-contain px-4">
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{t("notifPrefs.master")}</p>
              <p className="text-xs text-ink/60">{t("notifPrefs.masterDesc")}</p>
            </div>
            <Switch checked={prefs.master} onChange={() => patch("master")} label={t("notifPrefs.master")} />
          </div>
        </Card>

        <Card className="divide-y divide-border" padded={false}>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-10 text-accent">
              <Car className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-normal text-ink">{t("notifPrefs.orderStatus")}</p>
              <p className="text-xs text-ink/60">{t("notifPrefs.orderStatusDesc")}</p>
            </div>
            <Switch checked={prefs.master && prefs.orderStatus} disabled={!prefs.master}
              onChange={() => patch("orderStatus")} label={t("notifPrefs.orderStatus")} />
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-10 text-accent">
              <Megaphone className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-normal text-ink">{t("notifPrefs.news")}</p>
              <p className="text-xs text-ink/60">{t("notifPrefs.newsDesc")}</p>
            </div>
            <Switch checked={prefs.master && prefs.news} disabled={!prefs.master}
              onChange={() => patch("news")} label={t("notifPrefs.news")} />
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-10 text-accent">
              <Gift className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-normal text-ink">{t("notifPrefs.bonus")}</p>
              <p className="text-xs text-ink/60">{t("notifPrefs.bonusDesc")}</p>
            </div>
            <Switch checked={prefs.master && prefs.bonus} disabled={!prefs.master}
              onChange={() => patch("bonus")} label={t("notifPrefs.bonus")} />
          </div>
        </Card>
      </div>
      {saveError && <Toast message={t("order.submitError")} onDone={() => setSaveError(false)} />}
    </div>
  );
}
