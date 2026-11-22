import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { DebtLevel, HistoryRange, LedgerEntry, LedgerType, WalletSummary } from "@/api/types";
import { useT, isKey } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { useCountUp } from "@/lib/useCountUp";
import { formatAmount } from "@/lib/format";
import { relativeTime } from "@/lib/relative";
import { Banknote, ChevronDown, CreditCard, FileText, Gift, HandCoins, Plus, Receipt, Route, SlidersHorizontal } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { Skeleton, SkeletonList } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Sheet } from "@/components/Sheet";
import { SectionLabel } from "@/components/Card";
import { cn } from "@/lib/cn";

const TYPES: Array<LedgerType | "all"> = ["all", "trip", "commission", "tip", "topup", "bonus", "payout"];
const RANGES: HistoryRange[] = ["all", "today", "week", "month"];

const STATUS_STYLE: Record<DebtLevel, { pill: string; dot: string; bar: string }> = {
  ok: { pill: "text-brand", dot: "bg-brand", bar: "bg-brand" },
  near: { pill: "text-warning-icon", dot: "bg-warning-icon", bar: "bg-warning-icon" },
  blocked: { pill: "text-night-danger", dot: "bg-night-danger", bar: "bg-night-danger" },
};

/**
 * Hamyon (design v2): balance, the debt limit bar, top-up and cards on the
 * Ink top; this week, commission and the ledger ("Harakatlar") on the sheet.
 * Every figure is the server's.
 */
export default function WalletScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const wallet = useQuery(() => api.getWallet(), []);
  const w = wallet.data;
  const balance = useCountUp(w?.balance);
  const st = STATUS_STYLE[w?.debt.level ?? "ok"];
  const levelKey = w?.commission?.levelKey;

  return (
    <Screen
      title={t("wallet.title")}
      right={
        w && (
          <Link
            to="/wallet/debt"
            aria-label={t("wallet.debtStatus")}
            className={cn("press flex h-9 items-center gap-1.5 rounded-full bg-night-2 px-3 text-13 font-bold", st.pill)}
          >
            <span className={cn("h-2 w-2 rounded-full", st.dot)} aria-hidden="true" />
            {t(`wallet.status.${w.debt.level}`)}
          </Link>
        )
      }
      top={
        w ? (
          <div className="flex flex-col gap-[18px]">
            <span className="flex flex-col gap-1.5">
              <span className="label-caps text-night-muted">{t("wallet.balanceLabel")}</span>
              <span className={cn("tabular whitespace-nowrap text-[42px] font-extrabold leading-[1.1] tracking-[-0.5px]", w.balance < 0 ? "text-night-danger" : "text-white")}>
                {formatAmount(balance)} <span className="text-17 font-bold tracking-normal text-night-muted">{t("common.som")}</span>
              </span>
            </span>
            <Link to="/wallet/debt" aria-label={t("wallet.debtStatus")} className="press flex flex-col gap-2">
              <span className="relative block h-2 overflow-hidden rounded-full bg-night-line" aria-hidden="true">
                <span
                  className={cn("absolute inset-y-0 left-0 rounded-full", st.bar)}
                  style={{ width: `${Math.round((w.debt.level === "ok" ? 1 - w.debt.usedRatio : w.debt.usedRatio) * 100)}%` }}
                />
              </span>
              <span className="flex justify-between gap-3 text-xs font-semibold text-night-muted">
                {w.debt.debtAmount > 0 ? (
                  <span className="tabular font-bold text-night-danger">{t("wallet.debt", { amount: `${formatAmount(-w.debt.debtAmount)} ${t("common.som")}` })}</span>
                ) : (
                  <span className="tabular">{t("wallet.limitLine", { amount: formatAmount(w.debt.limit) })}</span>
                )}
                {w.debt.debtAmount > 0 ? (
                  <span className="tabular">{t("wallet.debtLimit", { amount: formatAmount(w.debt.limit) })}</span>
                ) : (
                  w.debt.headroom != null && <span className="tabular">{t("wallet.headroom", { amount: formatAmount(w.debt.headroom) })}</span>
                )}
              </span>
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              <Button size="md" onClick={() => navigate("/wallet/topup")} className="h-[52px] font-extrabold">
                <Plus className="h-4 w-4" />
                {t("wallet.topup")}
              </Button>
              <Link to="/wallet/cards" className="press flex h-[52px] items-center justify-center gap-2 rounded-full border border-night-line text-sm font-extrabold text-white">
                <CreditCard className="h-4 w-4 text-brand" />
                {t("wallet.cards")}
              </Link>
            </div>
            {w.cards && (
              <p className="tabular -mt-2 truncate text-center text-xs font-semibold text-night-muted">
                {w.cards.length ? `${t("wallet.cardsCount", { n: w.cards.length })}: ${w.cards.map((c) => `•••• ${c.last4}`).join(", ")}` : t("wallet.noCards")}
              </p>
            )}
          </div>
        ) : !wallet.error ? (
          <Skeleton className="h-40 w-full rounded-card bg-night-2" />
        ) : undefined
      }
    >
      {wallet.error && !w ? (
        <ErrorState error={wallet.error} onRetry={() => wallet.reload()} />
      ) : (
        <div className="flex flex-col gap-5">
          {w?.today && <TodayCard today={w.today} />}
          {(w?.week || w?.commission) && (
            <div className="grid grid-cols-2 gap-2.5">
              {w.week && (
                <div className="flex flex-col gap-1 rounded-field bg-raised p-4">
                  <span className="label-caps text-muted">{t("wallet.thisWeek")}</span>
                  <span className="tabular text-xl font-extrabold text-ink">{formatAmount(w.week.earnings)}</span>
                  {w.week.changePct != null && (
                    <span className={cn("tabular text-xs font-bold", w.week.changePct >= 0 ? "text-brand-ink" : "text-danger")}>
                      {t("wallet.vsLastWeek", { pct: `${w.week.changePct > 0 ? "+" : ""}${w.week.changePct}` })}
                    </span>
                  )}
                </div>
              )}
              {w.commission && (
                <CommissionCard linked={api.capabilities.bonus}>
                  <span className="label-caps text-muted">{t("wallet.commissionLabel")}</span>
                  <span className="tabular text-xl font-extrabold text-ink">
                    {w.commission.bonusActive && <s className="mr-1.5 text-15 font-bold text-muted">{w.commission.pct}%</s>}
                    {w.commission.bonusActive ? w.commission.bonusPct : w.commission.pct}%
                  </span>
                  {levelKey && <span className="text-xs font-semibold text-muted">{t("wallet.levelName", { level: t(`bonus.level.${levelKey}`) })}</span>}
                </CommissionCard>
              )}
            </div>
          )}
          <Ledger />
        </div>
      )}
    </Screen>
  );
}

