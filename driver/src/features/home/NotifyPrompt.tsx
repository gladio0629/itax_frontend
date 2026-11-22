import { useState } from "react";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { askSystemPermission, systemPermission } from "@/lib/systemNotify";
import { BellRing } from "@/lib/icons";
import { Button } from "@/components/Button";

/**
 * A short explanation before the browser's permission prompt, shown once.
 * Only where the Notification API exists and the driver hasn't muted requests.
 */
export function NotifyPrompt() {
  const { t } = useT();
  const prefs = useQuery(() => api.getNotificationPrefs(), []);
  const [hidden, setHidden] = useState(false);
  const p = prefs.data;
  if (hidden || !p || p.systemAsked || !p.master || !p.newOrders || systemPermission() !== "default") return null;

  async function done(ask: boolean) {
    setHidden(true);
    if (ask) await askSystemPermission();
    if (p) api.setNotificationPrefs({ ...p, systemAsked: true }).catch(() => {});
  }

  return (
    <section aria-labelledby="notify-h" className="rounded-card border border-line bg-surface p-4">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tile bg-brand-soft text-brand-ink">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 id="notify-h" className="text-base font-bold text-ink">
            {t("notifyPrompt.title")}
          </h3>
          <p className="mt-1 text-sm text-muted">{t("notifyPrompt.desc")}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => done(false)}>
          {t("notifyPrompt.later")}
        </Button>
        <Button onClick={() => done(true)}>{t("notifyPrompt.allow")}</Button>
      </div>
    </section>
  );
}
