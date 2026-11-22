import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { NotificationPrefs } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { Icon, ListRow, Screen, SectionLabel, StateError, StateLoading, Switch, type IconName } from "@/ui";

const TOPICS: { key: "orderStatus" | "news" | "bonus"; icon: IconName; title: TranslationKey; desc: TranslationKey }[] = [
  { key: "orderStatus", icon: "car", title: "notifPrefs.orderStatus", desc: "notifPrefs.orderStatusDesc" },
  { key: "news", icon: "megaphone", title: "notifPrefs.news", desc: "notifPrefs.newsDesc" },
  { key: "bonus", icon: "gift", title: "notifPrefs.bonus", desc: "notifPrefs.bonusDesc" },
];

/**
 * Bildirishnomalar (design v2: Notifications): the master switch on the dark
 * card, then each kind. A change is saved at once; a failed save is undone
 * and said so.
 */
export function NotificationsSettingsScreen() {
  const { t } = useT();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Separate order-status / bonus switches only where the adapter has them.
  const topics = TOPICS.filter((x) => api.capabilities.notificationTopics || x.key === "news");

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
    setSaveError(false);
    try {
      setPrefs(await api.setNotificationPrefs({ [key]: next[key] }));
    } catch {
      setPrefs(prev);
      setSaveError(true);
    }
  }

  if (!prefs) {
    return <Screen title={t("notifPrefs.title")}>{loadError ? <StateError onRetry={load} /> : <StateLoading rows={3} />}</Screen>;
  }

  return (
    <Screen
      title={t("notifPrefs.title")}
      top={
        <div className="flex items-center gap-3.5 rounded-iz-card bg-iz-head-card py-3.5 pl-4 pr-2.5">
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-iz-green text-iz-on-green">
            <Icon name="bell" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[16px] font-extrabold text-iz-head-text">{t("notifPrefs.master")}</span>
            <span className="text-[13px] font-semibold text-iz-head-muted">{prefs.master ? t("notifPrefs.masterOn") : t("notifPrefs.masterOff")}</span>
          </span>
          <Switch tone="head" checked={prefs.master} onChange={() => patch("master")} label={t("notifPrefs.master")} />
        </div>
      }
      bodyClassName="gap-0 pt-6"
    >
      <SectionLabel as="h2">{t("notifPrefs.kinds")}</SectionLabel>
      {saveError && (
        <p role="alert" className="pt-2 text-[13px] font-semibold text-iz-danger">
          {t("notifPrefs.saveError")}
        </p>
      )}
      {topics.map((x, i) => (
        <ListRow
          key={x.key}
          icon={x.icon}
          title={t(x.title)}
          subtitle={t(x.desc)}
          tall
          last={i === topics.length - 1}
          trailing={<Switch checked={prefs.master && prefs[x.key]} disabled={!prefs.master} onChange={() => patch(x.key)} label={t(x.title)} />}
        />
      ))}
    </Screen>
  );
}
