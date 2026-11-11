import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { HistoryRange, LedgerEntry, LedgerType } from "@/api/types";
import { useT, isKey } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { useCountUp } from "@/lib/useCountUp";
import { formatAmount } from "@/lib/format";
import { relativeTime } from "@/lib/relative";
import { ArrowDownLeft, ArrowUpRight, Car, ChevronRight, CreditCard, Gift, Percent, Plus, Receipt, Wallet } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, SectionLabel } from "@/components/Card";
import { Skeleton, SkeletonList } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Money } from "@/components/Money";
import { ProgressBar } from "@/components/ProgressBar";
import { TILE } from "@/components/SettingsRow";
import { DebtBanner } from "./DebtBanner";
import { cn } from "@/lib/cn";

const TYPES: Array<LedgerType | "all"> = ["all", "trip", "commission", "topup", "bonus"];
const RANGES: HistoryRange[] = ["all", "today", "week", "month"];

export default function WalletScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const wallet = useQuery(() => api.getWallet(), []);
  const w = wallet.data;
  const balance = useCountUp(w?.balance);

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("wallet.title")} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {wallet.error && !w ? (
          <ErrorState error={wallet.error} onRetry={() => wallet.reload()} />
        ) : !w ? (
          <div className="space-y-4" role="status" aria-label={t("common.loading")}>
            <Skeleton className="h-52 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-16 rounded-card" />
          </div>
        ) : (
          <div className="space-y-4">
            <DebtBanner level={w.debt.level} />

            {/* Hero — always a navy card, in both themes, so yellow text stays AA. */}
            <section
              aria-label={t("wallet.balance")}
              className="relative overflow-hidden rounded-card p-5 text-white shadow-2"
              style={{ background: "linear-gradient(140deg, #24448f 0%, #15275a 55%, #0d1a40 100%)" }}
            >
              <p className="relative text-sm text-[#C3CCE4]">{t("wallet.balance")}</p>
              <p className={cn("tabular relative mt-1 text-4xl font-bold", w.balance < 0 ? "text-[#FF9B7A]" : "text-[#F6BF0E]")}>
                {formatAmount(balance)}
                <span className="ml-1.5 text-base font-medium text-[#C3CCE4]">{t("common.som")}</span>
              </p>

              {w.debt.debtAmount > 0 && (
                <div className="relative mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="tabular font-bold text-[#FF9B7A]">{t("wallet.debt", { amount: `${formatAmount(-w.debt.debtAmount)} ${t("common.som")}` })}</span>
                    <span className="tabular text-[#C3CCE4]">{t("wallet.debtLimit", { amount: formatAmount(w.debt.limit) })}</span>
                  </div>
                  <ProgressBar value={w.debt.usedRatio} tone={w.debt.level === "ok" ? "warning" : "danger"} label={t("wallet.debtProgress")} className="bg-white/15" />
                </div>
              )}

              <Button size="lg" fullWidth className="relative mt-5" onClick={() => navigate("/wallet/topup")}>
                <Plus className="h-5 w-5" />
                {t("wallet.topup")}
              </Button>
            </section>

            <Card className="p-4">
              <p className="text-sm text-muted">{t("wallet.today")}</p>
              <Money value={w.today.earnings} className="mt-1 block text-3xl font-bold text-gold" />
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
                <div>
                  <dt className="text-sm text-muted">{t("wallet.trips")}</dt>
                  <dd className="tabular text-lg font-bold text-ink">{w.today.trips}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">{t("wallet.avg")}</dt>
                  <dd className="text-lg font-bold text-ink">
                    <Money value={w.today.avgPerTrip} />
                  </dd>
                </div>
              </dl>
            </Card>

            <Link to="/profile/bonus" className="press flex items-center gap-3 rounded-card bg-surface p-4 shadow-1" aria-label={`${t("wallet.commission", { pct: w.commission.pct })}. ${t("wallet.openBonus")}`}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-button", TILE.yellow)}>
                <Percent className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-ink">
                  {w.commission.bonusActive ? (
                    <>
                      <s className="mr-1.5 font-medium text-muted">{w.commission.pct}%</s>
                      {t("wallet.commission", { pct: w.commission.bonusPct })}
                    </>
                  ) : (
                    t("wallet.commission", { pct: w.commission.pct })
                  )}
                </p>
                <p className="text-sm text-gold">{w.commission.bonusActive ? t("wallet.commissionActive", { pct: w.commission.bonusPct }) : t("wallet.commissionBonus")}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </Link>

            <Link to="/wallet/cards" className="press flex items-center gap-3 rounded-card bg-surface p-4 shadow-1">
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-button", TILE.blue)}>
                <CreditCard className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-ink">{t("wallet.cards")}</p>
                <p className="tabular text-sm text-muted">
                  {w.cards.length ? `${t("wallet.cardsCount", { n: w.cards.length })}: ${w.cards.map((c) => `•••• ${c.last4}`).join(", ")}` : t("wallet.noCards")}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </Link>

            <Ledger />
          </div>
        )}
      </div>
    </div>
  );
}

