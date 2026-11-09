import { useEffect, useState } from "react";
import { Car, Eye } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Drawer } from "@/components/Drawer";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/api/client";
import { formatDate, formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Driver } from "@/api/types";

const STATUS_TONE: Record<Driver["documentsStatus"], "accent" | "warning" | "danger"> = {
  approved: "accent",
  pending: "warning",
  rejected: "danger",
};
const STATUS_LABEL: Record<Driver["documentsStatus"], string> = {
  approved: "Tasdiqlangan",
  pending: "Kutilmoqda",
  rejected: "Rad etilgan",
};

export function DriversScreen() {
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  async function load() {
    setError(false);
    try {
      setDrivers(await api.getDrivers());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handleReveal(driverId: string) {
    setRevealing(true);
    try {
      const res = await api.revealPhone("driver", driverId);
      setPhone(res.phone);
    } finally {
      setRevealing(false);
    }
  }

  function openDetail(d: Driver) {
    setSelected(d);
    setPhone(null);
  }

  const columns: Column<Driver>[] = [
    {
      key: "name",
      header: "Haydovchi",
      sortValue: (d) => d.name,
      render: (d) => (
        <div className="flex items-center gap-2.5">
          <Avatar seed={d.avatarSeed} name={d.name} />
          <div>
            <p className="font-medium text-ink">{d.name}</p>
            <p className="text-xs text-ink/50">{d.phoneMasked}</p>
          </div>
        </div>
      ),
    },
    {
      key: "car",
      header: "Avtomobil",
      render: (d) => (
        <span>
          {d.carModel} · {d.plate}
        </span>
      ),
    },
    { key: "rating", header: "Reyting", sortValue: (d) => d.rating, render: (d) => <span className="tabular">{d.rating.toFixed(1)}</span> },
    { key: "trips", header: "Safarlar", sortValue: (d) => d.totalTrips, render: (d) => <span className="tabular">{d.totalTrips}</span> },
    {
      key: "wallet",
      header: "Hamyon",
      sortValue: (d) => d.walletBalance,
      render: (d) => <span className={cn("tabular", d.walletBalance < 0 && "text-danger")}>{formatSom(d.walletBalance)}</span>,
    },
    {
      key: "online",
      header: "Holat",
      render: (d) => <Badge tone={d.online ? "accent" : "neutral"}>{d.online ? "Onlayn" : "Oflayn"}</Badge>,
    },
    {
      key: "status",
      header: "Hujjatlar",
      render: (d) => <Badge tone={STATUS_TONE[d.documentsStatus]}>{STATUS_LABEL[d.documentsStatus]}</Badge>,
    },
  ];

  if (error) return <ErrorState onRetry={load} />;
  if (!drivers) {
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
        rows={drivers}
        rowKey={(d) => d.id}
        searchFields={(d) => `${d.name} ${d.plate} ${d.carModel}`}
        searchPlaceholder="Ism, davlat raqami yoki model..."
        emptyIcon={<Car className="h-6 w-6" />}
        emptyTitle="Haydovchi topilmadi"
        onRowClick={openDetail}
      />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""}>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar seed={selected.avatarSeed} name={selected.name} size={48} />
              <div>
                <p className="font-semibold text-ink">{selected.name}</p>
                <p className="text-xs text-ink/50">
                  {selected.carModel} · {selected.plate}
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-ink/5 p-4">
              <p className="mb-1 text-xs font-semibold text-ink/50">Telefon raqami</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink tabular">{phone ?? selected.phoneMasked}</span>
                {!phone && (
                  <Button size="sm" variant="secondary" loading={revealing} onClick={() => handleReveal(selected.id)}>
                    <Eye className="h-3.5 w-3.5" /> Ko'rsatish
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink/50">Reyting</p>
                <p className="font-semibold text-ink">{selected.rating.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Jami safarlar</p>
                <p className="font-semibold text-ink">{selected.totalTrips}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Hamyon balansi</p>
                <p className="font-semibold text-ink">{formatSom(selected.walletBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Qo'shilgan sana</p>
                <p className="font-semibold text-ink">{formatDate(selected.joinedAt)}</p>
              </div>
            </div>
            <Badge tone={STATUS_TONE[selected.documentsStatus]}>{STATUS_LABEL[selected.documentsStatus]}</Badge>
          </div>
        )}
      </Drawer>
    </>
  );
}
