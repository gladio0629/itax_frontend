import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { OrderTiming, PayMethod, Quote, SavedCard } from "@/api/types";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { serverErrorKey } from "@/lib/apiError";
import { cn } from "@/lib/cn";
import { Icon, PrimaryButton, Screen, SectionLabel, Steps, type IconName } from "@/ui";
import { timingSummary } from "@/features/order/timingSummary";
import { stepNames } from "./TripScreen";

type Load<T> = { status: "loading" } | { status: "error" } | { status: "success"; data: T };

function MethodTile({
  selected,
  title,
  subtitle,
  icon,
  letter,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  icon?: IconName;
  letter?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex h-[92px] flex-col justify-between rounded-[22px] border-2 px-3.5 py-3 text-left",
        selected ? "border-iz-ink bg-iz-field-focus shadow-[0_0_0_4px_var(--iz-focus-ring)]" : "border-transparent bg-iz-field"
      )}
    >
      <span className="flex items-start justify-between">
        <span
          aria-hidden
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-[15px] font-extrabold",
            selected ? "bg-iz-green-soft text-iz-green-text" : "bg-iz-sheet text-iz-ink"
          )}
        >
          {icon ? <Icon name={icon} size={18} /> : letter}
        </span>
        {selected && (
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-iz-selected text-iz-selected-accent">
            <Icon name="check" size={14} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="text-[15px] font-extrabold text-iz-ink">{title}</span>
        <span className="truncate text-[12px] text-iz-muted">{subtitle}</span>
      </span>
    </button>
  );
}

/**
 * Step 2 (design: Payment / KbPayment): the server's total and price lines
 * on the dark top, pickup time, payment method (cash, card, Payme, Click),
 * promo code and "Buyurtma berish". With the keyboard up (promo code) the
 * lines and the method grid collapse to one row each.
 */
