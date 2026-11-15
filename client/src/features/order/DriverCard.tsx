import { useState } from "react";
import { Phone, MessageCircle, Star } from "@/lib/icons";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Toast } from "@/components/Toast";
import { useT } from "@/lib/i18n/provider";
import type { Driver } from "@/api/types";

export function DriverCard({ driver }: { driver: Driver }) {
  const { t } = useT();
  const [toast, setToast] = useState<string | null>(null);

  return (
    <Card className="flex items-center gap-3 p-4">
      <Avatar seed={driver.avatarSeed} name={driver.name} size={52} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{driver.name}</p>
        <p className="text-xs text-ink/60">
          {driver.carModel.replace(/ (?=\S+$)/, "\u00a0")} <span className="whitespace-nowrap">&middot; {driver.carColor}</span>
        </p>
        <p className="mt-0.5 whitespace-nowrap text-xs font-semibold tabular text-ink/80">{driver.plate}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-normal text-ink/80">
          <Star className="h-3 w-3 fill-brand-yellow text-brand-yellow" /> {driver.rating.toFixed(1)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => setToast(t("driver.callUnavailable"))}
          aria-label={t("driver.call")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-10 text-accent"
        >
          <Phone className="h-4 w-4" />
        </button>
        <button
          onClick={() => setToast(t("driver.messageUnavailable"))}
          aria-label={t("driver.message")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink/80"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      </div>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </Card>
  );
}