/** "Bugungi daromad": today's earnings, trips and the average per trip (server). */
function TodayCard({ today }: { today: NonNullable<WalletSummary["today"]> }) {
  const { t } = useT();
  const earnings = useCountUp(today.earnings);
  return (
    <section aria-labelledby="today-h" className="flex items-end justify-between gap-3 rounded-field bg-raised p-4">
      <span className="flex min-w-0 flex-col gap-1">
        <span id="today-h" className="label-caps text-muted">
          {t("wallet.today")}
        </span>
        <span className="tabular whitespace-nowrap text-2xl font-extrabold text-ink">
          {formatAmount(earnings)} <span className="text-13 font-bold text-muted">{t("common.som")}</span>
        </span>
      </span>
      <dl className="flex shrink-0 gap-4 text-right">
        <span className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-muted">{t("wallet.trips")}</dt>
          <dd className="tabular text-15 font-extrabold text-ink">{today.trips}</dd>
        </span>
        <span className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-muted">{t("wallet.avg")}</dt>
          <dd className="tabular text-15 font-extrabold text-ink">{formatAmount(today.avgPerTrip)}</dd>
        </span>
      </dl>
    </section>
  );
}

/** The commission tile opens the level screen when the backend has it. */
function CommissionCard({ linked, children }: { linked: boolean; children: React.ReactNode }) {
  const cls = "flex flex-col gap-1 rounded-field bg-raised p-4";
  return linked ? (
    <Link to="/profile/level" className={cn(cls, "press")}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

const TYPE_ICON: Record<LedgerType, { icon: typeof Route; income: boolean }> = {
  trip: { icon: Route, income: true },
  commission: { icon: FileText, income: false },
  tip: { icon: HandCoins, income: true },
  topup: { icon: Plus, income: true },
  bonus: { icon: Gift, income: true },
  payout: { icon: Banknote, income: false },
  correction: { icon: Receipt, income: false },
};

/** "Harakatlar": the wallet ledger (read-only), with its type and period filters when the backend has them. */
function Ledger() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const typeParam = params.get("type") as LedgerType | null;
  const rangeParam = params.get("range") as HistoryRange | null;
  const type: LedgerType | "all" = typeParam && TYPES.includes(typeParam) ? typeParam : "all";
  const range: HistoryRange = rangeParam && RANGES.includes(rangeParam) ? rangeParam : "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const update = (next: { type?: LedgerType | "all"; range?: HistoryRange; page?: number }) => {
    const v = { type, range, page, ...next };
    const p: Record<string, string> = {};
    if (v.type !== "all") p.type = v.type;
    if (v.range !== "all") p.range = v.range;
    if (v.page > 1) p.page = String(v.page);
    setParams(p, { replace: true });
  };
  const q = useQuery(() => api.getLedger({ type, range, page }), [type, range, page]);
  const data = q.data;
  const filtered = type !== "all" || range !== "all";

  return (
    <section aria-labelledby="ledger-h" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="ledger-h" className="text-17 font-extrabold text-ink">
          {t("wallet.actions")}
        </h2>
        {api.capabilities.ledgerFilters && (
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            className={cn("press -mr-2 flex h-11 items-center gap-1.5 rounded-full px-3 text-13 font-bold", filtered ? "bg-night text-white dark:bg-white dark:text-night" : "text-muted")}
          >
            {range !== "all" ? t(`orders.range.${range}`) : type !== "all" ? t(`wallet.type.${type}`) : t("wallet.typeFilter")}
            {filtered ? <SlidersHorizontal className="h-3.5 w-3.5" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div aria-busy={q.loading}>
        {q.error && !data ? (
          <ErrorState error={q.error} onRetry={() => q.reload()} />
        ) : !data ? (
          <SkeletonList rows={3} label={t("common.loading")} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Receipt} title={filtered ? t("wallet.ledgerEmpty") : t("wallet.ledgerNone")} description={filtered ? undefined : t("wallet.ledgerNoneDesc")} />
        ) : (
          <>
            <ul className="flex flex-col">
              {data.items.map((e) => (
                <LedgerRow key={e.id} entry={e} />
              ))}
            </ul>
            {data.total != null && <p className="tabular mt-3 text-center text-13 text-muted">{t("wallet.shown", { shown: data.items.length, total: data.total })}</p>}
            {data.page < data.pageCount && (
              <Button variant="secondary" fullWidth className="mt-3" loading={q.loading} onClick={() => update({ page: page + 1 })}>
                {t("common.loadMore")}
              </Button>
            )}
          </>
        )}
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t("wallet.actions")}>
        <SectionLabel>{t("wallet.rangeFilter")}</SectionLabel>
        <div className="mb-5 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Chip key={r} selected={range === r} onClick={() => update({ range: r, page: 1 })}>
              {t(`orders.range.${r}`)}
            </Chip>
          ))}
        </div>
        <SectionLabel>{t("wallet.typeFilter")}</SectionLabel>
        <div className="mb-5 flex flex-wrap gap-2">
          {TYPES.map((ty) => (
            <Chip key={ty} selected={type === ty} onClick={() => update({ type: ty, page: 1 })}>
              {t(`wallet.type.${ty}`)}
            </Chip>
          ))}
        </div>
        <Button size="md" fullWidth variant="secondary" className="mb-1" onClick={() => setFiltersOpen(false)}>
          {t("common.done")}
        </Button>
      </Sheet>
    </section>
  );
}

function LedgerRow({ entry: e }: { entry: LedgerEntry }) {
  const { t } = useT();
  const meta = TYPE_ICON[e.type];
  const Icon = meta.icon;
  const positive = e.amount >= 0;
  const desc = isKey(e.descKey) ? t(e.descKey, e.descParams) : e.descKey;
  return (
    <li className="flex min-h-[68px] items-center gap-3.5 border-b border-line py-2.5 last:border-b-0">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-tile", meta.income ? "bg-brand-soft text-brand-ink" : "bg-raised text-ink")} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-15 font-bold text-ink">{t(`wallet.type.${e.type}`)}</span>
        <span className="truncate text-xs font-semibold text-muted">
          {desc} · {relativeTime(e.createdAt, t)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={cn("tabular text-15 font-extrabold", positive ? "text-brand-ink" : "text-ink")}>{formatAmount(e.amount, { signed: true })}</span>
        <span className="tabular text-xs font-semibold text-muted">{t("wallet.balanceAfter", { amount: formatAmount(e.balanceAfter) })}</span>
      </span>
    </li>
  );
}
