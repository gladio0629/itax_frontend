import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { BottomSheet, DangerButton } from "@/ui";

const REASON_KEYS: TranslationKey[] = [
  "cancel.reason.plansChanged",
  "cancel.reason.waitedTooLong",
  "cancel.reason.priceReconsidered",
  "cancel.reason.choseAnotherWay",
  "cancel.reason.other",
];

/** "Buyurtmani bekor qilish": pick a reason, then cancel. */
export function CancelSheet({ onClose, onConfirm, loading, error }: { onClose: () => void; onConfirm: (reason: string) => void; loading?: boolean; error?: string | null }) {
  const { t } = useT();
  const [reason, setReason] = useState<TranslationKey | null>(null);
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t("cancel.title")}
      closeLabel={t("common.close")}
      footer={
        <>
          {error && (
            <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
              {error}
            </p>
          )}
          <DangerButton disabled={!reason} loading={loading} onClick={() => reason && onConfirm(reason)}>
            {t("cancel.confirmAction")}
          </DangerButton>
        </>
      }
    >
      <p id="cancel-reason" className="text-[14px] text-iz-muted">
        {t("cancel.pickReason")}
      </p>
      <div role="radiogroup" aria-labelledby="cancel-reason" className="flex flex-col gap-2">
        {REASON_KEYS.map((key) => {
          const on = reason === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setReason(key)}
              className={cn(
                "flex min-h-[52px] items-center gap-3 rounded-iz-field border-2 px-4 text-left text-[15px] font-bold text-iz-ink",
                on ? "border-iz-ink bg-iz-field-focus" : "border-transparent bg-iz-field"
              )}
            >
              <span aria-hidden className={cn("h-5 w-5 shrink-0 rounded-full", on ? "border-[6px] border-iz-ink bg-iz-sheet" : "border-2 border-iz-dash")} />
              {t(key)}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
