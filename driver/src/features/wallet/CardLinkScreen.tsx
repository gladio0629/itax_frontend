import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { PayProvider } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { errorMessage } from "@/lib/errors";
import { Check, Info, ShieldCheck } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { Card, SectionLabel } from "@/components/Card";
import { Button } from "@/components/Button";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ProviderTile, providerName } from "./ProviderTile";
import { cn } from "@/lib/cn";

/** Choose provider → simulated provider page → submitForReview → done. */
export default function CardLinkScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<PayProvider>("payme");
  const [step, setStep] = useState<"choose" | "provider" | "review" | "done">("choose");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.linkCard(provider);
      // Real backend: the provider's own page links the card, then returns to the app.
      if (r.redirectUrl) {
        window.location.assign(r.redirectUrl);
        return;
      }
      setReviewId(r.id);
      setStep("review");
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back="/wallet/cards" title={t("cards.link")} bodyClassName="flex flex-col">
        {step === "choose" && (
          <>
            <SectionLabel>{t("cards.provider")}</SectionLabel>
            <div className="space-y-2" role="radiogroup" aria-label={t("cards.provider")}>
              {(["payme", "click"] as PayProvider[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={provider === p}
                  onClick={() => setProvider(p)}
                  className={cn("press flex min-h-[68px] w-full items-center gap-3.5 rounded-field border-2 px-4 text-left", provider === p ? "border-ink bg-surface" : "border-raised bg-raised")}
                >
                  <ProviderTile provider={p} />
                  <span className="flex-1 text-base font-bold text-ink">{providerName(p)}</span>
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border-2", provider === p ? "border-ink" : "border-line")} aria-hidden="true">
                    {provider === p && <span className="h-3 w-3 rounded-full bg-ink" />}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 flex gap-2 px-1 text-sm text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              {t("cards.providerHint", { provider: providerName(provider) })}
            </p>
            <div className="mt-auto pt-6">
              <Button size="lg" fullWidth onClick={() => setStep("provider")}>
                {t("cards.continueTo", { provider: providerName(provider) })}
              </Button>
            </div>
          </>
        )}

        {step === "provider" && (
          // Simulated third-party page: deliberately neutral, with a test notice.
          <div className="flex flex-1 animate-fade-up flex-col">
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line bg-raised px-4 py-3">
                <ProviderTile provider={provider} />
                <p className="text-base font-bold text-ink">{t("cards.providerPage", { provider: providerName(provider) })}</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex h-14 items-center rounded-field bg-raised px-4 text-base tracking-widest text-muted" aria-hidden="true">
                  8600 •••• •••• ••••
                </div>
                <div className="grid grid-cols-2 gap-3" aria-hidden="true">
                  <div className="flex h-14 items-center rounded-field bg-raised px-4 text-muted">MM/YY</div>
                  <div className="flex h-14 items-center rounded-field bg-raised px-4 text-muted">SMS</div>
                </div>
                <p className="flex gap-2 rounded-field bg-warning-soft p-3 text-sm text-ink">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  {t("cards.providerTest")}
                </p>
              </div>
            </Card>
            {error && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="mt-auto space-y-1 pt-6">
              <Button size="lg" fullWidth loading={busy} onClick={confirm}>
                {t("common.confirm")}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setStep("choose")}>
                {t("common.back")}
              </Button>
            </div>
          </div>
        )}

        {step === "review" && reviewId && (
          <Card className="p-4">
            <ReviewStatus reviewId={reviewId} title={t("cards.reviewTitle")} description={t("cards.reviewDesc")} onApproved={() => setStep("done")} onRejected={() => setStep("choose")} />
          </Card>
        )}

        {step === "done" && (
          <div className="flex flex-1 animate-fade-up flex-col items-center py-10 text-center">
            <span className="mb-5 flex h-20 w-20 animate-check-pop items-center justify-center rounded-full bg-brand text-on-brand">
              <Check className="h-9 w-9" />
            </span>
            <p className="text-xl font-bold text-ink">{t("cards.success")}</p>
            <div className="mt-auto w-full pt-8">
              <Button size="lg" fullWidth onClick={() => navigate("/wallet/cards", { replace: true })}>
                {t("common.done")}
              </Button>
            </div>
          </div>
        )}
    </Screen>
  );
}
