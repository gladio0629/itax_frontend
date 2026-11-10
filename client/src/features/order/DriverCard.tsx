import { useState } from "react";
import { Phone, MessageCircle, Star } from "lucide-react";
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
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">{driver.name}</p>
        <p className="text-xs text-ink/60">
          {driver.carModel} &middot; {driver.carColor} &middot; {driver.plate}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning">
          <Star className="h-3 w-3 fill-warning" /> {driver.rating.toFixed(1)}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setToast(t("driver.callDemoNote"))}
          aria-label={t("driver.call")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-10 text-accent"
        >
          <Phone className="h-4 w-4" />
        </button>
        <button
          onClick={() => setToast(t("driver.messageDemoNote"))}
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
