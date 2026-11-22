import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { BonusHistoryEntry, BonusSource, BonusSourceIcon } from "@/api/types";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { Toast } from "@/components/Toast";
import { serverErrorKey } from "@/lib/apiError";
import { useQuery } from "@/lib/useQuery";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { formatLongDate, formatNumber, formatSom, SOM_LABEL } from "@/lib/format";
import { rich } from "@/lib/i18n/rich";
import { cn } from "@/lib/cn";
import { BottomSheet, Field, Icon, IconButton, PrimaryButton, Screen, SectionLabel, StateEmpty, StateError, StateLoading, TextButton, type IconName } from "@/ui";

const SOURCE_ICON: Record<BonusSourceIcon, IconName> = { order: "car", invite: "userPlus", rate: "star", goal: "gift" };

const HISTORY_FILTERS = ["all", "earn", "withdraw"] as const;
type HistoryFilter = (typeof HISTORY_FILTERS)[number];
const FILTER_KEY: Record<HistoryFilter, TranslationKey> = { all: "bonus.filter.all", earn: "bonus.filter.earn", withdraw: "bonus.filter.withdraw" };

const ACTION_KEY: Record<BonusSource["action"], TranslationKey> = {
  goto_order: "bonus.action.gotoOrder",
  invite: "bonus.action.invite",
  rate_trip: "bonus.action.rateTrip",
};

