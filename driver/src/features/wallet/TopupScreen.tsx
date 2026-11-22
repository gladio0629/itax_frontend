import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { PayProvider } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { errorMessage } from "@/lib/errors";
import { formatAmount } from "@/lib/format";
import { Check } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/Card";
import { ProviderTile, providerName } from "./ProviderTile";
import { cn } from "@/lib/cn";

type Method = { provider: PayProvider; cardId?: string };

/**
 * To'ldirish (design v2): the amount is typed on the Ink top (presets from
 * the server under it), then the payment method: Payme, Click or a saved
 * card. The balance shown is the server's; no "after top-up" figure is
 * computed here (fees, if any, are the provider's and the server's).
 */
export default function TopupScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const opts = useQuery(() => api.getTopupOptions(), []);
  const wallet = useQuery(() => api.getWallet(), []);
  const [amount, setAmount] = useState<number>(() => Math.max(0, Number(params.get("amount")) || 0));
  const [method, setMethod] = useState<Method>({ provider: "payme" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const o = opts.data;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.requestTopup(amount, method.provider, method.cardId);
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

  if (done || reviewId) {
    return (
      <Screen back="/wallet" title={t("topup.titleShort")}>
        {done ? (
          <div className="flex animate-fade-up flex-col items-center py-10 text-center">
            <span className="mb-5 flex h-20 w-20 animate-check-pop items-center justify-center rounded-full bg-brand text-on-brand">
              <Check className="h-9 w-9" />
            </span>
            <p className="text-xl font-extrabold text-ink">{t("topup.done")}</p>
            <p className="tabular mt-2 text-3xl font-extrabold text-brand-ink">+{formatAmount(amount)}</p>
            <Button size="lg" fullWidth className="mt-8" onClick={() => navigate("/wallet", { replace: true })}>
              {t("topup.back")}
            </Button>
          </div>
        ) : (
          reviewId && (
            <ReviewStatus reviewId={reviewId} title={t("topup.reviewTitle")} description={t("topup.reviewDesc")} onApproved={() => setDone(true)} onRejected={() => setReviewId(null)} />
          )
        )}
      </Screen>
    );
  }

  const methods: Array<Method & { key: string; title: string; sub: string }> = [
    ...(o?.providers ?? []).map((p) => ({ key: p, provider: p, title: providerName(p), sub: t("topup.viaApp") })),
    ...(o?.savedCards ?? []).map((c) => ({ key: c.id, provider: c.provider, cardId: c.id, title: `${c.brand === "humo" ? "Humo" : "Uzcard"} •••• ${c.last4}`, sub: t("topup.savedCard") })),
  ];
  const limits = o && (o.min != null || o.max != null) ? [o.min != null && t("topup.limitsMin", { min: formatAmount(o.min) }), o.max != null && t("topup.limitsMax", { max: formatAmount(o.max) })].filter(Boolean).join(" · ") : null;

  return (
    <Screen
      back="/wallet"
      title={t("topup.titleShort")}
      keepTop
      top={
        <label className="flex flex-col items-center gap-2 pt-1.5 text-center" onClick={() => input.current?.focus()}>
          <span className="label-caps text-night-muted">{t("topup.amount")}</span>
          <span className="flex items-baseline justify-center gap-2">
            <input
              ref={input}
              inputMode="numeric"
              autoComplete="off"
              aria-label={t("topup.amountInput")}
              placeholder="0"
              value={amount ? formatAmount(amount) : ""}
              onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "").slice(0, 9)) || 0)}
              className="tabular w-full max-w-[260px] bg-transparent text-right text-[44px] font-extrabold leading-[1.1] tracking-[-0.5px] text-white outline-none placeholder:text-night-muted focus-visible:outline-none"
              style={{ width: `${Math.max(1, (amount ? formatAmount(amount) : "0").length) * 0.62}em` }}
            />
            <span className="text-17 font-bold text-night-muted">{t("common.som")}</span>
          </span>
          {wallet.data && <span className="tabular text-13 font-semibold text-night-muted">{t("topup.balance", { amount: formatAmount(wallet.data.balance) })}</span>}
          {limits && <span className="text-xs text-night-muted">{limits}</span>}
        </label>
      }
      footer={
        o && (
          <Button size="lg" fullWidth loading={busy} disabled={amount <= 0} onClick={submit}>
            {amount > 0 ? t("topup.submit", { amount: `${formatAmount(amount)} ${t("common.som")}` }) : t("topup.submitEmpty")}
          </Button>
        )
      }
    >
      {opts.error && !o ? (
        <ErrorState error={opts.error} onRetry={() => opts.reload()} />
      ) : !o ? (
        <Skeleton className="h-64 rounded-card" />
      ) : (
        <div className="flex flex-col gap-4 pb-2">
          {o.presets.length > 0 && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label={t("topup.amount")}>
              {o.presets.map((p) => (
                <Chip key={p} selected={amount === p} onClick={() => setAmount(p)} className="tabular h-11 px-4 text-sm">
                  {formatAmount(p)}
                </Chip>
              ))}
            </div>
          )}
          <SectionLabel className="mb-0">{t("topup.method")}</SectionLabel>
          <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={t("topup.method")}>
            {methods.map((m) => {
              const on = method.provider === m.provider && method.cardId === m.cardId;
              const card = m.cardId ? o.savedCards?.find((c) => c.id === m.cardId) : undefined;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMethod({ provider: m.provider, cardId: m.cardId })}
                  className={cn("press flex min-h-[68px] w-full items-center gap-3.5 rounded-field border-2 px-4 text-left", on ? "border-ink bg-surface" : "border-raised bg-raised")}
                >
                  <ProviderTile provider={m.provider} card={card} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="tabular truncate text-15 font-extrabold text-ink">{m.title}</span>
                    <span className="text-xs font-semibold text-muted">{m.sub}</span>
                  </span>
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-ink" : "border-line")} aria-hidden="true">
                    {on && <span className="h-3 w-3 rounded-full bg-ink" />}
                  </span>
                </button>
              );
            })}
          </div>
          {error && (
            <p role="alert" className="rounded-field bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Screen>
  );
}
