import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { useT, isKey } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { api } from "@/api/client";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

export function CancelSheet({ open, onClose, onConfirm, busy }: { open: boolean; onClose: () => void; onConfirm: (reasonKey: string) => void; busy: boolean }) {
  const { t } = useT();
  const reasons = useQuery(() => api.getCancelReasons(), [open]);
  const [choice, setChoice] = useState<string | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title={t("trip.cancelTitle")}>
      <p className="mb-4 text-sm text-muted">{t("trip.cancelDesc")}</p>
      <div role="radiogroup" aria-label={t("trip.cancelTitle")} className="space-y-2">
        {reasons.data
          ? reasons.data.map((r) => (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={choice === r.key}
                onClick={() => setChoice(r.key)}
                className={cn(
                  "press flex h-14 w-full items-center gap-3 rounded-button px-4 text-left text-base",
                  choice === r.key ? "bg-yellow/15 text-ink ring-2 ring-inset ring-yellow" : "bg-raised text-ink"
                )}
              >
                <span className={cn("h-5 w-5 shrink-0 rounded-full border-2", choice === r.key ? "border-yellow bg-yellow shadow-[inset_0_0_0_3px_var(--color-surface)]" : "border-ink/30")} />
                {isKey(r.key) ? t(r.key) : r.key}
              </button>
            ))
          : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 pb-1">
        <Button variant="secondary" onClick={onClose}>
          {t("trip.cancelKeep")}
        </Button>
        <Button variant="danger" disabled={!choice} loading={busy} onClick={() => choice && onConfirm(choice)}>
          {t("trip.cancelConfirm")}
        </Button>
      </div>
    </Sheet>
  );
}