/** One way to earn (design: Bonus, "Bonus olish yo'llari"). */
function SourceCard({ src, onOpen, onDo }: { src: BonusSource; onOpen: () => void; onDo: () => void }) {
  const { t, intlTag } = useT();
  const reward = src.reward != null ? <span className="font-extrabold text-iz-green-text">+{formatNumber(src.reward, intlTag)}</span> : null;
  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-[22px] bg-iz-field p-3.5">
      <div className="flex items-center gap-3.5">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3.5 text-left active:opacity-70">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-sheet text-iz-ink">
            <Icon name={SOURCE_ICON[src.icon]} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-extrabold text-iz-ink">{t(src.titleKey as TranslationKey)}</span>
            <span className="text-[13px] text-iz-muted">
              {reward
                ? rich(t(src.progress ? "bonus.rewardOnce" : "bonus.rewardEach"), { amount: reward })
                : t("bonus.thisMonthAmount", { amount: formatSom(src.amountThisMonth, intlTag) })}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onDo}
          disabled={!!src.progress && src.progress.done >= src.progress.total}
          className="flex h-11 shrink-0 items-center rounded-full bg-iz-selected px-4 text-[13px] font-extrabold text-iz-on-selected active:opacity-80 disabled:opacity-40"
        >
          {t("bonus.do")}
        </button>
      </div>
      {src.progress && (
        <div className="flex items-center gap-2.5">
          <span
            className="flex flex-1 gap-1"
            role="progressbar"
            aria-label={t(src.titleKey as TranslationKey)}
            aria-valuemin={0}
            aria-valuemax={src.progress.total}
            aria-valuenow={src.progress.done}
          >
            {Array.from({ length: src.progress.total }, (_, i) => (
              <span key={i} className={cn("h-2 flex-1 rounded", i < src.progress!.done ? "bg-iz-ink" : "bg-iz-chip-border")} />
            ))}
          </span>
          <span className="text-[13px] font-extrabold tabular-nums text-iz-ink">
            {src.progress.done} / {src.progress.total}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Bonuslar (design v2: Bonus): the balance, "Bonusni yechib olish" (amount,
 * then the review), the ways to earn with their rewards and progress, and the
 * history with its filter. Every amount and limit is the server's.
 */
export function BonusScreen() {
  const { t, intlTag } = useT();
  const navigate = useNavigate();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [detail, setDetail] = useState<BonusSource | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const summary = useQuery(() => api.getBonusSummary(), []);
  const sources = useQuery(() => api.getBonusSources(), []);

  const [params, setParams] = useSearchParams();
  const filter: HistoryFilter = (HISTORY_FILTERS as readonly string[]).includes(params.get("filter") ?? "") ? (params.get("filter") as HistoryFilter) : "all";
  const setFilter = (f: HistoryFilter) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (f === "all") next.delete("filter");
        else next.set("filter", f);
        return next;
      },
      { replace: true }
    );
  const [entries, setEntries] = useState<BonusHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [historyState, setHistoryState] = useState<"loading" | "error" | "ready">("loading");

  function loadHistory(reset: boolean) {
    setHistoryState("loading");
    api
      .getBonusHistory({ type: filter === "all" ? undefined : filter, cursor: reset ? 0 : cursor ?? 0 })
      .then((page) => {
        setEntries((prev) => (reset ? page.entries : [...prev, ...page.entries]));
        setCursor(page.nextCursor);
        setHistoryState("ready");
      })
      .catch(() => setHistoryState("error"));
  }
  useEffect(() => {
    loadHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function submitWithdraw() {
    const value = Number(amount);
    if (!value) return;
    setSending(true);
    setWithdrawError(null);
    try {
      const review = await api.requestBonusWithdraw(value);
      setReviewId(review.id);
    } catch (e) {
      setWithdrawError(t((serverErrorKey(e) ?? "common.errorMessage") as TranslationKey));
    } finally {
      setSending(false);
    }
  }

  function closeWithdraw() {
    setAmountOpen(false);
    setReviewId(null);
    setAmount("");
    setWithdrawError(null);
  }

  function onWithdrawApproved() {
    closeWithdraw();
    setCelebrateKey((k) => k + 1);
    summary.refetch();
    loadHistory(true);
  }

  async function runAction(source: BonusSource) {
    setDetail(null);
    if (source.action === "goto_order") navigate("/home");
    else if (source.action === "rate_trip") navigate("/history");
    else {
      const text = t("bonus.inviteShareText");
      try {
        if (navigator.share) await navigator.share({ text });
        else {
          await navigator.clipboard?.writeText(text);
          setToast(t("safety.linkCopied"));
        }
      } catch {
        /* closed or unavailable */
      }
    }
  }

  const s = summary.status === "success" ? summary.data : null;

  return (
    <Screen
      title={t("drawer.bonuslar")}
      headerRight={<IconButton icon="info" label={t("bonus.rules")} onClick={() => setRulesOpen(true)} />}
      top={
        <div className="relative flex flex-col gap-[18px]">
          {celebrateKey > 0 && <ConfettiBurst key={celebrateKey} />}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-head-muted">{t("bonus.total")}</span>
            {summary.status === "error" ? (
              <button type="button" onClick={summary.refetch} className="flex h-[54px] items-center gap-2 self-start text-[15px] font-bold text-iz-head-text">
                <Icon name="refresh" size={18} />
                {t("common.loadFailedRetry")}
              </button>
            ) : (
              <span className="text-[48px] font-extrabold leading-[54px] tabular-nums text-iz-head-text" aria-live="polite">
                {s ? formatNumber(s.balance, intlTag) : "—"}
              </span>
            )}
            {s && (
              <span className="text-[12px] font-semibold text-iz-head-muted">
                {t("bonus.limits", { min: formatSom(s.minWithdraw, intlTag), max: formatSom(s.monthlyMax, intlTag) })}
              </span>
            )}
          </div>
          {s && !s.canWithdraw && (
            <div className="h-1.5 overflow-hidden rounded-full bg-iz-head-card" role="progressbar" aria-label={t("bonus.minWithdraw")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progress * 100)}>
              <div className="h-full rounded-full bg-iz-green" style={{ width: `${Math.round(s.progress * 100)}%` }} />
            </div>
          )}
          <PrimaryButton disabled={!s?.canWithdraw} onClick={() => setAmountOpen(true)}>
            {t("bonus.withdraw")}
          </PrimaryButton>
        </div>
      }
      bodyClassName="gap-3 pt-6"
    >
      <SectionLabel as="h2">{t("bonus.sourcesTitle")}</SectionLabel>
      {sources.status === "loading" && <StateLoading rows={2} />}
      {sources.status === "error" && <StateError onRetry={sources.refetch} />}
      {sources.status === "success" && sources.data.map((src) => <SourceCard key={src.id} src={src} onOpen={() => setDetail(src)} onDo={() => runAction(src)} />)}

      <SectionLabel as="h2" className="mt-2">
        {t("bonus.historyShort")}
      </SectionLabel>
      <div role="radiogroup" aria-label={t("bonus.historyTitle")} className="flex shrink-0 gap-2">
        {HISTORY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "h-11 shrink-0 rounded-full px-4 text-[13px]",
              filter === f ? "bg-iz-selected font-bold text-iz-on-selected" : "border border-iz-chip-border font-semibold text-iz-ink"
            )}
          >
            {t(FILTER_KEY[f])}
          </button>
        ))}
      </div>
      {historyState === "loading" && entries.length === 0 && <StateLoading rows={3} />}
      {historyState === "error" && <StateError onRetry={() => loadHistory(entries.length === 0)} />}
      {historyState === "ready" && entries.length === 0 && <StateEmpty title={t("bonus.historyEmptyTitle")} description={t("bonus.historyEmptyDesc")} />}
      {entries.length > 0 && (
        <div className="flex shrink-0 flex-col">
          {entries.map((e, i) => {
            const earn = e.type === "earn";
            return (
              <div key={e.id} className={cn("flex h-[60px] items-center gap-3.5", i < entries.length - 1 && "border-b border-iz-border")}>
                <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", earn ? "bg-iz-green-soft text-iz-green-text" : "bg-iz-field text-iz-ink")}>
                  <Icon name={earn ? "plus" : "arrowDown"} size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold text-iz-ink">{t(`bonus.history.${e.sourceId}` as TranslationKey)}</span>
                  <span className="text-[12px] text-iz-muted">{formatLongDate(new Date(e.createdAt), intlTag)}</span>
                </span>
                <span className={cn("whitespace-nowrap text-[16px] font-extrabold tabular-nums", earn ? "text-iz-green-text" : "text-iz-ink")}>
                  {earn ? "+" : "−"}
                  {formatNumber(e.amount, intlTag)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {cursor !== null && entries.length > 0 && historyState !== "error" && (
        <TextButton tone="ink" loading={historyState === "loading"} onClick={() => loadHistory(false)}>
          {t("bonus.loadMore")}
        </TextButton>
      )}

      <BottomSheet open={rulesOpen} onClose={() => setRulesOpen(false)} title={t("bonus.rules")} closeLabel={t("common.close")}>
        <p className="pb-2 text-[15px] leading-[22px] text-iz-ink">{t("bonus.rulesText")}</p>
      </BottomSheet>

      <BottomSheet
        open={amountOpen}
        onClose={closeWithdraw}
        title={t("bonus.withdraw")}
        closeLabel={t("common.close")}
        footer={
          reviewId ? undefined : (
            <PrimaryButton loading={sending} disabled={!amount} onClick={submitWithdraw}>
              {t("common.confirm")}
            </PrimaryButton>
          )
        }
      >
        {reviewId ? (
          <ReviewStatus reviewId={reviewId} onApproved={onWithdrawApproved} onRejected={() => setReviewId(null)} />
        ) : (
          <Field
            label={t("bonus.amountLabel")}
            icon="cash"
            name="amount"
            autoComplete="off"
            inputMode="numeric"
            value={amount ? formatNumber(Number(amount), intlTag) : ""}
            onChange={(e) => {
              setAmount(e.target.value.replace(/\D/g, "").slice(0, 9));
              setWithdrawError(null);
            }}
            trailing={<span className="shrink-0 text-[14px] font-bold text-iz-muted">{SOM_LABEL}</span>}
            hint={s ? t("bonus.limits", { min: formatSom(s.minWithdraw, intlTag), max: formatSom(s.monthlyMax, intlTag) }) : undefined}
            error={withdrawError ?? undefined}
          />
        )}
      </BottomSheet>

      {detail && (
        <BottomSheet
          open
          onClose={() => setDetail(null)}
          title={t(detail.titleKey as TranslationKey)}
          closeLabel={t("common.close")}
          footer={<PrimaryButton onClick={() => runAction(detail)}>{t(ACTION_KEY[detail.action])}</PrimaryButton>}
        >
          <p className="text-[15px] leading-[22px] text-iz-ink">{t(detail.descriptionKey as TranslationKey)}</p>
          <p className="text-[13px] font-semibold text-iz-muted">{t("bonus.thisMonthAmount", { amount: formatSom(detail.amountThisMonth, intlTag) })}</p>
        </BottomSheet>
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </Screen>
  );
}
