// /wallet/debt — "Qarz holati": balance against the debt limit, what the
// limit means right now, and the server's minimum / suggested top-up.
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { formatAmount } from "@/lib/format";
import { AlertTriangle, Check, HelpCircle } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

export default function WalletDebtScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const wallet = useQuery(() => api.getWallet(), []);
  const d = wallet.data?.debt;
  const level = d?.level ?? "ok";
  const tone = level === "blocked" ? "danger" : level === "near" ? "warning" : "ok";
  const topupTo = d?.recommendedTopup ? `/wallet/topup?amount=${d.recommendedTopup}` : "/wallet/topup";

  return (
    <Screen
      back="/wallet"
      title={t("debt.title")}
      top={
        d ? (
          <div className="flex flex-col gap-3">
            <span className="flex flex-col gap-1.5">
              <span className={cn("label-caps", tone === "danger" ? "text-night-danger" : "text-night-muted")}>{t("wallet.balanceLabel")}</span>
              <span className={cn("tabular whitespace-nowrap text-[42px] font-extrabold leading-[1.1]", d.balance < 0 ? "text-night-danger" : "text-white")}>
                {formatAmount(d.balance)} <span className="text-17 font-bold text-night-muted">{t("common.som")}</span>
              </span>
            </span>
            <span className="relative block h-2 overflow-hidden rounded-full bg-night-line" aria-hidden="true">
              <span
                className={cn("absolute inset-y-0 left-0 rounded-full", tone === "danger" ? "bg-night-danger" : tone === "warning" ? "bg-warning-icon" : "bg-brand")}
                style={{ width: `${Math.round(d.usedRatio * 100)}%` }}
              />
            </span>
            <span className="flex justify-between text-xs font-semibold text-night-muted">
              <span className="tabular">0</span>
              <span className="tabular">{t("debt.limitShort", { amount: formatAmount(d.limit) })}</span>
            </span>
          </div>
        ) : !wallet.error ? (
          <Skeleton className="h-28 w-full rounded-card bg-night-2" />
        ) : undefined
      }
      footer={
        d && (
          <Button size="lg" fullWidth onClick={() => navigate(topupTo)}>
            {t("debt.topup")}
          </Button>
        )
      }
    >
      {wallet.error && !d ? (
        <ErrorState error={wallet.error} onRetry={() => wallet.reload()} />
      ) : !d ? null : (
        <div className="flex flex-col gap-5">
          <div role={tone === "ok" ? undefined : "alert"} className={cn("flex gap-3.5 rounded-field p-4", tone === "danger" ? "bg-danger-soft" : tone === "warning" ? "bg-warning-soft" : "bg-brand-soft")}>
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-tile",
                tone === "danger" ? "bg-danger/10 text-danger" : tone === "warning" ? "bg-warning-icon/15 text-warning" : "bg-brand/20 text-brand-ink"
              )}
              aria-hidden="true"
            >
              {tone === "ok" ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className={cn("text-17 font-extrabold", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-brand-ink")}>
                {t(level === "blocked" ? "debt.blockedTitle" : level === "near" ? "debt.nearTitle" : "debt.okTitle")}
              </span>
              <span className="text-sm leading-[20px] text-ink">{t(level === "blocked" ? "debt.blockedDesc" : level === "near" ? "debt.nearDesc" : "debt.okDesc")}</span>
            </span>
          </div>

          {(d.minToUnblock != null || d.recommendedTopup != null) && (
            <dl className="flex flex-col">
              {d.minToUnblock != null && (
                <div className="flex min-h-[48px] items-center justify-between border-b border-line">
                  <dt className="text-sm font-semibold text-muted">{t("debt.minToUnblock")}</dt>
                  <dd className="tabular text-15 font-bold text-ink">
                    {formatAmount(d.minToUnblock)} {t("common.som")}
                  </dd>
                </div>
              )}
              {d.recommendedTopup != null && (
                <div className="flex min-h-[48px] items-center justify-between">
                  <dt className="text-15 font-bold text-ink">{t("debt.recommended")}</dt>
                  <dd className="tabular text-17 font-extrabold text-brand-ink">
                    {formatAmount(d.recommendedTopup)} {t("common.som")}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <p className="flex items-start gap-2.5 rounded-[18px] bg-raised p-4 text-13 leading-[19px] text-muted">
            <HelpCircle className="mt-px h-4 w-4 shrink-0" />
            {t("debt.note")}
          </p>
        </div>
      )}
    </Screen>
  );
}
