import { useEffect, useState } from "react";
import { Eye, Users } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Drawer } from "@/components/Drawer";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/api/client";
import type { City, Passenger } from "@/api/types";

export function PassengersScreen() {
  const [passengers, setPassengers] = useState<Passenger[] | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Passenger | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  async function load() {
    setError(false);
    try {
      const [p, c] = await Promise.all([api.getPassengers(), api.getCities()]);
      setPassengers(p);
      setCities(c);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function cityName(id: string) {
    return cities.find((c) => c.id === id)?.name ?? id;
  }

  async function handleReveal(id: string) {
    setRevealing(true);
    try {
      const res = await api.revealPhone("passenger", id);
      setPhone(res.phone);
    } finally {
      setRevealing(false);
    }
  }

  const columns: Column<Passenger>[] = [
    {
      key: "name",
      header: "Yo'lovchi",
      sortValue: (p) => p.name,
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <Avatar seed={p.avatarSeed} name={p.name} />
          <div>
            <p className="font-medium text-ink">{p.name}</p>
            <p className="text-xs text-ink/50">{p.phoneMasked}</p>
          </div>
        </div>
      ),
    },
    { key: "city", header: "Shahar", render: (p) => cityName(p.cityId) },
    { key: "rating", header: "Reyting", sortValue: (p) => p.rating, render: (p) => <span className="tabular">{p.rating.toFixed(1)}</span> },
    { key: "trips", header: "Safarlar", sortValue: (p) => p.totalTrips, render: (p) => <span className="tabular">{p.totalTrips}</span> },
  ];

  if (error) return <ErrorState onRetry={load} />;
  if (!passengers) {
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
        rows={passengers}
        rowKey={(p) => p.id}
        searchFields={(p) => p.name}
        searchPlaceholder="Ism bo'yicha qidirish..."
        emptyIcon={<Users className="h-6 w-6" />}
        emptyTitle="Yo'lovchi topilmadi"
        onRowClick={(p) => {
          setSelected(p);
          setPhone(null);
        }}
      />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""}>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar seed={selected.avatarSeed} name={selected.name} size={48} />
              <div>
                <p className="font-semibold text-ink">{selected.name}</p>
                <p className="text-xs text-ink/50">{cityName(selected.cityId)}</p>
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
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
