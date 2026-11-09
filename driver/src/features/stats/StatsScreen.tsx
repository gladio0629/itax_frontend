import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Star, TrendingUp } from "lucide-react";
import { api } from "@/api/client";
import type { EarningsStats } from "@/api/types";
import { Card } from "@/components/Card";
import { BottomNav } from "@/components/BottomNav";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { formatSom } from "@/lib/format";

type LoadState = "loading" | "error" | "ready";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; amount: number; trips: number } }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-soft">
      <p className="font-semibold">{p.date}</p>
      <p>{formatSom(p.amount)}</p>
      <p className="text-white/70">{p.trips} safar</p>
    </div>
  );
}

export function StatsScreen() {
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  function load() {
    setState("loading");
    api
      .getEarningsStats("week")
      .then((s) => {
        setStats(s);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, []);

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="px-5" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
        <h1 className="text-lg font-semibold text-ink">Statistika</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {state === "loading" && (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        )}

        {state === "error" && <ErrorState onRetry={load} />}

        {state === "ready" && stats && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Card className="space-y-1 p-4">
                <p className="text-xs text-ink/60">Bugungi daromad</p>
                <p className="text-lg font-semibold tabular text-ink">{formatSom(stats.totalToday)}</p>
                <p className="text-xs text-ink/60">{stats.tripsToday} safar</p>
              </Card>
              <Card className="space-y-1 p-4">
                <p className="text-xs text-ink/60">Haftalik daromad</p>
                <p className="text-lg font-semibold tabular text-ink">{formatSom(stats.totalWeek)}</p>
                <p className="text-xs text-ink/60">{stats.tripsWeek} safar</p>
              </Card>
            </div>

            <Card className="mb-4 p-5">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <TrendingUp className="h-4 w-4 text-ink/60" /> Haftalik daromad dinamikasi
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "rgb(var(--color-text-rgb) / 0.5)" }}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(30,214,151,0.08)" }} />
                    <Bar dataKey="amount" radius={[8, 8, 8, 8]} fill="#1ED697" maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="flex items-center justify-between p-5">
              <span className="flex items-center gap-2 text-sm font-medium text-ink/70">
                <Star className="h-4 w-4 fill-warning text-warning" /> O'rtacha baho
              </span>
              <span className="text-lg font-semibold tabular text-ink">{stats.avgRating.toFixed(1)}</span>
            </Card>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
