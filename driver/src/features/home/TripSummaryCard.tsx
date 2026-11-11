import { useEffect } from "react";
import type { TripSummary } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { Check, Gift } from "@/lib/icons";
import { Money } from "@/components/Money";
import { Stars } from "@/components/Stars";
import { formatAmount } from "@/lib/format";
import { useCountUp } from "@/lib/useCountUp";

const AUTO_DISMISS_MS = 3000;

/** Brief post-trip card. Dismisses itself after 3s (bar shows the time) or on tap. */
export function TripSummaryCard({ summary, onDismiss }: { summary: TripSummary; onDismiss: () => void }) {
  const { t } = useT();
  const net = useCountUp(summary.net, 600);
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.tripId]);

  return (
    <button
      type="button"
      onClick={onDismiss}
      className="press relative block w-full animate-sheet-up overflow-hidden rounded-sheet bg-surface p-5 text-left shadow-2"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 animate-check-pop items-center justify-center rounded-full bg-success text-bg">
          <Check className="h-5 w-5" />
        </span>
        <p className="text-lg font-bold text-ink">{t("summary.title")}</p>
      </div>

      <p className="mt-4 text-sm text-muted">{t("summary.earned")}</p>
      <Money value={net} className="text-4xl font-bold text-gold" />

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{t("summary.fare")}</dt>
          <dd className="tabular text-ink">{formatAmount(summary.gross)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">{t("summary.commission", { pct: summary.baseCommissionPct })}</dt>
          <dd className="tabular flex items-center gap-2">
            {summary.commissionWaived && <s className="text-muted">{formatAmount(-summary.baseCommission)}</s>}
            <span className="text-ink">{formatAmount(-summary.commission)}</span>
          </dd>
        </div>
        {summary.commissionWaived && (
          <div className="flex items-center gap-2 text-gold">
            <Gift className="h-4 w-4" />
            <span>{t("summary.bonusApplied")}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <dt className="text-muted">{t("summary.rating")}</dt>
          <dd>{summary.ratingReceived ? <Stars value={summary.ratingReceived} size={16} /> : <span className="text-muted">{t("summary.noRating")}</span>}</dd>
        </div>
      </dl>
      {summary.payment === "cash" && <p className="mt-3 text-sm text-ink">{t("summary.cashNote")}</p>}

      <span className="sr-only">{t("summary.dismiss")}</span>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-ink/10">
        <span className="absolute inset-0 origin-left animate-[deplete_3s_linear_both] bg-yellow" />
      </span>
    </button>
  );
}
