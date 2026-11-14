import { useState } from "react";
import { X } from "@/lib/icons";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { useIsIOS } from "@/lib/platform";
import { ListRow, ListSection } from "@/components/ios/List";
import { Alert } from "@/components/ios/Alert";

const REASON_KEYS: TranslationKey[] = [
  "cancel.reason.plansChanged",
  "cancel.reason.waitedTooLong",
  "cancel.reason.priceReconsidered",
  "cancel.reason.choseAnotherWay",
  "cancel.reason.other",
];

export function CancelSheet({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}) {
  const { t } = useT();
  const [reason, setReason] = useState<TranslationKey | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (useIsIOS()) {
    // iOS: pick the reason in a grouped list, confirm in a destructive alert.
    return (
      <>
        <Sheet open onClose={onClose} ariaLabel={t("cancel.title")}>
          <div className="pb-3 pt-1">
            <div className="mb-2 flex items-center justify-between gap-3 px-4">
              <h2 className="ios-headline text-ink">{t("cancel.title")}</h2>
              <button onClick={onClose} aria-label={t("common.close")} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--ios-fill-tertiary)] text-[color:var(--ios-label-secondary)]">
                  <X className="h-4 w-4" strokeWidth={2.6} />
                </span>
              </button>
            </div>
            <div role="radiogroup" aria-label={t("cancel.pickReason")}>
              <ListSection header={t("cancel.pickReason")} className="!mx-4 !mb-5">
                {REASON_KEYS.map((key) => (
                  <ListRow key={key} radio title={t(key)} checked={reason === key} onClick={() => setReason(key)} chevron={false} />
                ))}
              </ListSection>
            </div>
            <div className="px-4">
              <Button fullWidth variant="danger" disabled={!reason} loading={loading} onClick={() => reason && setConfirmOpen(true)}>
                {t("cancel.confirmAction")}
              </Button>
            </div>
          </div>
        </Sheet>
        <Alert
          open={confirmOpen && !!reason}
          title={t("cancel.alertTitle")}
          message={reason ? t("cancel.alertMessage", { reason: t(reason) }) : undefined}
          onCancel={() => setConfirmOpen(false)}
          actions={[
            { label: t("cancel.alertKeep"), style: "cancel", onPress: () => setConfirmOpen(false) },
            {
              label: t("cancel.alertConfirm"),
              style: "destructive",
              loading,
              onPress: () => {
                setConfirmOpen(false);
                if (reason) onConfirm(reason);
              },
            },
          ]}
        />
      </>
    );
  }

  return (
    <Sheet open onClose={onClose} ariaLabel={t("cancel.title")}>
      <div className="px-5 pb-3 pt-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">{t("cancel.title")}</h2>
          <button onClick={onClose} aria-label={t("common.close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/70">
              <X className="h-4 w-4" />
            </span>
          </button>
        </div>
        <p className="mb-3 text-xs text-ink/60">{t("cancel.pickReason")}</p>
        <div className="mb-5 space-y-2" role="radiogroup" aria-label={t("cancel.pickReason")}>
          {REASON_KEYS.map((key) => (
            <button
              key={key}
              role="radio"
              aria-checked={reason === key}
              onClick={() => setReason(key)}
              className={cn(
                "flex min-h-[48px] w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-normal transition-colors",
                reason === key ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/80"
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 shrink-0 rounded-full border-2",
                  reason === key ? "border-accent bg-accent" : "border-ink/30"
                )}
                aria-hidden="true"
              />
              {t(key)}
            </button>
          ))}
        </div>
        <Button fullWidth variant="danger" disabled={!reason} loading={loading} onClick={() => reason && onConfirm(reason)}>
          {t("cancel.confirmAction")}
        </Button>
      </div>
    </Sheet>
  );
}
