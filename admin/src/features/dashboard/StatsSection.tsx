import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/api/client";
import { Card, CardTitle, StatTile } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { RouteText } from "@/components/Cells";
import { ORDER_STATUS } from "@/features/orders/labels";
import { formatCompactSom, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MarketingStats, StatsPeriod } from "@/api/types";

const TOOLTIP = { borderRadius: 14, border: "none", boxShadow: "var(--shadow-pop)", fontSize: 12, fontWeight: 600 };

/** The old "Umumiy statistika" figures in the v2 style (Dashboard and
 * Marketing): orders, people, money, registrations. Loads by itself so a
 * failure shows an error with "Qayta urinish" instead of vanishing, and a
 * failed period change keeps the old figures marked as stale. */
export function StatsSection({ period }: { period: StatsPeriod }) {
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const load = useCallback(() => {
    const my = ++seq.current;
    setLoading(true);
    setError(false);
    api
      .getStats(period)
      .then((s) => my === seq.current && setStats(s))
      .catch(() => my === seq.current && setError(true))
      .finally(() => my === seq.current && setLoading(false));
  }, [period]);
  useEffect(() => {
    load();
    return () => {
      seq.current++;
    };
  }, [load]);

  if (error && !stats)
    return (
      <section aria-label="Statistika" className="flex flex-col gap-4">
        <h2 className="label-caps px-1 text-muted">Statistika</h2>
        <ErrorState message="Statistikani yuklab bo'lmadi." onRetry={load} retrying={loading} />
      </section>
    );
  if (!stats)
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-card" />
        ))}
      </div>
    );
  return (
    <div className={cn("flex flex-col gap-5 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
      {error && <StaleNotice onRetry={load} text="Statistikani yangilab bo'lmadi. Ko'rinayotgan raqamlar oldingi davrga tegishli." />}
      <OrdersAndPeople stats={stats} />
      <MoneyAndStatus stats={stats} />
    </div>
  );
}

function OrdersAndPeople({ stats }: { stats: MarketingStats }) {
  const tile = (label: string, v: number | null | undefined, sub?: string) =>
    v == null ? null : <StatTile key={label} label={label} value={formatNumber(v)} unit={sub} />;
  const orders = [
    tile("Buyurtmalar, jami", stats.ordersTotal),
    tile("Yakunlangan", stats.ordersCompleted),
    tile("Bekor qilingan", stats.ordersCancelled),
    tile("Muddati o'tgan", stats.ordersExpired),
  ].filter(Boolean);
  const people = [
    tile("Yo'lovchilar, jami", stats.passengersTotal, stats.passengersNew != null ? `+${formatNumber(stats.passengersNew)} yangi` : undefined),
    tile("Haydovchilar, jami", stats.driversTotal, stats.driversNew != null ? `+${formatNumber(stats.driversNew)} yangi` : undefined),
    tile("Faol haydovchilar", stats.driversActive),
    tile("Bloklangan haydovchilar", stats.driversBlocked),
  ].filter(Boolean);
  if (!orders.length && !people.length && !stats.registrations) return null;
  return (
    <section aria-label="Buyurtmalar va foydalanuvchilar" className="flex flex-col gap-4">
      <h2 className="label-caps px-1 text-muted">Buyurtmalar va foydalanuvchilar</h2>
      {orders.length > 0 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{orders}</div>}
      {people.length > 0 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{people}</div>}
      {stats.registrations && <Registrations rows={stats.registrations} />}
    </section>
  );
}

function Registrations({ rows }: { rows: NonNullable<MarketingStats["registrations"]> }) {
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle
        right={
          <span className="flex gap-4 text-xs font-bold text-muted">
            <Legend color="var(--green)" label="Yo'lovchilar" />
            <Legend color="var(--ink)" label="Haydovchilar" />
          </span>
        }
      >
        Ro'yxatdan o'tganlar
      </CardTitle>
      <div className="h-[220px] w-full" role="img" aria-label="Kunlar bo'yicha ro'yxatdan o'tgan yo'lovchilar va haydovchilar">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -18 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "var(--muted)" }} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--surface)" }}
              contentStyle={TOOLTIP}
              formatter={(v: number, name: string) => [formatNumber(v), name === "passengers" ? "Yo'lovchilar" : "Haydovchilar"]}
            />
            <Bar dataKey="passengers" fill="var(--green)" radius={[4, 4, 4, 4]} />
            <Bar dataKey="drivers" fill="var(--ink)" radius={[4, 4, 4, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Money and order-status figures from getStats (restored from the old
 * "Umumiy statistika"). Each block shows only when the server reports it. */
function MoneyAndStatus({ stats }: { stats: MarketingStats }) {
  const tiles = [
    stats.totalIncome != null && { label: "Davr daromadi", v: formatCompactSom(stats.totalIncome) },
    stats.averageOrderValue != null && { label: "O'rtacha buyurtma", v: formatCompactSom(stats.averageOrderValue) },
    stats.walletTotalBalance != null && { label: "Haydovchilar hamyoni, jami", v: formatCompactSom(stats.walletTotalBalance) },
  ].filter(Boolean) as { label: string; v: { value: string; unit?: string } }[];
  const status = stats.ordersByStatus?.filter((s) => s.count > 0) ?? null;
  const statusMax = Math.max(1, ...(status ?? []).map((s) => s.count));
  const hasCharts = stats.incomeOverTime || status || stats.incomeByRoute || stats.incomeByCity;
  if (!tiles.length && !hasCharts) return null;

  return (
    <section aria-label="Daromad va buyurtmalar" className="flex flex-col gap-4">
      <h2 className="label-caps px-1 text-muted">Daromad va buyurtmalar</h2>
      {tiles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <StatTile key={t.label} label={t.label} value={t.v.value} unit={t.v.unit ?? "so'm"} />
          ))}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.9fr_1fr]">
        {stats.incomeOverTime && (
          <Card className="flex flex-col gap-4">
            <CardTitle>Daromad dinamikasi</CardTitle>
            <div className="h-[220px] w-full" role="img" aria-label="Davr bo'yicha daromad">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.incomeOverTime} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--green)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "var(--muted)" }} minTickGap={16} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                    tickFormatter={(v: number) => formatCompactSom(v).value + (formatCompactSom(v).unit ? " mln" : "")}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP}
                    formatter={(v: number) => [`${formatNumber(v)} so'm`, "Daromad"]}
                  />
                  <Area type="monotone" dataKey="income" stroke="var(--green-text)" strokeWidth={2.5} fill="url(#incomeFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        {status && (
          <Card className="flex flex-col gap-4">
            <CardTitle>Buyurtmalar holati bo'yicha</CardTitle>
            <ul className="flex flex-col gap-3">
              {status.map((s) => (
                <li key={s.status} className="flex flex-col gap-1.5">
                  <span className="flex items-center justify-between gap-3 text-13">
                    <Badge tone={ORDER_STATUS[s.status].tone}>{ORDER_STATUS[s.status].label}</Badge>
                    <span className="tabular font-extrabold">{formatNumber(s.count)}</span>
                  </span>
                  <span aria-hidden className="relative block h-1.5 rounded-full bg-surface">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${(s.count / statusMax) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {(stats.incomeByRoute || stats.incomeByCity) && (
        <div className="grid gap-4 xl:grid-cols-2">
          {stats.incomeByRoute && (
            <IncomeList title="Daromad bo'yicha yo'nalishlar" rows={stats.incomeByRoute.map((r) => ({ key: `${r.from}-${r.to}`, label: <RouteText from={r.from} to={r.to} />, value: r.income }))} />
          )}
          {stats.incomeByCity && <IncomeList title="Daromad bo'yicha shaharlar" rows={stats.incomeByCity.map((c) => ({ key: c.city, label: c.city, value: c.income }))} />}
        </div>
      )}
    </section>
  );
}

function IncomeList({ title, rows }: { title: string; rows: { key: string; label: ReactNode; value: number }[] }) {
  const top = rows.slice(0, 6);
  const max = Math.max(1, ...top.map((r) => r.value));
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>{title}</CardTitle>
      {top.length === 0 ? (
        <p className="text-13 font-semibold text-muted">Bu davrda daromad yo'q.</p>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {top.map((r, i) => (
            <li key={r.key} className="flex flex-col gap-1.5">
              <span className="flex justify-between gap-3 text-13 font-bold">
                {r.label}
                <span className="tabular whitespace-nowrap font-extrabold">{formatNumber(r.value)} so'm</span>
              </span>
              <span aria-hidden className="relative block h-1.5 rounded-full bg-surface">
                <span className={cn("absolute inset-y-0 left-0 rounded-full", i === 0 ? "bg-green" : "bg-ink")} style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
