import { useEffect, useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Drawer } from "@/components/Drawer";
import { MapView } from "@/components/MapView";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/api/client";
import { formatDateTime, formatKm, formatSom } from "@/lib/format";
import type { OrderStatus, OrderWithNames } from "@/api/types";

const STATUS_TONE: Record<OrderStatus, "accent" | "warning" | "danger" | "neutral" | "info"> = {
  completed: "accent",
  cancelled: "danger",
  in_progress: "warning",
  accepted: "info",
  searching: "info",
  no_driver: "danger",
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
  in_progress: "Yo'lda",
  accepted: "Qabul qilingan",
  searching: "Qidirilmoqda",
  no_driver: "Haydovchi topilmadi",
};

export function OrdersScreen() {
  const [orders, setOrders] = useState<OrderWithNames[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<OrderWithNames | null>(null);

  async function load() {
    setError(false);
    try {
      setOrders(await api.getOrders());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const columns: Column<OrderWithNames>[] = [
    { key: "id", header: "Buyurtma", render: (o) => <span className="font-medium text-ink">#{o.id.replace("ord_", "")}</span> },
    {
      key: "route",
      header: "Yo'nalish",
      width: "180px",
      render: (o) => (
        <span className="block max-w-[180px] truncate">
          {o.fromCityName} → {o.toCityName}
        </span>
      ),
    },
    {
      key: "passenger",
      header: "Yo'lovchi",
      sortValue: (o) => o.passengerName,
      render: (o) => <span className="block max-w-[140px] truncate">{o.passengerName}</span>,
    },
    {
      key: "driver",
      header: "Haydovchi",
      sortValue: (o) => o.driverName ?? "",
      render: (o) => <span className="block max-w-[140px] truncate">{o.driverName ?? "—"}</span>,
    },
    { key: "price", header: "Narx", sortValue: (o) => o.price, render: (o) => <span className="tabular">{formatSom(o.price)}</span> },
    { key: "status", header: "Holat", render: (o) => <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge> },
    {
      key: "createdAt",
      header: "Sana",
      sortValue: (o) => o.createdAt,
      render: (o) => <span className="text-xs text-ink/60">{formatDateTime(o.createdAt)}</span>,
    },
  ];

  if (error) return <ErrorState onRetry={load} />;
  if (!orders) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={orders}
        rowKey={(o) => o.id}
        searchFields={(o) => `${o.id} ${o.passengerName} ${o.driverName ?? ""} ${o.fromCityName} ${o.toCityName}`}
        searchPlaceholder="Buyurtma, ism yoki shahar..."
        emptyIcon={<RouteIcon className="h-6 w-6" />}
        emptyTitle="Buyurtma topilmadi"
        onRowClick={setSelected}
      />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `Buyurtma #${selected.id.replace("ord_", "")}` : ""}>
        {selected && (
          <div className="space-y-5">
            <div className="h-56 overflow-hidden rounded-2xl">
              <MapView />
            </div>
            <div className="flex items-center justify-between">
              <Badge tone={STATUS_TONE[selected.status]}>{STATUS_LABEL[selected.status]}</Badge>
              <span className="text-xs text-ink/50">{formatDateTime(selected.createdAt)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink/50">Yo'nalish</p>
                <p className="font-semibold text-ink">
                  {selected.fromCityName} → {selected.toCityName}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Masofa</p>
                <p className="font-semibold text-ink">{formatKm(selected.distanceKm)}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Yo'lovchi</p>
                <p className="font-semibold text-ink">{selected.passengerName}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Haydovchi</p>
                <p className="font-semibold text-ink">{selected.driverName ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Narx</p>
                <p className="font-semibold text-ink">{formatSom(selected.price)}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">To'lov</p>
                <p className="font-semibold text-ink">{selected.paymentMethod === "cash" ? "Naqd" : "Karta"}</p>
              </div>
            </div>
            {selected.cancelReason && (
              <div className="rounded-2xl bg-danger/10 p-3 text-xs text-danger">Bekor qilish sababi: {selected.cancelReason}</div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
