import { useEffect, useState } from "react";
import { Car, TrendingUp, UserCheck, UserPlus, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { SkeletonCard } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { api } from "@/api/client";
import { formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MarketingStats, StatsPeriod } from "@/api/types";

const STATUS_LABEL: Record<string, string> = {
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
  in_progress: "Yo'lda",
  accepted: "Qabul qilingan",
  searching: "Qidirilmoqda",
  no_driver: "Haydovchi topilmadi",
};
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
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", period === p.key ? "bg-ink text-bg" : "bg-ink/5 text-ink/70")}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState onRetry={() => load(period)} />
      ) : !stats ? (
        <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
            <StatCard icon={<Wallet className="h-5 w-5" />} label="Davr daromadi" value={formatSom(stats.totalIncome)} tone="accent" />
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
            <StatCard icon={<UserCheck className="h-5 w-5" />} label="Faol haydovchilar" value={String(stats.driversActive)} tone="accent" />
            <StatCard icon={<UserPlus className="h-5 w-5" />} label="Bloklangan haydovchilar" value={String(stats.driversBlocked)} tone="warning" />
          </div>

          <Card>
            <p className="mb-4 text-sm font-semibold text-ink">Daromad dinamikasi</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.incomeOverTime}>
                  <CartesianGrid stroke="rgba(14,20,32,0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "rgba(14,20,32,0.5)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "rgba(14,20,32,0.5)" }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <Tooltip formatter={(v: number) => formatSom(v)} contentStyle={{ borderRadius: 16, border: "1px solid rgba(14,20,32,0.08)", fontSize: 12 }} />
                  <Line type="monotone" dataKey="income" name="Daromad" stroke="#264A9F" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <p className="mb-4 text-sm font-semibold text-ink">Ro'yxatdan o'tishlar dinamikasi</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.registrations}>
                    <CartesianGrid stroke="rgba(14,20,32,0.06)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(14,20,32,0.5)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "rgba(14,20,32,0.5)" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid rgba(14,20,32,0.08)", fontSize: 12 }} />
                    <Line type="monotone" dataKey="passengers" name="Yo'lovchilar" stroke="#264A9F" strokeWidth={2.5} dot={{ r: 2.5 }} />
                    <Line type="monotone" dataKey="drivers" name="Haydovchilar" stroke="#F6BF0E" strokeWidth={2.5} dot={{ r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <p className="mb-4 text-sm font-semibold text-ink">Buyurtmalar holati bo'yicha</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.ordersByStatus.map((s) => ({ ...s, label: STATUS_LABEL[s.status] ?? s.status }))}>
                    <CartesianGrid stroke="rgba(14,20,32,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(14,20,32,0.5)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "rgba(14,20,32,0.5)" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid rgba(14,20,32,0.08)", fontSize: 12 }} />
                    <Bar dataKey="count" name="Buyurtmalar" fill="#264A9F" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <p className="mb-4 text-sm font-semibold text-ink">Daromad bo'yicha yo'nalishlar</p>
              <div className="space-y-2">
                {stats.incomeByRoute.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-ink/5 px-4 py-2.5 text-sm">
                    <span className="text-ink">
                      {r.from} → {r.to}
                    </span>
                    <span className="tabular font-semibold text-ink">{formatSom(r.income)}</span>
                  </div>
                ))}
                {stats.incomeByRoute.length === 0 && <p className="text-sm text-ink/50">Ma'lumot yo'q.</p>}
              </div>
            </Card>

            <Card>
              <p className="mb-4 text-sm font-semibold text-ink">Daromad bo'yicha shaharlar</p>
              <div className="space-y-2">
                {stats.incomeByCity.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-ink/5 px-4 py-2.5 text-sm">
                    <span className="text-ink">{c.city}</span>
                    <span className="tabular font-semibold text-ink">{formatSom(c.income)}</span>
                  </div>
                ))}
                {stats.incomeByCity.length === 0 && <p className="text-sm text-ink/50">Ma'lumot yo'q.</p>}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
