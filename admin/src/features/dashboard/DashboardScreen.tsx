import { useEffect, useState } from "react";
import { AlertTriangle, Car, LifeBuoy, Route, ShieldAlert, TrendingUp, Users, Wallet } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { SkeletonCard } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { api } from "@/api/client";
import { formatSom } from "@/lib/format";
import type { DashboardStats } from "@/api/types";

export function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      setStats(await api.getDashboardStats());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  if (error || !stats) return <ErrorState onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        <StatCard
          icon={<Car className="h-5 w-5" />}
          label="Faol haydovchilar"
          value={`${stats.driversOnline} / ${stats.driversTotal}`}
          tone="accent"
        />
        <StatCard icon={<Users className="h-5 w-5" />} label="Jami yo'lovchilar" value={String(stats.passengersTotal)} />
        <StatCard
          icon={<Route className="h-5 w-5" />}
          label="Bugungi buyurtmalar"
          value={String(stats.ordersToday)}
          hint={`${stats.completedToday} ta yakunlandi`}
        />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Bugungi daromad" value={formatSom(stats.revenueToday)} tone="accent" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Haftalik daromad" value={formatSom(stats.revenueWeek)} />
        <StatCard
          icon={<ShieldAlert className="h-5 w-5" />}
          label="Tekshirish kutilayotgan"
          value={String(stats.pendingVerifications)}
          tone="warning"
        />
        <StatCard icon={<LifeBuoy className="h-5 w-5" />} label="Ochiq murojaatlar" value={String(stats.openSupportTickets)} tone="warning" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Xavfli holatlar" value={String(stats.flaggedRiskItems)} tone="danger" />
      </div>

      <Card>
        <p className="mb-4 text-sm font-semibold text-ink">Haftalik daromad dinamikasi</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.weekPoints}>
              <CartesianGrid stroke="rgba(14,20,32,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "rgba(14,20,32,0.5)" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: "rgba(14,20,32,0.5)" }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                formatter={(v: number) => formatSom(v)}
                contentStyle={{ borderRadius: 16, border: "1px solid rgba(14,20,32,0.08)", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="revenue" stroke="#264A9F" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
