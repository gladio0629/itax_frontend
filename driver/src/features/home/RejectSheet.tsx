import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { isKey, useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Skeleton } from "@/components/Skeleton";

/** "Rad etish": an optional reason, then the request is hidden for this driver only. */
export function RejectSheet({ open, busy, onClose, onConfirm }: { open: boolean; busy: boolean; onClose: () => void; onConfirm: (reasonKey?: string) => void }) {
  const { t } = useT();
  const reasons = useQuery(() => api.getRejectReasons(), []);
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => {
    if (open) setChoice(null);
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title={t("reject.title")}>
      <p className="mb-4 text-sm text-muted">{t("reject.desc")}</p>
      <div role="group" aria-label={t("reject.reasons")} className="flex flex-wrap gap-2">
        {reasons.data
          ? reasons.data.map((r) => (
              <Chip key={r.key} selected={choice === r.key} onClick={() => setChoice(choice === r.key ? null : r.key)}>
                {isKey(r.key) ? t(r.key) : r.key}
              </Chip>
            ))
          : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 w-28 rounded-button" />)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 pb-1">
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="danger" loading={busy} onClick={() => onConfirm(choice ?? undefined)}>
          {t("feed.reject")}
        </Button>
      </div>
    </Sheet>
  );
}
