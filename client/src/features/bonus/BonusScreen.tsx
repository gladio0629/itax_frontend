import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info, Gift, UserPlus, Star, Car, ChevronRight } from "lucide-react";
import { api } from "@/api/client";
import type { BonusHistoryEntry, BonusSource, BonusSourceIcon } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Skeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { useQuery } from "@/lib/useQuery";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { formatSom, formatSomParts, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BonusDetailSheet } from "./BonusDetailSheet";

const SOURCE_ICON: Record<BonusSourceIcon, typeof Gift> = {
  order: Car,
  invite: UserPlus,
  rate: Star,
};

const HISTORY_FILTERS = ["all", "earn", "withdraw"] as const;
type HistoryFilter = (typeof HISTORY_FILTERS)[number];
const FILTER_KEY: Record<HistoryFilter, TranslationKey> = {
  all: "bonus.filter.all",
  earn: "bonus.filter.earn",
  withdraw: "bonus.filter.withdraw",
};

export function BonusScreen() {
  const { t, intlTag } = useT();
  const navigate = useNavigate();
  const [animated, setAnimated] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [detailSource, setDetailSource] = useState<BonusSource | null>(null);

  const summary = useQuery(() => api.getBonusSummary(), []);
  const sources = useQuery(() => api.getBonusSources(), []);

  const [filter, setFilter] = useState<HistoryFilter>("all");
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

  useEffect(() => {
    if (summary.status !== "success") return;
    const target = summary.data.balance;
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    function tick(now: number) {
      const p = Math.min(1, (now - start) / duration);
      setAnimated(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [summary.status, summary.status === "success" ? summary.data.balance : 0]);

  async function submitWithdraw() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    const review = await api.requestBonusWithdraw(value);
    setReviewId(review.id);
  }

  function onWithdrawApproved() {
    setReviewId(null);
    setAmountOpen(false);
    setAmount("");
    setCelebrateKey((k) => k + 1);
    summary.refetch();
    loadHistory(true);
  }

  async function runAction(source: BonusSource) {
    setDetailSource(null);
    if (source.action === "goto_order") navigate("/home");
    else if (source.action === "rate_trip") navigate("/history");
    else {
      const text = t("bonus.inviteShareText");
      if (navigator.share) {
        try {
          await navigator.share({ text });
        } catch {
          /* cancelled */
        }
      } else {
        try {
          await navigator.clipboard?.writeText(text);
        } catch {
          /* clipboard unavailable */
        }
      }
    }
  }

  const s = summary.status === "success" ? summary.data : null;

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <div className="relative overflow-hidden bg-on-yellow px-5 pb-6 text-white" style={{ paddingTop: "calc(var(--safe-top) + 64px)" }}>
        {celebrateKey > 0 && <ConfettiBurst key={celebrateKey} />}
        <p className="text-xs font-medium text-white/60">{t("bonus.balanceCaption")}</p>
        <div className="mt-1 flex items-end gap-1.5">
          {summary.status === "loading" ? (
            <Skeleton className="h-10 w-40 bg-white/10" />
          ) : (
            <>
              <span className="text-4xl font-semibold tabular">{formatSomParts(animated, intlTag).whole}</span>
              <span className="pb-1 text-sm font-medium text-white/70">.00 so'm</span>
            </>
          )}
          <button
            onClick={() => setRulesOpen(true)}
            aria-label={t("bonus.rules")}
            className="ml-1 mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/10"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          disabled={!s?.canWithdraw}
          onClick={() => setAmountOpen(true)}
          className={cn(
            "mt-5 flex w-full flex-col items-center gap-1 rounded-2xl px-4 py-3.5 transition-colors",
            s?.canWithdraw ? "bg-brand-yellow text-on-yellow" : "bg-white/10 text-white/60"
          )}
        >
          <span className="text-sm font-semibold">{t("bonus.withdraw")}</span>
          {!s?.canWithdraw && s && (
            <div className="mt-1 w-full">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.round(s.progress * 100)}%` }} />
              </div>
            </div>
          )}
        </button>
        {s && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-white/60">
            <span>
              {t("bonus.minWithdraw")}: {formatSom(s.minWithdraw, intlTag)}
            </span>
            <span>
              {t("bonus.monthlyMax")}: {formatSom(s.monthlyMax, intlTag)}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-5">
        <p className="mb-3 text-sm font-semibold text-ink">{t("bonus.sourcesTitle")}</p>
        {sources.status === "loading" && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        )}
        {sources.status === "success" && (
          <div className="space-y-2">
            {sources.data.map((src) => {
              const Icon = SOURCE_ICON[src.icon];
              return (
                <button
                  key={src.id}
                  onClick={() => setDetailSource(src)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left shadow-softer"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-10 text-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{t(src.titleKey as TranslationKey)}</p>
                    <p className="text-xs text-ink/60">{formatSom(src.amountThisMonth, intlTag)} {t("bonus.thisMonth")}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink/40" />
                </button>
              );
            })}
          </div>
        )}

        <p className="mb-3 mt-6 text-sm font-semibold text-ink">{t("bonus.historyTitle")}</p>
        <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {HISTORY_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 rounded-full border-2 px-4 py-2 text-xs font-semibold transition-colors",
                filter === f ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
              )}
            >
              {t(FILTER_KEY[f])}
            </button>
          ))}
        </div>

        {historyState === "loading" && entries.length === 0 && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        )}
        {historyState === "error" && <ErrorState onRetry={() => loadHistory(true)} />}
        {historyState === "ready" && entries.length === 0 && (
          <EmptyState icon={<Gift className="h-7 w-7" />} title={t("bonus.historyEmptyTitle")} description={t("bonus.historyEmptyDesc")} />
        )}
        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-2xl bg-card px-4 py-3.5 shadow-softer animate-slide-up"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, animationFillMode: "backwards" }}
              >
                <div>
                  <p className="text-sm font-medium text-ink">{t(`bonus.history.${e.sourceId}` as TranslationKey)}</p>
                  <p className="text-xs text-ink/60">{formatRelativeDay(e.createdAt)}</p>
                </div>
                <span className={cn("text-sm font-semibold tabular", e.type === "earn" ? "text-accent" : "text-ink")}>
                  {e.type === "earn" ? "+" : "-"}
                  {formatSom(e.amount, intlTag)}
                </span>
              </div>
            ))}
          </div>
        )}
        {cursor !== null && entries.length > 0 && (
          <button
            onClick={() => loadHistory(false)}
            className="mt-3 w-full rounded-xl border border-border py-3 text-xs font-semibold text-ink/70"
          >
            {t("bonus.loadMore")}
          </button>
        )}
      </div>

      <Sheet open={rulesOpen} onClose={() => setRulesOpen(false)} ariaLabel={t("bonus.rules")}>
        <div className="px-5 pb-6 pt-3">
          <h2 className="mb-2 text-sm font-semibold text-ink">{t("bonus.rules")}</h2>
          <p className="text-sm text-ink/70">{t("bonus.rulesText")}</p>
        </div>
      </Sheet>

      <Sheet open={amountOpen} onClose={() => setAmountOpen(false)} ariaLabel={t("bonus.withdraw")}>
        {reviewId ? (
          <ReviewStatus reviewId={reviewId} onApproved={onWithdrawApproved} />
        ) : (
          <div className="px-5 pb-6 pt-3">
            <h2 className="mb-4 text-sm font-semibold text-ink">{t("bonus.withdraw")}</h2>
            <Input
              label={t("bonus.amountLabel")}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="50000"
            />
            <div className="mt-5">
              <Button fullWidth variant="brand" onClick={submitWithdraw} disabled={!amount}>
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {detailSource && (
        <BonusDetailSheet source={detailSource} onClose={() => setDetailSource(null)} onAction={() => runAction(detailSource)} />
      )}
    </div>
  );
}
