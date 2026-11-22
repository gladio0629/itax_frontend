import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Card, CardTitle, StatTile } from "@/components/Card";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { FilterSelect } from "@/components/FilterSelect";
import { ExportButton } from "@/components/ExportButton";
import { MoneyAndStatus } from "@/features/dashboard/DashboardScreen";
import { formatCompactSom, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Kpi, Marketing, MarketingPeriod, MarketingStats, StatsPeriod } from "@/api/types";

const PERIODS: { value: MarketingPeriod; label: string }[] = [
  { value: "3m", label: "3 oy" },
  { value: "6m", label: "6 oy" },
  { value: "12m", label: "12 oy" },
];
const MONEY_PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
  { value: "90d", label: "90 kun" },
];

/** Marketolog's "Umumiy statistika" (design Marketing). Read-only: every
 * figure comes from the server; nothing is computed here. */
export function MarketingScreen() {
  const [period, setPeriod] = useState<MarketingPeriod>("6m");
  const [data, setData] = useState<Marketing | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moneyPeriod, setMoneyPeriod] = useState<StatsPeriod>("30d");
  const [stats, setStats] = useState<MarketingStats | null>(null);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(false);
    api
      .getMarketing(period)
      .then((d) => live && setData(d))
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [period]);
  useEffect(() => load(), [load]);

  useEffect(() => {
    let live = true;
    api
      .getStats(moneyPeriod)
      .then((s) => live && setStats(s))
      .catch(() => live && setStats(null));
    return () => {
      live = false;
    };
  }, [moneyPeriod]);

  return (
    <>
      <PageHeader
        subtitle="Faqat ko'rish"
        title="Umumiy statistika"
        actions={
          <>
            <FilterSelect label="Davr" aria-label="Davr" value={period} onChange={setPeriod} options={PERIODS} />
            <ExportButton
              section="stats"
              rows={data?.commissionByMonth ?? []}
              filenamePrefix="marketing"
              buildRow={(m) => ({ Oy: m.month, "Komissiya, so'm": m.value })}
            />
          </>
        }
      />

      {error && data && <StaleNotice onRetry={load} />}
      {error && !data ? (
        <ErrorState onRetry={load} retrying={loading} />
      ) : !data ? (
        <div className="flex flex-col gap-4" aria-busy>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-card" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-card" />
        </div>
      ) : (
        <div className={cn("flex flex-col gap-5 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <Kpis data={data} />
          {(data.commissionByMonth || data.funnel || data.orderTypes) && (
            <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
              {data.commissionByMonth && <CommissionChart rows={data.commissionByMonth} />}
              <div className="flex flex-col gap-4">
                {data.funnel && <Funnel funnel={data.funnel} />}
                {data.orderTypes && <OrderTypes types={data.orderTypes} />}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end">
        <FilterSelect label="Daromad davri" aria-label="Daromad davri" value={moneyPeriod} onChange={setMoneyPeriod} options={MONEY_PERIODS} />
      </div>
      {stats && <MoneyAndStatus stats={stats} />}
    </>
  );
}

function Kpis({ data }: { data: Marketing }) {
  const tile = (label: string, k: Kpi | null, money?: boolean) => {
    if (!k) return null;
    const v = money ? formatCompactSom(k.value) : { value: formatNumber(k.value) };
    return (
      <StatTile
        key={label}
        label={label}
        value={v.value}
        unit={money ? (v.unit ?? "so'm") : undefined}
        spark={k.spark}
        delta={
          k.deltaPct === null
            ? null
            : { text: `${Math.abs(k.deltaPct)}%`, direction: k.deltaPct > 0 ? "up" : k.deltaPct < 0 ? "down" : "flat", hint: "o'tgan oyga" }
        }
      />
    );
  };
  const tiles = [
    tile("Oylik buyurtmalar", data.monthlyOrders),
    tile("Faol yo'lovchilar", data.activePassengers),
    tile("Faol haydovchilar", data.activeDrivers),
    tile("O'rtacha chek", data.averageCheck, true),
  ].filter(Boolean);
  if (!tiles.length) return null;
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{tiles}</div>;
}

function CommissionChart({ rows }: { rows: NonNullable<Marketing["commissionByMonth"]> }) {
  const data = rows.map((r, i) => ({ ...r, last: i === rows.length - 1 }));
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle sub="so'm, oylar bo'yicha">Komissiya, {rows.length} oy</CardTitle>
      <div className="h-[260px] w-full" role="img" aria-label={`So'nggi ${rows.length} oyda komissiya`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "var(--muted)" }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickFormatter={(v: number) => formatCompactSom(v).value + (formatCompactSom(v).unit ? " mln" : "")}
            />
            <Tooltip
              cursor={{ fill: "var(--surface)" }}
              contentStyle={{ borderRadius: 14, border: "none", boxShadow: "var(--shadow-pop)", fontSize: 12, fontWeight: 600 }}
              formatter={(v: number) => [`${formatNumber(v)} so'm`, "Komissiya"]}
            />
            <Bar dataKey="value" radius={[6, 6, 6, 6]}>
              {data.map((r, i) => (
                <Cell key={i} fill={r.last ? "var(--green)" : "var(--chart-delivery)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Funnel({ funnel }: { funnel: NonNullable<Marketing["funnel"]> }) {
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle sub={funnel.title}>Voronka</CardTitle>
      <ol className="flex flex-col gap-3">
        {funnel.steps.map((s, i) => (
          <li key={s.label} className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between gap-3 text-13 font-bold">
              {s.label}
              <span className="tabular whitespace-nowrap font-extrabold">
                {formatNumber(s.count)} <span className="font-semibold text-muted">· {s.pct}%</span>
              </span>
            </span>
            <span aria-hidden className="relative block h-2 rounded-full bg-surface">
              <span
                className={cn("absolute inset-y-0 left-0 rounded-full", i === funnel.steps.length - 1 ? "bg-green" : "bg-ink")}
                style={{ width: `${Math.max(2, Math.min(100, s.pct))}%` }}
              />
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function OrderTypes({ types }: { types: NonNullable<Marketing["orderTypes"]> }) {
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Buyurtma turlari</CardTitle>
      <span aria-hidden className="flex h-3 overflow-hidden rounded-full bg-surface">
        <span className="bg-green" style={{ width: `${types.passengerPct}%` }} />
        <span className="bg-ink" style={{ width: `${types.deliveryPct}%` }} />
      </span>
      <dl className="grid grid-cols-2 gap-3">
        <TypeFact color="bg-green" label="Yo'lovchi" pct={types.passengerPct} />
        <TypeFact color="bg-ink" label="Dostavka" pct={types.deliveryPct} />
      </dl>
    </Card>
  );
}

function TypeFact({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex items-center gap-2 text-13 font-bold text-muted">
        <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", color)} />
        {label}
      </dt>
      <dd className="tabular text-[22px] font-extrabold">{pct}%</dd>
    </div>
  );
}