export function PaymentScreen({
  quote,
  timing,
  method,
  promoCode,
  onMethod,
  onPromo,
  onTime,
  onSubmit,
  submitting,
  submitError,
  onBack,
}: {
  quote: Load<Quote>;
  timing: OrderTiming;
  method: PayMethod;
  promoCode: string;
  onMethod: (m: PayMethod) => void;
  /** An accepted code ("" removes it); the quote re-prices with it. */
  onPromo: (code: string) => void;
  onTime: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
}) {
  const { t, intlTag } = useT();
  const navigate = useNavigate();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [code, setCode] = useState(promoCode);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(
    promoCode ? { ok: true, text: t("pay.promoApplied", { code: promoCode }) } : null
  );

  useEffect(() => {
    // No saved-cards list on the real backend yet (capabilities.savedCards).
    if (!api.capabilities.savedCards) return;
    api.getSavedCards().then(setCards).catch(() => setCards([]));
  }, []);

  async function applyPromo() {
    const c = code.trim();
    if (!c) {
      onPromo("");
      setPromoMsg(null);
      return;
    }
    setPromoBusy(true);
    try {
      const res = await api.applyPromoCode(c);
      if (res.valid) {
        onPromo(res.code);
        setCode(res.code);
        setPromoMsg({ ok: true, text: t("pay.promoApplied", { code: res.code }) });
      } else {
        onPromo("");
        setPromoMsg({ ok: false, text: t((res.messageKey || "promo.invalid") as TranslationKey) });
      }
    } catch (e) {
      setPromoMsg({ ok: false, text: t((serverErrorKey(e) ?? "promo.invalid") as TranslationKey) });
    } finally {
      setPromoBusy(false);
    }
  }

  const card = cards[0];
  const methods: { id: PayMethod; title: string; subtitle: string; icon?: IconName; letter?: string }[] = [
    { id: "cash", title: t("order.cash"), subtitle: t("pay.cashHint"), icon: "cash" },
    { id: "card", title: t("order.card"), subtitle: card ? t("pay.cardSaved", { last4: card.last4 }) : t("pay.cardHint"), icon: "card" },
    { id: "payme", title: t("pay.payme"), subtitle: t("pay.appHint"), letter: "P" },
    { id: "click", title: t("pay.click"), subtitle: t("pay.appHint"), letter: "C" },
  ];
  const current = methods.find((m) => m.id === method) ?? methods[0];

  function pick(id: PayMethod) {
    onMethod(id);
    // "Karta": the saved cards list (link one there), where the backend has it.
    if (id === "card" && api.capabilities.savedCards) navigate("/cards");
  }

  const total = quote.status === "success" ? formatNumber(quote.data.total) : quote.status === "error" ? "—" : "…";
  const lines: ReactNode =
    quote.status === "success" && quote.data.lines.length > 0 ? (
      <dl aria-label={t("pay.linesLabel")} className="flex flex-col gap-2.5">
        {quote.data.lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-3 text-[13px]">
            <dt className="min-w-0 text-iz-head-muted">{t(l.key as TranslationKey, l.params)}</dt>
            <dd className="shrink-0 font-bold tabular-nums text-white">{formatNumber(l.amount)}</dd>
          </div>
        ))}
      </dl>
    ) : null;

  return (
    <Screen
      title={t("pay.title")}
      onBack={onBack}
      top={<Steps steps={stepNames(t)} current={1} label={t("trip.steps")} />}
      topKeep={
        <div className="flex flex-col gap-2.5 rounded-iz-card bg-iz-head-card px-[18px] py-4 kb:bg-transparent kb:p-0">
          <div className="flex items-baseline justify-between" aria-live="polite">
            <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-head-muted">{t("pay.total")}</span>
            <span className="text-[30px] font-extrabold leading-9 tabular-nums text-white kb:text-[28px] kb:leading-[34px]">
              {total} <span className="text-[16px] text-iz-green">so'm</span>
            </span>
          </div>
          {lines && (
            <div className="flex flex-col gap-2.5 kb:hidden">
              <span aria-hidden className="h-0 border-t-2 border-dashed border-iz-head-border" />
              {lines}
            </div>
          )}
        </div>
      }
      bodyClassName="gap-3 pt-[22px]"
      footer={
        <>
          {submitError && (
            <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
              {t(submitError as TranslationKey)}
            </p>
          )}
          <PrimaryButton loading={submitting} disabled={quote.status !== "success"} onClick={onSubmit}>
            {t("order.submit")}
          </PrimaryButton>
        </>
      }
    >
      <button type="button" onClick={onTime} className="flex h-[68px] shrink-0 items-center gap-3 rounded-iz-field bg-iz-field pl-3 pr-3.5 text-left active:opacity-80 kb:hidden">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-selected text-iz-on-selected">
          <Icon name="calendar" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("pay.pickupTime")}</span>
          <span className="truncate text-[16px] font-extrabold text-iz-ink">{timing.timeMode === "now" ? t("time.now") : timingSummary(timing, t, intlTag)}</span>
        </span>
        <span className="shrink-0 text-[13px] font-extrabold text-iz-green-text">{t("pay.change")}</span>
      </button>

      <SectionLabel className="kb:hidden">{t("pay.method")}</SectionLabel>
      <div role="radiogroup" aria-label={t("pay.method")} className="grid grid-cols-2 gap-2.5 kb:hidden">
        {methods.map((m) => (
          <MethodTile key={m.id} selected={m.id === method} title={m.title} subtitle={m.subtitle} icon={m.icon} letter={m.letter} onClick={() => pick(m.id)} />
        ))}
      </div>
      {/* KbPayment: the chosen method as one row. */}
      <div className="hidden h-[68px] shrink-0 items-center gap-3.5 rounded-iz-field bg-iz-field px-3.5 kb:flex">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-green-soft text-[15px] font-extrabold text-iz-green-text">
          {current.icon ? <Icon name={current.icon} /> : current.letter}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("pay.method")}</span>
          <span className="text-[16px] font-extrabold text-iz-ink">{current.title}</span>
        </span>
      </div>

      {api.capabilities.promo && (
        <div className="flex flex-col gap-1.5">
          <label className="group flex h-[68px] cursor-text items-center gap-3.5 rounded-iz-field border-2 border-transparent bg-iz-field pl-3 pr-2.5 focus-within:border-iz-ink focus-within:bg-iz-field-focus focus-within:shadow-[0_0_0_4px_var(--iz-focus-ring)]">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-sheet text-iz-ink group-focus-within:bg-iz-field">
              <Icon name="tag" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("pay.promo")}</span>
              <input
                name="promo"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={t("pay.promoPlaceholder")}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setPromoMsg(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && void applyPromo()}
                className="iz-input h-[22px] w-full min-w-0 border-0 bg-transparent p-0 text-[16px] font-extrabold tracking-[1px] text-iz-ink outline-none placeholder:font-bold placeholder:tracking-normal placeholder:text-iz-muted placeholder:opacity-70"
              />
            </span>
            <button
              type="button"
              onClick={() => void applyPromo()}
              disabled={promoBusy}
              className="h-11 shrink-0 rounded-full bg-iz-selected px-4 text-[13px] font-extrabold text-iz-on-selected disabled:opacity-50"
            >
              {t("promo.apply")}
            </button>
          </label>
          {promoMsg && (
            <span role={promoMsg.ok ? "status" : "alert"} className={cn("px-1 text-[13px] font-semibold", promoMsg.ok ? "text-iz-green-text" : "text-iz-danger")}>
              {promoMsg.text}
            </span>
          )}
        </div>
      )}
    </Screen>
  );
}
