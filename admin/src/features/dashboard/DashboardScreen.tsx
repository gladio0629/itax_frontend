import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, Info, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Card, CardTitle, StatTile } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { FilterSelect } from "@/components/FilterSelect";
import { ExportButton } from "@/components/ExportButton";
import { KindTag, RouteText } from "@/components/Cells";
import { NAV_GROUPS } from "@/components/Sidebar";
import { ORDER_STATUS, orderNo } from "@/features/orders/labels";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCompactSom, formatLongDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AttentionItem, Dashboard, DashboardPeriod, Kpi, MarketingStats, Section } from "@/api/types";

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "today", label: "Bugun" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
  { value: "90d", label: "90 kun" },
];
const DELTA_HINT: Record<DashboardPeriod, string> = {
  today: "kechaga",
  "7d": "oldingi 7 kunga",
  "30d": "oldingi 30 kunga",
  "90d": "oldingi 90 kunga",
};

const sectionPath = (s: Section) => NAV_GROUPS.flatMap((g) => g.items).find((i) => i.section === s)?.to ?? "/";

/** "Umumiy statistika" (design Dashboard). Every block renders only what the
 * server returned; null blocks are hidden, never filled with zeros. */
export function DashboardScreen() {
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const [data, setData] = useState<Dashboard | null>(null);
  // Money and status figures (the old "Umumiy statistika"), same period.
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(false);
    api
      .getDashboard(period)
      .then((d) => live && setData(d))
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    api
      .getStats(period)
      .then((s) => live && setStats(s))
      .catch(() => live && setStats(null));
    return () => {
      live = false;
    };
  }, [period]);
  useEffect(() => load(), [load]);

  const exportRows = data?.ordersByDay ?? [];

  return (
    <>
      <PageHeader
        subtitle={formatLongDate(new Date())}
        title="Umumiy statistika"
        actions={
          <>
            <FilterSelect label="Davr" aria-label="Davr" value={period} onChange={setPeriod} options={PERIODS} />
            <ExportButton
              section="stats"
              rows={exportRows}
              filenamePrefix="statistika"
              buildRow={(d) => ({
                Sana: new Date(d.date).toISOString().slice(0, 10),
                Buyurtmalar: d.total,
                "Yo'lovchi": d.passenger ?? "",
                Dostavka: d.delivery ?? "",
              })}
            />
          </>
        }
      />

      {error && data && <StaleNotice onRetry={load} />}
      {error && !data ? (
        <ErrorState onRetry={load} retrying={loading} />
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <div className={cn("flex flex-col gap-5 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <KpiRow data={data} />
          {(data.ordersByDay || data.topRoutes) && (
            <div className="grid gap-4 xl:grid-cols-[1.9fr_1fr]">
              {data.ordersByDay && <OrdersChart days={data.ordersByDay} />}
              {data.topRoutes && <TopRoutes routes={data.topRoutes} period={period} />}
            </div>
          )}
          {(data.recentOrders || (data.attention && data.attention.length > 0)) && (
            <div className="grid gap-4 xl:grid-cols-[1.9fr_1fr]">
              {data.recentOrders && <RecentOrders orders={data.recentOrders} />}
              {data.attention && data.attention.length > 0 && <Attention items={data.attention} />}
            </div>
          )}
          {stats && <MoneyAndStatus stats={stats} />}
        </div>
      )}
    </>
  );
}

function KpiRow({ data }: { data: Dashboard }) {
  const hint = DELTA_HINT[data.period];
  const tile = (label: string, k: Kpi | null, money?: boolean) => {
    if (!k) return null;
    const v = money ? formatCompactSom(k.value) : { value: formatNumber(k.value) };
    return (
      <StatTile
        key={label}
        label={label}
        value={v.value}
        unit={v.unit}
        spark={k.spark}
        delta={
          k.deltaPct === null
            ? null
            : { text: `${Math.abs(k.deltaPct)}%`, direction: k.deltaPct > 0 ? "up" : k.deltaPct < 0 ? "down" : "flat", hint }
        }
      />
    );
  };
  const tiles = [
    tile(data.period === "today" ? "Bugungi buyurtmalar" : "Buyurtmalar", data.orders),
    tile("Faol haydovchilar", data.activeDrivers),
    tile("Yangi yo'lovchilar", data.newPassengers),
    tile("Komissiya, so'm", data.commission, true),
  ].filter(Boolean);
  if (!tiles.length) return null;
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{tiles}</div>;
}

function OrdersChart({ days }: { days: NonNullable<Dashboard["ordersByDay"]> }) {
  const split = days.some((d) => d.passenger !== null);
  const rows = days.map((d, i) => ({
    day: new Date(d.date).getDate(),
    passenger: split ? (d.passenger ?? 0) : d.total,
    delivery: split ? (d.delivery ?? 0) : 0,
    today: i === days.length - 1,
  }));
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle
        right={
          split ? (
            <span className="flex gap-4 text-xs font-bold text-muted">
              <Legend color="var(--green)" label="Yo'lovchi" />
              <Legend color="var(--ink)" label="Dostavka" />
            </span>
          ) : undefined
        }
      >
        Buyurtmalar, so'nggi {days.length} kun
      </CardTitle>
      <div className="h-[220px] w-full" role="img" aria-label={`So'nggi ${days.length} kunda buyurtmalar${split ? ": yo'lovchi va dostavka" : ""}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -18 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "var(--muted)" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--surface)" }}
              contentStyle={{ borderRadius: 14, border: "none", boxShadow: "var(--shadow-pop)", fontSize: 12, fontWeight: 600 }}
              formatter={(v: number, name: string) => [formatNumber(v), split ? (name === "passenger" ? "Yo'lovchi" : "Dostavka") : "Buyurtmalar"]}
              labelFormatter={(l) => `${l}-kun`}
            />
            <Bar dataKey="delivery" stackId="a" radius={[4, 4, 4, 4]}>
              {rows.map((r, i) => (
                <Cell key={i} fill={r.today ? "var(--ink)" : "var(--chart-delivery)"} />
              ))}
            </Bar>
            <Bar dataKey="passenger" stackId="a" radius={[4, 4, 4, 4]}>
              {rows.map((r, i) => (
                <Cell key={i} fill={r.today ? "var(--green)" : "var(--chart-passenger)"} />
              ))}
            </Bar>
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

function TopRoutes({ routes, period }: { routes: NonNullable<Dashboard["topRoutes"]>; period: DashboardPeriod }) {
  const max = Math.max(1, ...routes.map((r) => r.count));
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle sub={`${PERIODS.find((p) => p.value === period)?.label}, buyurtmalar soni`}>Top yo'nalishlar</CardTitle>
      {routes.length === 0 ? (
        <p className="text-13 font-semibold text-muted">Bu davrda buyurtma yo'q.</p>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {routes.map((r, i) => (
            <li key={`${r.from}-${r.to}`} className="flex flex-col gap-1.5">
              <span className="flex justify-between gap-3 text-13">
                <RouteText from={r.from} to={r.to} />
                <span className="tabular font-extrabold">{formatNumber(r.count)}</span>
              </span>
              <span aria-hidden className="relative block h-1.5 rounded-full bg-surface">
                <span
                  className={cn("absolute inset-y-0 left-0 rounded-full", i === 0 ? "bg-green" : "bg-ink")}
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function RecentOrders({ orders }: { orders: NonNullable<Dashboard["recentOrders"]> }) {
  const navigate = useNavigate();
  return (
    <Card className="flex min-w-0 flex-col gap-4">
      <CardTitle
        right={
          <Link to="/orders" className="inline-flex h-11 items-center rounded-full bg-surface px-[18px] text-sm font-extrabold text-ink hover:bg-line">
            Hammasi
          </Link>
        }
      >
        So'nggi buyurtmalar
      </CardTitle>
      {orders.length === 0 ? (
        <p className="text-13 font-semibold text-muted">Hali buyurtma yo'q.</p>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-box shadow-hairline">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface">
                {["ID", "Tur", "Yo'nalish", "Haydovchi", "Narx", "Holat"].map((h) => (
                  <th key={h} scope="col" className={cn("h-11 whitespace-nowrap px-3 text-2xs font-bold uppercase tracking-[0.6px] text-muted", h === "Narx" && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  tabIndex={0}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/orders/${o.id}`)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-row-hover focus-visible:outline-offset-[-2px]"
                >
                  <td className="h-12 whitespace-nowrap px-3 font-bold">{orderNo(o.id)}</td>
                  <td className="px-3">
                    <KindTag kind={o.kind} />
                  </td>
                  <td className="whitespace-nowrap px-3">
                    <RouteText from={o.fromCityName} to={o.toCityName} />
                  </td>
                  <td className="whitespace-nowrap px-3 font-semibold">{o.driverName ?? "—"}</td>
                  <td className="tabular whitespace-nowrap px-3 text-right font-semibold">{formatNumber(o.price)}</td>
                  <td className="px-3">
                    <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const ATTENTION_STYLE: Record<AttentionItem["tone"], { box: string; icon: typeof Info }> = {
  info: { box: "bg-green-soft", icon: Info },
  warning: { box: "bg-warn-soft", icon: AlertTriangle },
  danger: { box: "bg-error-soft", icon: Wallet },
};

function Attention({ items }: { items: AttentionItem[] }) {
  const { me } = usePermissions();
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Diqqat talab qiladi</CardTitle>
      {items.map((a) => {
        const st = ATTENTION_STYLE[a.tone];
        const body = (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-nav bg-white text-ink">
              <st.icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-extrabold text-ink">{a.title}</span>
              <span className="text-xs font-semibold text-muted">{a.detail}</span>
            </span>
          </>
        );
        // Linked only when this admin may open that section.
        return me?.sections.includes(a.section) ? (
          <Link key={a.id} to={sectionPath(a.section)} className={cn("flex min-h-[60px] items-center gap-3 rounded-box p-3 text-ink hover:brightness-[0.98]", st.box)}>
            {body}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          </Link>
        ) : (
          <div key={a.id} className={cn("flex min-h-[60px] items-center gap-3 rounded-box p-3", st.box)}>
            {body}
          </div>
        );
      })}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.9fr_1fr]">
        <Skeleton className="h-[300px] rounded-card" />
        <Skeleton className="h-[300px] rounded-card" />
      </div>
    </div>
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
                    contentStyle={{ borderRadius: 14, border: "none", boxShadow: "var(--shadow-pop)", fontSize: 12, fontWeight: 600 }}
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
