import { useEffect, useRef, useState } from "react";
import { Check, Clock3, Coins } from "@/lib/icons";
import { api } from "@/api/client";
import type { TipOptions } from "@/api/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Skeleton } from "@/components/Skeleton";
import { formatNumber, formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

type Choice = { kind: "preset"; amount: number } | { kind: "custom" };

/**
 * "Haydovchiga choy puli" — chips from the adapter (0 = no tip) plus
 * "Boshqa summa" within the adapter's range. Sending goes through the review
 * mechanism; once sent, the card shows the amount and its status instead.
 * Renders nothing when the order can't take a tip.
 */
export function TipCard({ orderId, className }: { orderId: string; className?: string }) {
  const { t, intlTag } = useT();
  const [opts, setOpts] = useState<TipOptions | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [choice, setChoice] = useState<Choice>({ kind: "preset", amount: 0 });
  const [custom, setCustom] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoadError(false);
    api.getTipOptions(orderId).then(setOpts).catch(() => setLoadError(true));
  }
  useEffect(load, [orderId]);

  // While the review is pending, check back until it settles.
  const pending = opts?.sent?.status === "pending";
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => api.getTipOptions(orderId).then(setOpts).catch(() => {}), 1500);
    return () => window.clearInterval(id);
  }, [pending, orderId]);

  if (loadError) {
    return (
      <Card className={cn("p-5", className)}>
        <button onClick={load} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
          {t("common.loadFailedRetry")}
        </button>
      </Card>
    );
  }
  if (!opts) return <Skeleton className={cn("h-[148px] w-full rounded-2xl", className)} />;

  if (opts.sent) {
    const s = opts.sent.status;
    return (
      <Card className={cn("flex items-center gap-3 p-5", className)}>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", s === "approved" ? "bg-accent text-bg" : "bg-accent-10 text-accent")}>
          {s === "approved" ? <Check className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
        </span>
        <div aria-live="polite">
          <p className="text-sm font-semibold text-ink tabular">{t("tip.sentTitle", { amount: formatSom(opts.sent.amount, intlTag) })}</p>
          <p className={cn("text-xs", s === "rejected" ? "text-danger" : "text-ink/60")}>{t(`tip.status.${s}` as TranslationKey)}</p>
        </div>
      </Card>
    );
  }
  if (!opts.allowed) return null;

  const amount = choice.kind === "preset" ? choice.amount : Number(custom || 0);
  const range = t("tip.range", { min: formatSom(opts.min, intlTag), max: formatSom(opts.max, intlTag) });

  async function send() {
    setSending(true);
    setError(null);
    try {
      await api.sendTip(orderId, amount);
      setOpts(await api.getTipOptions(orderId).catch(() => opts));
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(e.code?.startsWith("TIP_") && e.message ? t(e.message as TranslationKey) : t("tip.sendError"));
      if (e.code === "TIP_RANGE") customRef.current?.focus();
    } finally {
      setSending(false);
    }
  }

  const chip = (selected: boolean) =>
    cn(
      "min-h-[40px] rounded-full border px-3.5 text-sm font-semibold transition-colors tabular",
      selected ? "border-accent bg-accent text-bg" : "border-border text-ink/80 hover:border-accent/40"
    );

  return (
    <Card className={cn("p-5", className)}>
      <p id={`tip-${orderId}`} className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Coins className="h-4 w-4 text-accent" /> {t("tip.title")}
      </p>
      <div role="radiogroup" aria-labelledby={`tip-${orderId}`} className="flex flex-wrap gap-2">
        {opts.presets.map((p) => {
          const on = choice.kind === "preset" && choice.amount === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setChoice({ kind: "preset", amount: p });
                setError(null);
              }}
              className={chip(on)}
            >
              {p === 0 ? t("tip.none") : formatNumber(p, intlTag)}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={choice.kind === "custom"}
          onClick={() => {
            setChoice({ kind: "custom" });
            setError(null);
            window.setTimeout(() => customRef.current?.focus(), 0);
          }}
          className={chip(choice.kind === "custom")}
        >
          {t("tip.custom")}
        </button>
      </div>

      {choice.kind === "custom" && (
        <div className="mt-3">
          <Input
            ref={customRef}
            label={t("tip.customLabel")}
            name="tip-amount"
            autoComplete="off"
            inputMode="numeric"
            placeholder={`${formatNumber(opts.presets[opts.presets.length - 1] ?? opts.min, intlTag)}…`}
            value={custom ? formatNumber(Number(custom), intlTag) : ""}
            onChange={(e) => {
              setCustom(e.target.value.replace(/\D/g, "").slice(0, 9));
              setError(null);
            }}
            rightSlot={<span className="shrink-0 text-sm text-ink/60">so'm</span>}
            hint={error ? undefined : range}
            error={error ?? undefined}
          />
        </div>
      )}
      {error && choice.kind !== "custom" && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      {amount > 0 && (
        <Button fullWidth className="mt-4" loading={sending} onClick={send}>
          {t("tip.sendAmount", { amount: formatSom(amount, intlTag) })}
        </Button>
      )}
    </Card>
  );
}
