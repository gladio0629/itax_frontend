import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Star } from "lucide-react";
import { api } from "@/api/client";
import type { OrderWithDetails } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { SkeletonList } from "@/components/Skeleton";
import { formatSom, formatKm, formatRelativeDay, formatTime } from "@/lib/format";

export function HistoryDetailScreen() {
  const { orderId = "" } = useParams();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);

  useEffect(() => {
    api.getOrder(orderId).then(setOrder);
  }, [orderId]);

  if (!order) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title="Buyurtma" />
        <div className="px-4 pt-4">
          <SkeletonList count={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title="Buyurtma tafsilotlari" />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <Card className="mb-4 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              {order.fromCity.name} &rarr; {order.toCity.name}
            </p>
            <Badge tone={order.status === "completed" ? "accent" : order.status === "cancelled" ? "danger" : "neutral"}>
              {order.status === "completed" ? "Yakunlandi" : order.status === "cancelled" ? "Bekor qilindi" : order.status}
            </Badge>
          </div>
          <p className="text-xs text-ink/60">
            {formatRelativeDay(order.createdAt)} &middot; {formatTime(order.createdAt)} &middot; {formatKm(order.distanceKm)}
          </p>
        </Card>

        {order.driver && (
          <Card className="mb-4 flex items-center gap-3 p-4">
            <Avatar seed={order.driver.avatarSeed} name={order.driver.name} size={44} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{order.driver.name}</p>
              <p className="text-xs text-ink/60">
                {order.driver.carModel} &middot; {order.driver.plate}
              </p>
            </div>
            {order.rating && (
              <span className="flex items-center gap-1 text-sm font-semibold text-warning">
                <Star className="h-4 w-4 fill-warning" /> {order.rating}
              </span>
            )}
          </Card>
        )}

        <Card className="space-y-3 p-5">
          <p className="text-xs font-semibold text-ink/60">TO'LOV</p>
          <Row label="Joylashuv turi" value={order.mode === "car" ? "Butun mashina" : "Bir joy"} />
          <Row label="To'lov usuli" value={order.paymentMethod === "cash" ? "Naqd pul" : "Karta"} />
          {order.cancelReason && <Row label="Bekor qilish sababi" value={order.cancelReason} />}
          <div className="h-px bg-border" />
          <Row label="Jami" value={formatSom(order.price)} bold />
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink/60">{label}</span>
      <span className={`text-sm tabular ${bold ? "font-semibold text-ink" : "text-ink/80"}`}>{value}</span>
    </div>
  );
}
