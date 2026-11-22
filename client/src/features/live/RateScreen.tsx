import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import type { OrderWithDetails, RouteSuggestion, TipOptions } from "@/api/types";
import { serverErrorKey } from "@/lib/apiError";
import { formatKm, formatLongDate, formatNumber, formatSom, SOM_LABEL } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { useOrderStore } from "@/stores/orderStore";
import { Chip, Field, Icon, IconButton, PrimaryButton, Screen, SectionLabel, StateError, StateLoading, TextAreaField } from "@/ui";
import { DriverAvatar, payLabel, shortName } from "./LiveParts";

const REASON_KEYS: TranslationKey[] = ["history.reason.polite", "history.reason.conversation", "history.reason.comfort", "history.reason.simple"];
const NOTE_MAX = 200;

type TipChoice = { kind: "preset"; amount: number } | { kind: "custom" };

/**
 * Trip finished (design v2: Rate / KbRate): stars, what was good (with 5
 * stars), an optional tip (the server's amounts and range), a comment and
 * "Yuborish". The rating and the tip are two requests; a part that went
 * through is not sent again. With the keyboard up only the comment and
 * the button stay, and the top shows the chosen rating.
 */
export function RateScreen() {
  const { t, intlTag } = useT();
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const resetDraft = useOrderStore((s) => s.reset);

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tips, setTips] = useState<TipOptions | null>(null);
  const [tipsError, setTipsError] = useState(false);
  const [suggestion, setSuggestion] = useState<RouteSuggestion | null>(null);

  const [rating, setRating] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [tip, setTip] = useState<TipChoice>({ kind: "preset", amount: 0 });
  const [custom, setCustom] = useState("");
  const [ratingSent, setRatingSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customRef = useRef<HTMLInputElement>(null);

  function loadTips() {
    setTipsError(false);
    api
      .getTipOptions(orderId)
      .then(setTips)
      .catch(() => setTipsError(true));
  }

  function load() {
    setLoadError(false);
    api
      .getOrder(orderId)
      .then((o) => {
        setOrder(o);
        if (o.rating) setRating(o.rating);
      })
      .catch(() => setLoadError(true));
    if (api.capabilities.tips) loadTips();
    if (api.capabilities.popularRoutes) api.getPopularRoutes().then((r) => setSuggestion(r[0] ?? null)).catch(() => {});
  }
  useEffect(load, [orderId]);

  // A tip under review: check back until it settles.
  const pending = tips?.sent?.status === "pending";
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => api.getTipOptions(orderId).then(setTips).catch(() => {}), 1500);
    return () => window.clearInterval(id);
  }, [pending, orderId]);

  function leave() {
    resetDraft();
    navigate("/home", { replace: true });
  }

  if (loadError) {
    return (
      <Screen title={t("rate.title")} onBack={leave}>
        <StateError onRetry={load} />
      </Screen>
    );
  }
  if (!order) {
    return (
      <Screen title={t("rate.title")} onBack={leave}>
        <StateLoading rows={3} />
      </Screen>
    );
  }

  const driver = order.driver;
  const driverName = driver?.name ? shortName(driver.name) : t("driver.unnamed");
  const canRate = order.ratingEditable && !ratingSent;
  const tipOpen = !!tips && tips.allowed && !tips.sent;
  const tipAmount = tip.kind === "preset" ? tip.amount : Number(custom || 0);
  const wantsRating = canRate && rating > 0;
  const wantsTip = tipOpen && tipAmount > 0;
  // The comment travels with the rating; without ratingNote only at 5 stars.
  const showNote = canRate && rating > 0 && (api.capabilities.ratingNote || rating === 5);
  const date = formatLongDate(new Date(order.createdAt), intlTag);

  async function send() {
    setSending(true);
    setError(null);
    try {
      if (wantsRating) {
        await api.rateOrder(orderId, rating, rating === 5 ? reasons : [], showNote ? note.trim() || undefined : undefined);
        setRatingSent(true);
      }
    } catch (e) {
      setError(t((serverErrorKey(e) ?? "order.submitError") as TranslationKey));
      setSending(false);
      return;
    }
    try {
      if (wantsTip) {
        await api.sendTip(orderId, tipAmount);
        setTips(await api.getTipOptions(orderId).catch(() => tips));
      }
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(e.code?.startsWith("TIP_") && e.message ? t(e.message as TranslationKey) : t("tip.sendError"));
      if (e.code === "TIP_RANGE") customRef.current?.focus();
      setSending(false);
      return;
    }
    setSending(false);
    leave();
  }

  const stars = (
    <section className="flex flex-col items-center gap-2 kb:hidden" aria-labelledby="rate-q">
      <h2 id="rate-q" className="text-[20px] font-extrabold text-iz-ink">
        {t("rate.question")}
      </h2>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            aria-label={t("rate.star", { n: v })}
            aria-pressed={rating === v}
            disabled={!canRate}
            onClick={() => {
              setRating(v);
              if (v !== 5) setReasons([]);
              setError(null);
            }}
            className="flex h-14 w-14 items-center justify-center active:scale-95 disabled:opacity-100"
          >
            <Icon name="star" size={44} filled className={v <= rating ? "text-iz-ink" : "text-iz-chip-border"} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <span className="flex h-7 items-center rounded-[14px] bg-iz-green-soft px-3 text-[13px] font-extrabold text-iz-green-text">
          {rating} · {t(`rate.label.${rating}` as TranslationKey)}
        </span>
      )}
      {ratingSent && <span className="text-[13px] font-semibold text-iz-green-text">{t("finished.ratingThanks")}</span>}
      {!order.ratingEditable && order.lockedReasonKey && <span className="text-center text-[13px] text-iz-muted">{t(order.lockedReasonKey as TranslationKey)}</span>}
    </section>
  );

  const tipBlock = tips && (tips.sent || tips.allowed) && (
    <section className="flex flex-col gap-2.5 kb:hidden" aria-labelledby="rate-tip">
      <SectionLabel id="rate-tip">{t("rate.tip")}</SectionLabel>
      {tips.sent ? (
        <div className="flex items-center gap-3 rounded-iz-field bg-iz-field px-4 py-3" aria-live="polite">
          <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tips.sent.status === "approved" ? "bg-iz-green text-iz-on-green" : "bg-iz-sheet text-iz-ink")}>
            <Icon name={tips.sent.status === "approved" ? "check" : tips.sent.status === "rejected" ? "close" : "clock"} size={18} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[14px] font-extrabold tabular-nums text-iz-ink">{t("tip.sentTitle", { amount: formatSom(tips.sent.amount, intlTag) })}</span>
            <span className={cn("text-[12px]", tips.sent.status === "rejected" ? "text-iz-danger" : "text-iz-muted")}>{t(`tip.status.${tips.sent.status}` as TranslationKey)}</span>
          </span>
        </div>
      ) : (
        <>
          <div role="group" aria-labelledby="rate-tip" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tips.presets.length + 1}, minmax(0, 1fr))` }}>
            {tips.presets.map((p) => {
              const on = tip.kind === "preset" && tip.amount === p;
              return (
                <Chip
                  key={p}
                  compact
                  check={false}
                  selected={on}
                  onClick={() => {
                    setTip({ kind: "preset", amount: p });
                    setError(null);
                  }}
                >
                  <span className="tabular-nums">{p === 0 ? t("tip.none") : formatNumber(p, intlTag)}</span>
                </Chip>
              );
            })}
            <Chip
              compact
              check={false}
              selected={tip.kind === "custom"}
              onClick={() => {
                setTip({ kind: "custom" });
                setError(null);
                window.setTimeout(() => customRef.current?.focus(), 0);
              }}
            >
              {t("rate.tipOther")}
            </Chip>
          </div>
          {tip.kind === "custom" && (
            <Field
              ref={customRef}
              label={t("tip.customLabel")}
              icon="cash"
              inputMode="numeric"
              autoComplete="off"
              name="tip-amount"
              value={custom ? formatNumber(Number(custom), intlTag) : ""}
              onChange={(e) => {
                setCustom(e.target.value.replace(/\D/g, "").slice(0, 9));
                setError(null);
              }}
              trailing={<span className="shrink-0 text-[14px] font-bold text-iz-muted">{SOM_LABEL}</span>}
              hint={t("tip.range", { min: formatSom(tips.min, intlTag), max: formatSom(tips.max, intlTag) })}
            />
          )}
        </>
      )}
    </section>
  );

  return (
    <Screen
      header={
        <div className="flex items-center justify-between gap-3">
          <IconButton icon="close" label={t("common.close")} onClick={leave} />
          <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-bold text-iz-head-text">
            <span className="kb:hidden">{t("rate.title")}</span>
            <span className="hidden kb:inline">{driverName}</span>
          </h1>
          <span className="h-11 w-11 shrink-0" aria-hidden />
        </div>
      }
      top={
        <div className="flex items-center gap-4">
          <DriverAvatar name={driver?.name || t("driver.unnamed")} size={68} tone="ring" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[22px] font-extrabold text-iz-head-text">{driverName}</span>
            <span className="text-[13px] font-semibold text-iz-head-muted">{`${order.fromCity.name} → ${order.toCity.name} · ${date}`}</span>
            <span className="text-[13px] font-semibold tabular-nums text-iz-head-muted">
              {[formatSom(order.price, intlTag), payLabel(order, t), order.distanceKm ? formatKm(order.distanceKm, intlTag) : ""].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
      }
      topKeep={
        rating > 0 ? (
          <div className="hidden items-center gap-2 kb:flex">
            <span className="flex h-8 items-center gap-1.5 rounded-2xl bg-iz-head-card px-3 text-[13px] font-extrabold text-iz-head-text">
              <Icon name="star" size={14} filled className="text-iz-green" />
              {rating} · {t(`rate.label.${rating}` as TranslationKey)}
            </span>
            {reasons[0] && <span className="flex h-8 min-w-0 items-center truncate rounded-2xl bg-iz-head-card px-3 text-[13px] font-bold text-iz-head-text">{t(reasons[0] as TranslationKey)}</span>}
          </div>
        ) : undefined
      }
      bodyClassName="gap-3.5 pt-6 kb:pt-[18px]"
      footer={
        <>
          {error && (
            <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
              {error}
            </p>
          )}
          {wantsRating || wantsTip || canRate || tipOpen ? (
            <PrimaryButton loading={sending} disabled={!wantsRating && !wantsTip} onClick={send}>
              {t("rate.send")}
            </PrimaryButton>
          ) : (
            <PrimaryButton icon="home" onClick={leave}>
              {t("finished.backHome")}
            </PrimaryButton>
          )}
        </>
      }
    >
      {stars}

      {canRate && rating === 5 && (
        <section className="flex flex-col gap-2.5 kb:hidden" aria-labelledby="rate-liked">
          <SectionLabel id="rate-liked">{t("history.reasonsTitle")}</SectionLabel>
          <div role="group" aria-labelledby="rate-liked" className="flex flex-wrap gap-2">
            {REASON_KEYS.map((key) => (
              <Chip key={key} selected={reasons.includes(key)} onClick={() => setReasons((r) => (r.includes(key) ? r.filter((k) => k !== key) : [...r, key]))}>
                {t(key)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {tipBlock}
      {tipsError && (
        <button type="button" onClick={loadTips} className="flex h-11 items-center gap-2 self-start text-[14px] font-bold text-iz-danger kb:hidden">
          <Icon name="refresh" size={18} />
          {t("rate.tip")} · {t("common.loadFailedRetry")}
        </button>
      )}

      {showNote && (
        <TextAreaField
          className="kb:flex-1 [&>label]:kb:flex-1"
          label={t("rate.note")}
          placeholder={t("rate.notePlaceholder")}
          maxLength={NOTE_MAX}
          counter={t("comment.count", { n: note.length, max: NOTE_MAX })}
          value={note}
          onChange={(e) => {
            setNote(e.target.value.slice(0, NOTE_MAX));
            setError(null);
          }}
        />
      )}

      {suggestion && (
        <button type="button" onClick={leave} className="flex min-h-16 shrink-0 items-center gap-3.5 rounded-iz-field border border-iz-border px-3.5 py-2 text-left active:bg-iz-field kb:hidden">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-iz-field text-iz-ink">
            <Icon name="pin" size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[12px] text-iz-muted">{t("finished.suggestionLabel")}</span>
            <span className="truncate text-[14px] font-extrabold text-iz-ink">{suggestion.label}</span>
          </span>
          {suggestion.fromPrice != null && (
            <span className="whitespace-nowrap text-[12px] font-bold tabular-nums text-iz-green-text">{t("finished.suggestionFrom", { price: formatSom(suggestion.fromPrice, intlTag) })}</span>
          )}
        </button>
      )}
    </Screen>
  );
}
