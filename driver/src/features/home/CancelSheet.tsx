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
  const [missing, setMissing] = useState(false);

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
                onClick={() => {
                  setChoice(r.key);
                  setMissing(false);
                }}
                className={cn(
                  "press flex h-14 w-full items-center gap-3 rounded-button px-4 text-left text-base",
                  choice === r.key ? "bg-brand/15 text-ink ring-2 ring-inset ring-brand" : "bg-raised text-ink"
                )}
              >
                <span className={cn("h-5 w-5 shrink-0 rounded-full border-2", choice === r.key ? "border-brand bg-brand shadow-[inset_0_0_0_3px_rgb(var(--color-surface-rgb))]" : "border-ink/30")} />
                {isKey(r.key) ? t(r.key) : r.key}
              </button>
            ))
          : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
      {missing && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {t("trip.cancelPick")}
        </p>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3 pb-1">
        <Button variant="secondary" onClick={onClose}>
          {t("trip.cancelKeep")}
        </Button>
        <Button variant="danger" loading={busy} onClick={() => (choice ? onConfirm(choice) : setMissing(true))}>
          {t("trip.cancelConfirm")}
        </Button>
      </div>
    </Sheet>
  );
}
