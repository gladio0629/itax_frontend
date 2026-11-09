import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History as HistoryIcon, Star } from "lucide-react";
import { api } from "@/api/client";
import type { OrderWithDetails } from "@/api/types";
import { BottomNav } from "@/components/BottomNav";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { formatRelativeDay, formatSom } from "@/lib/format";

const STATUS_TONE: Record<string, { tone: "accent" | "danger" | "neutral" | "warning"; label: string }> = {
  completed: { tone: "accent", label: "Yakunlandi" },
  cancelled: { tone: "danger", label: "Bekor qilindi" },
  no_driver: { tone: "warning", label: "Topilmadi" },
  in_progress: { tone: "warning", label: "Yo'lda" },
  accepted: { tone: "warning", label: "Haydovchi topildi" },
  searching: { tone: "neutral", label: "Qidirilmoqda" },
};

type LoadState = "loading" | "error" | "ready";

export function HistoryScreen() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  function load() {
    setState("loading");
    api
      .getOrderHistory()
      .then((res) => {
        setOrders(res);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, []);

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="px-5" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
        <h1 className="text-lg font-semibold text-ink">Buyurtmalar tarixi</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {state === "loading" && <SkeletonList count={5} />}
        {state === "error" && <ErrorState onRetry={load} />}
        {state === "ready" && orders.length === 0 && (
          <EmptyState
            icon={<HistoryIcon className="h-7 w-7" />}
            title="Hali safarlar yo'q"
            description="Birinchi buyurtmangizni bering — u yerda tarix shu yerda saqlanadi."
            actionLabel="Buyurtma berish"
            onAction={() => navigate("/home")}
          />
        )}
        {state === "ready" && orders.length > 0 && (
          <div className="space-y-2">
            {orders.map((o) => {
              const status = STATUS_TONE[o.status] ?? STATUS_TONE.searching;
              return (
                <button
                  key={o.id}
                  onClick={() => navigate(`/history/${o.id}`)}
                  className="flex w-full flex-col gap-2 rounded-3xl bg-card p-4 text-left shadow-softer"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">
                      {o.fromCity.name} &rarr; {o.toCity.name}
                    </p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink/60">
                    <span>{formatRelativeDay(o.createdAt)}</span>
                    <span className="flex items-center gap-2">
                      {o.rating && (
                        <span className="flex items-center gap-0.5 font-medium text-warning">
                          <Star className="h-3 w-3 fill-warning" /> {o.rating}
                        </span>
                      )}
                      <span className="font-semibold tabular text-ink/80">{formatSom(o.price)}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