const TYPE_ICON: Record<LedgerType, { icon: typeof Car; tile: keyof typeof TILE }> = {
  trip: { icon: Car, tile: "green" },
  commission: { icon: Receipt, tile: "slate" },
  topup: { icon: Wallet, tile: "blue" },
  bonus: { icon: Gift, tile: "yellow" },
};

function Ledger() {
  const { t } = useT();
  const [type, setType] = useState<LedgerType | "all">("all");
  const [range, setRange] = useState<HistoryRange>("all");
  const [page, setPage] = useState(1);
  const q = useQuery(() => api.getLedger({ type, range, page }), [type, range, page]);
  const data = q.data;

  return (
    <section aria-labelledby="ledger-h" className="pt-2">
      <SectionLabel id="ledger-h" className="text-base font-bold text-ink">
        {t("wallet.ledger")}
      </SectionLabel>
      <p className="mb-3 px-1 text-sm text-muted">{t("wallet.ledgerHint")}</p>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t("wallet.typeFilter")}>
        {TYPES.map((ty) => (
          <Chip key={ty} selected={type === ty} onClick={() => { setType(ty); setPage(1); }}>
            {t(`wallet.type.${ty}`)}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t("wallet.rangeFilter")}>
        {RANGES.map((r) => (
          <Chip key={r} selected={range === r} onClick={() => { setRange(r); setPage(1); }} className="h-12 bg-transparent ring-1 ring-inset ring-line aria-pressed:bg-yellow aria-pressed:ring-0">
            {t(`orders.range.${r}`)}
          </Chip>
        ))}
      </div>

      <div className="mt-3" aria-busy={q.loading}>
        {q.error && !data ? (
          <ErrorState error={q.error} onRetry={() => q.reload()} />
        ) : !data ? (
          <SkeletonList rows={4} label={t("common.loading")} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Receipt} title={t("wallet.ledgerEmpty")} />
        ) : (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-1">
              {data.items.map((e) => (
                <LedgerRow key={e.id} entry={e} />
              ))}
            </ul>
            <p className="tabular mt-3 text-center text-sm text-muted">{t("wallet.shown", { shown: data.items.length, total: data.total })}</p>
            {data.page < data.pageCount && (
              <Button variant="secondary" fullWidth className="mt-3" loading={q.loading} onClick={() => setPage((p) => p + 1)}>
                {t("common.loadMore")}
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function LedgerRow({ entry: e }: { entry: LedgerEntry }) {
  const { t } = useT();
  const meta = TYPE_ICON[e.type];
  const Icon = meta.icon;
  const positive = e.amount >= 0;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-button", TILE[meta.tile])}>
        <Icon className="h-5 w-5" />
        <span className={cn("absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-surface", positive ? "bg-success text-bg" : "bg-danger text-white")}>
          {positive ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base text-ink">{isKey(e.descKey) ? t(e.descKey, e.descParams) : e.descKey}</p>
        <p className="tabular truncate text-sm text-muted">{relativeTime(e.createdAt, t)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("tabular text-base font-bold", positive ? "text-success" : "text-danger")}>{formatAmount(e.amount, { signed: true })}</p>
        <p className="tabular text-xs text-muted">{t("wallet.balanceAfter", { amount: formatAmount(e.balanceAfter) })}</p>
      </div>
    </li>
  );
}
