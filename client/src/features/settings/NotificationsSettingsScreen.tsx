import { useEffect, useState } from "react";
import { Car, Megaphone, Gift } from "lucide-react";
import { api } from "@/api/client";
import type { NotificationPrefs } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { SkeletonList } from "@/components/Skeleton";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

function Toggle({ value, onChange, disabled, label }: { value: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={value}
      aria-label={label}
      className={cn(
        "relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40",
        value ? "bg-accent" : "bg-ink/15"
      )}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-softer transition-transform", value ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function NotificationsSettingsScreen() {
  const { t } = useT();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    api.getNotificationPrefs().then(setPrefs);
  }, []);

  async function patch(key: keyof NotificationPrefs) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const saved = await api.setNotificationPrefs({ [key]: next[key] });
    setPrefs(saved);
  }

  if (!prefs) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title={t("notifPrefs.title")} />
        <div className="px-4 pt-4">
          <SkeletonList count={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title={t("notifPrefs.title")} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{t("notifPrefs.master")}</p>
              <p className="text-xs text-ink/60">{t("notifPrefs.masterDesc")}</p>
            </div>
            <Toggle value={prefs.master} onChange={() => patch("master")} label={t("notifPrefs.master")} />
          </div>
        </Card>

        <Card className="divide-y divide-border" padded={false}>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-10 text-accent">
              <Car className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t("notifPrefs.orderStatus")}</p>
              <p className="text-xs text-ink/60">{t("notifPrefs.orderStatusDesc")}</p>
            </div>
            <Toggle
              value={prefs.master && prefs.orderStatus}
              disabled={!prefs.master}
              onChange={() => patch("orderStatus")}
              label={t("notifPrefs.orderStatus")}
            />
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-10 text-accent">
              <Megaphone className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t("notifPrefs.news")}</p>
              <p className="text-xs text-ink/60">{t("notifPrefs.newsDesc")}</p>
            </div>
            <Toggle
              value={prefs.master && prefs.news}
              disabled={!prefs.master}
              onChange={() => patch("news")}
              label={t("notifPrefs.news")}
            />
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-10 text-accent">
              <Gift className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t("notifPrefs.bonus")}</p>
              <p className="text-xs text-ink/60">{t("notifPrefs.bonusDesc")}</p>
            </div>
            <Toggle
              value={prefs.master && prefs.bonus}
              disabled={!prefs.master}
              onChange={() => patch("bonus")}
              label={t("notifPrefs.bonus")}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
