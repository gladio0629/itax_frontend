import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { PayProvider } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { errorMessage } from "@/lib/errors";
import { formatAmount, formatShort } from "@/lib/format";
import { Check } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, SectionLabel } from "@/components/Card";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { TextField } from "@/components/TextField";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Money } from "@/components/Money";
import { ProviderTile, providerName } from "./ProviderTile";
import { cn } from "@/lib/cn";

export default function TopupScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const opts = useQuery(() => api.getTopupOptions(), []);
  const [preset, setPreset] = useState<number | "custom" | null>(null);
  const [custom, setCustom] = useState("");
  const [provider, setProvider] = useState<PayProvider>("payme");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const wallet = useQuery(() => (done ? api.getWallet() : Promise.resolve(null)), [done]);

  const amount = preset === "custom" ? Number(custom.replace(/\D/g, "")) || 0 : preset ?? 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.requestTopup(amount, provider);
      // Real backend: pay on the provider's page (Payme / Click), then return.
      if (r.redirectUrl) {
        window.location.assign(r.redirectUrl);
        return;
      }
      setReviewId(r.id);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("topup.title")} back="/wallet" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {done ? (
          <div className="flex animate-fade-up flex-col items-center py-10 text-center">
            <span className="mb-5 flex h-20 w-20 animate-check-pop items-center justify-center rounded-full bg-success text-bg">
              <Check className="h-9 w-9" />
            </span>
            <p className="text-xl font-bold text-ink">{t("topup.done")}</p>
            <Money value={amount} signed className="mt-2 text-3xl font-bold text-brand-ink" />
            {wallet.data && <p className="tabular mt-3 text-sm text-muted">{t("topup.balanceNow", { amount: `${formatAmount(wallet.data.balance)} ${t("common.som")}` })}</p>}
            <Button size="lg" fullWidth className="mt-8" onClick={() => navigate("/wallet", { replace: true })}>
              {t("topup.back")}
            </Button>
          </div>
        ) : reviewId ? (
          <Card className="p-4">
            <ReviewStatus reviewId={reviewId} title={t("topup.reviewTitle")} description={t("topup.reviewDesc")} onApproved={() => setDone(true)} onRejected={() => setReviewId(null)} />
          </Card>
        ) : opts.error ? (
          <ErrorState error={opts.error} onRetry={() => opts.reload()} />
        ) : !opts.data ? (
          <Skeleton className="h-64 rounded-card" />
        ) : (
          <form
            className="flex min-h-full flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <SectionLabel>{t("topup.amount")}</SectionLabel>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("topup.amount")}>
              {opts.data.presets.map((p) => (
                <Chip key={p} selected={preset === p} onClick={() => setPreset(p)} className="tabular h-14 rounded-button text-lg font-bold">
                  {formatShort(p)}
                </Chip>
              ))}
              <Chip selected={preset === "custom"} onClick={() => setPreset("custom")} className="col-span-2 h-14 rounded-button">
                {t("topup.custom")}
              </Chip>
            </div>
            {preset === "custom" && (
              <TextField
                className="mt-3 animate-fade-up"
                label={t("topup.amountLabel")}
                inputMode="numeric"
                name="amount"
                autoComplete="off"
                autoFocus
                value={custom ? formatAmount(Number(custom)) : ""}
                onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 7))}
                hint={t("topup.limits", { min: formatAmount(opts.data.min), max: formatAmount(opts.data.max) })}
                placeholder="50 000"
              />
            )}

            <SectionLabel className="mt-6">{t("topup.method")}</SectionLabel>
            <div className="space-y-2" role="radiogroup" aria-label={t("topup.method")}>
              {opts.data.providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={provider === p}
                  onClick={() => setProvider(p)}
                  className={cn("press flex h-16 w-full items-center gap-3 rounded-card bg-surface px-4 text-left shadow-1", provider === p && "ring-2 ring-inset ring-brand")}
                >
                  <ProviderTile provider={p} />
                  <span className="flex-1 text-base font-bold text-ink">{providerName(p)}</span>
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border-2", provider === p ? "border-brand bg-brand text-on-brand" : "border-ink/30")}>
                    {provider === p && <Check className="h-4 w-4" />}
                  </span>
                </button>
              ))}
            </div>

            {error && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="mt-auto pt-6">
              <Button type="submit" size="lg" fullWidth loading={busy}>
                {amount > 0 ? t("topup.submit", { amount: `${formatAmount(amount)} ${t("common.som")}` }) : t("topup.submitEmpty")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
