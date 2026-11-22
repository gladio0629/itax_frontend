import { useId } from "react";
import { api } from "@/api/client";
import type { NotificationPrefs } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { Bell, CreditCard, Gift, ListChecks, Megaphone } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { Switch } from "@/components/Switch";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";

const ITEMS = [
  { key: "newOrders", icon: ListChecks, tile: "blue" },
  { key: "payments", icon: CreditCard, tile: "green" },
  { key: "news", icon: Megaphone, tile: "purple" },
  { key: "bonus", icon: Gift, tile: "yellow" },
] as const;

export default function NotificationPrefsScreen() {
  const { t } = useT();
  const q = useQuery(() => api.getNotificationPrefs(), []);
  const hintId = useId();
  const prefs = q.data;

  async function update(next: NotificationPrefs) {
    const prev = prefs;
    q.setData(next); // optimistic
    try {
      await api.setNotificationPrefs(next);
    } catch (e) {
      if (prev) q.setData(prev);
      toast(errorMessage(e, t), "danger");
    }
  }

  return (
    <Screen title={t("prefs.title")} back={"/profile/settings"}>
      {q.error && !prefs ? (
        <ErrorState error={q.error} onRetry={() => q.reload()} />
      ) : !prefs ? (
        <SkeletonList rows={3} label={t("common.loading")} />
      ) : (
        <>
          <SettingsGroup>
            <SettingsRow
              icon={Bell}
              tile="red"
              label={t("prefs.master")}
              description={t("prefs.masterHint")}
              trailing={<Switch checked={prefs.master} onChange={() => update({ ...prefs, master: !prefs.master })} label={t("prefs.master")} describedBy={hintId} />}
            />
          </SettingsGroup>
          <span id={hintId} className="sr-only">
            {t("prefs.masterHint")}
          </span>
          <div className={prefs.master ? "" : "opacity-50"} aria-disabled={!prefs.master || undefined}>
            <SettingsGroup>
              {/* The real backend stores only push (master) and promo (news). */}
              {ITEMS.filter((it) => api.capabilities.notificationCategories || it.key === "news").map((it) => (
                <SettingsRow
                  key={it.key}
                  icon={it.icon}
                  tile={it.tile}
                  label={t(`prefs.${it.key}`)}
                  trailing={
                    <Switch
                      checked={prefs.master && prefs[it.key]}
                      disabled={!prefs.master}
                      onChange={() => update({ ...prefs, [it.key]: !prefs[it.key] })}
                      label={t(`prefs.${it.key}`)}
                    />
                  }
                />
              ))}
            </SettingsGroup>
          </div>
        </>
      )}
    </Screen>
  );
}
