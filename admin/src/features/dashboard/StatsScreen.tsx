import { useEffect, useState } from "react";
import { Car, TrendingUp, UserCheck, UserPlus, Users, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/StatCard";
import { Card, CardTitle } from "@/components/Card";
import { SkeletonCard } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { api } from "@/api/client";
import { formatSom } from "@/lib/format";
import { Segmented } from "@/components/Tabs";
import type { MarketingStats, StatsPeriod } from "@/api/types";

const STATUS_LABEL: Record<string, string> = {
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
  in_progress: "Yo'lda",
  accepted: "Qabul qilingan",
  searching: "Qidirilmoqda",
  no_driver: "Haydovchi topilmadi",
};
// Chart palette derived from the brand: navy series, yellow highlight, muted slate for the rest.
const NAVY = "#264A9F";
const YELLOW = "#F6BF0E";
const GRID = "rgba(14,20,32,0.06)";
const AXIS = "rgba(14,20,32,0.55)";
const TOOLTIP_STYLE = { borderRadius: 8, border: "1px solid rgba(14,20,32,0.08)", boxShadow: "0 2px 12px -2px rgba(14,20,32,0.1)", fontSize: 12 };
const CURSOR = { fill: "rgba(38,74,159,0.05)", stroke: "rgba(38,74,159,0.2)" };

const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: "7d", label: "7 kun" },
  { key: "30d", label: "30 kun" },
  { key: "90d", label: "90 kun" },
];

/** The one "Umumiy statistika" screen every role with the "stats" section
 * sees — superadmin, owner and menejer already have "all statistics" per
 * the permissions matrix, and marketolog's statistics are no longer
 * money-free, so there is no reason left for two different screens. */
export function StatsScreen() {
  const [period, setPeriod] = useState<StatsPeriod>("7d");
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [error, setError] = useState(false);

  async function load(p: StatsPeriod) {
    setError(false);
    try {
      setStats(await api.getStats(p));
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink/60">Tanlangan davr bo'yicha asosiy ko'rsatkichlar</p>
        <Segmented label="Davr" items={PERIODS} value={period} onChange={setPeriod} />
      </div>

      {error ? (
        <ErrorState onRetry={() => load(period)} />
      ) : !stats ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={<Wallet className="h-5 w-5" />} label="Davr daromadi" value={formatSom(stats.totalIncome)} tone="accent" highlight />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Komissiya" value={formatSom(stats.totalCommission)} />
            <StatCard icon={<Wallet className="h-5 w-5" />} label="O'rtacha buyurtma qiymati" value={formatSom(stats.averageOrderValue)} />
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Haydovchilar hamyoni (jami)"
              value={formatSom(stats.walletTotalBalance)}
              tone={stats.walletTotalBalance < 0 ? "danger" : "neutral"}
            />
            <StatCard icon={<Users className="h-5 w-5" />} label="Jami yo'lovchilar" value={String(stats.passengersTotal)} hint={`+${stats.passengersNew} yangi`} tone="accent" />
            <StatCard icon={<Car className="h-5 w-5" />} label="Jami haydovchilar" value={String(stats.driversTotal)} hint={`+${stats.driversNew} yangi`} />
            <StatCard icon={<UserCheck className="h-5 w-5" />} label="Faol haydovchilar" value={String(stats.driversActive)} tone="success" />
            <StatCard icon={<UserPlus className="h-5 w-5" />} label="Bloklangan haydovchilar" value={String(stats.driversBlocked)} tone="danger" />
          </div>

          <Card>
            <CardTitle className="mb-4">Daromad dinamikasi</CardTitle>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.incomeOverTime}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NAVY} stopOpacity={0.16} />
                      <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: AXIS }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <Tooltip formatter={(v: number) => formatSom(v)} contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
                  <Area type="monotone" dataKey="income" name="Daromad" stroke={NAVY} strokeWidth={2} fill="url(#incomeFill)" dot={false} activeDot={{ r: 4, fill: YELLOW, stroke: NAVY, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardTitle className="mb-4">Ro'yxatdan o'tishlar dinamikasi</CardTitle>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.registrations}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="passengers" name="Yo'lovchilar" stroke={NAVY} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="drivers" name="Haydovchilar" stroke={YELLOW} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardTitle className="mb-4">Buyurtmalar holati bo'yicha</CardTitle>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.ordersByStatus.map((s) => ({ ...s, label: STATUS_LABEL[s.status] ?? s.status }))}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
                    <Bar dataKey="count" name="Buyurtmalar" radius={[4, 4, 0, 0]} maxBarSize={56}>
                      {stats.ordersByStatus.map((s) => (
                        <Cell key={s.status} fill={s.status === "completed" ? YELLOW : s.status === "no_driver" || s.status === "cancelled" ? "#9AA8C7" : NAVY} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardTitle className="mb-4">Daromad bo'yicha yo'nalishlar</CardTitle>
              <RankedList rows={stats.incomeByRoute.map((r) => ({ label: `${r.from} → ${r.to}`, value: r.income }))} />
            </Card>

            <Card>
              <CardTitle className="mb-4">Daromad bo'yicha shaharlar</CardTitle>
              <RankedList rows={stats.incomeByCity.map((c) => ({ label: c.city, value: c.income }))} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/** Top-N list with a thin share bar under each row (leader in yellow). */
function RankedList({ rows }: { rows: { label: string; value: number }[] }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-ink/50">Bu davr uchun ma'lumot yo'q.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="divide-y divide-border">
      {rows.map((r, i) => (
        <li key={i} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="flex min-w-0 items-center gap-3">
              <span className="tabular w-4 shrink-0 text-xs text-ink/40">{i + 1}</span>
              <span className="truncate text-ink">{r.label}</span>
            </span>
            <span className="tabular shrink-0 font-semibold text-ink">{formatSom(r.value)}</span>
          </div>
          <div className="ml-7 mt-2 h-1 overflow-hidden rounded-full bg-ink/[0.05]">
            <div className={i === 0 ? "h-full rounded-full bg-brand-yellow" : "h-full rounded-full bg-accent/40"} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
