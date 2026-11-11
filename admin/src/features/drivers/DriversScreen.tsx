import { useState } from "react";
import { Ban, Car, CheckCircle2, Eye, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Drawer } from "@/components/Drawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { ListToolbar } from "@/components/ListToolbar";
import { FilterSelect } from "@/components/FilterSelect";
import { api } from "@/api/client";
import { useAdapterList } from "@/hooks/useAdapterList";
import { formatDate, formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ArchivableStatusFilter, Driver, DriverQuery, DriverStatus } from "@/api/types";

const STATUS_TONE: Record<DriverStatus, BadgeTone> = {
  active: "success",
  auto_review: "pending",
  blocked: "danger",
};
const STATUS_LABEL: Record<DriverStatus, string> = {
  active: "Faol",
  auto_review: "Avtomatik tekshiruvda",
  blocked: "Bloklangan",
};
const STATUS_OPTIONS: { value: ArchivableStatusFilter<DriverStatus>; label: string }[] = [
  { value: "all", label: "Barchasi" },
  { value: "active", label: STATUS_LABEL.active },
  { value: "auto_review", label: STATUS_LABEL.auto_review },
  { value: "blocked", label: STATUS_LABEL.blocked },
  { value: "archived", label: "Arxivlangan" },
];

type Confirm = { type: "block" | "unblock" | "archive" | "restore"; driver: Driver };

export function DriversScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ArchivableStatusFilter<DriverStatus>>("all");
  const query: DriverQuery = { search, status };
  const { items: drivers, error, reload } = useAdapterList(api.getDrivers, query);

  const [selected, setSelected] = useState<Driver | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", carModel: "", carColor: "", plate: "" });
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function openDetail(d: Driver) {
    setSelected(d);
    setPhone(null);
    setEditing(false);
  }
  function startEdit(d: Driver) {
    setForm({ name: d.name, carModel: d.carModel, carColor: d.carColor, plate: d.plate });
    setEditing(true);
  }

  async function handleReveal(driverId: string) {
    setRevealing(true);
    try {
      const res = await api.revealPhone("driver", driverId);
      setPhone(res.phone);
    } finally {
      setRevealing(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.updateDriverProfile(selected.id, form);
      setSelected(updated);
      setEditing(false);
      setToast("Profil saqlandi");
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setActing(true);
    try {
      const { type, driver } = confirm;
      let updated: Driver;
      if (type === "block") updated = await api.setDriverStatus(driver.id, "blocked");
      else if (type === "unblock") updated = await api.setDriverStatus(driver.id, "active");
      else if (type === "archive") updated = await api.archiveDriver(driver.id);
      else updated = await api.restoreDriver(driver.id);
      setSelected((prev) => (prev?.id === updated.id ? updated : prev));
      setToast(type === "block" ? "Bloklandi" : type === "unblock" ? "Blokdan chiqarildi" : type === "archive" ? "Arxivlandi" : "Tiklandi");
      setConfirm(null);
      reload();
    } finally {
      setActing(false);
    }
  }

  const columns: Column<Driver>[] = [
    {
      key: "name",
      header: "Haydovchi",
      sortValue: (d) => d.name,
      width: "220px",
      render: (d) => (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar seed={d.avatarSeed} name={d.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{d.name}</p>
            <p className="truncate text-xs text-ink/50">{d.phoneMasked}</p>
          </div>
        </div>
      ),
    },
    {
      key: "car",
      header: "Avtomobil",
      render: (d) => (
        <span className="block max-w-[180px] truncate" title={`${d.carModel} · ${d.plate}`}>
          {d.carModel} · {d.plate}
        </span>
      ),
    },
    { key: "rating", header: "Reyting", align: "right", sortValue: (d) => d.rating, render: (d) => <span className="tabular">{d.rating.toFixed(1)}</span> },
    { key: "trips", header: "Safarlar", align: "right", sortValue: (d) => d.totalTrips, render: (d) => <span className="tabular">{d.totalTrips}</span> },
    {
      key: "wallet",
      header: "Hamyon",
      align: "right",
      sortValue: (d) => d.walletBalance,
      render: (d) => <span className={cn("tabular", d.walletBalance < d.debtLimit && "text-danger")}>{formatSom(d.walletBalance)}</span>,
    },
    {
      key: "online",
      header: "Onlayn",
      render: (d) => <Badge tone={d.online ? "accent" : "neutral"}>{d.online ? "Onlayn" : "Oflayn"}</Badge>,
    },
    {
      key: "status",
      header: "Holat",
      render: (d) => <Badge tone={d.archived ? "neutral" : STATUS_TONE[d.status]}>{d.archived ? "Arxivlangan" : STATUS_LABEL[d.status]}</Badge>,
    },
  ];

  if (error) return <ErrorState onRetry={reload} />;
  if (!drivers) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const hasActiveFilters = status !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Ism, davlat raqami yoki model..."
          resultCount={drivers.length}
          hasActiveFilters={hasActiveFilters}
          onClear={() => setStatus("all")}
        >
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Holat bo'yicha filtr" />
        </ListToolbar>
        <ExportButton
          section="drivers"
          rows={drivers}
          filenamePrefix="haydovchilar"
          buildRow={(d) => ({ Ism: d.name, Avtomobil: `${d.carModel} ${d.plate}`, Reyting: d.rating, Safarlar: d.totalTrips, Holat: d.status })}
        />
      </div>

      <DataTable
        key={`${search}-${status}`}
        columns={columns}
        rows={drivers}
        rowKey={(d) => d.id}
        emptyIcon={<Car className="h-6 w-6" />}
        emptyTitle="Haydovchi topilmadi"
        emptyDescription="Qidiruv yoki filtrlarga mos haydovchi yo'q."
        onRowClick={openDetail}
      />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""}>
        {selected && !editing && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar seed={selected.avatarSeed} name={selected.name} size={48} />
                <div>
                  <p className="font-semibold text-ink">{selected.name}</p>
                  <p className="text-xs text-ink/50">
                    {selected.carModel} · {selected.plate}
                  </p>
                </div>
              </div>
              {!selected.archived && (
                <button aria-label="Tahrirlash" onClick={() => startEdit(selected)} className="rounded-full p-2 text-ink/50 hover:bg-ink/5 hover:text-ink">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="rounded-card bg-ink/5 p-4">
              <p className="mb-1 text-xs font-semibold text-ink/50">Telefon raqami</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink tabular">{phone ?? selected.phoneMasked}</span>
                {!phone && (
                  <Button size="sm" variant="secondary" loading={revealing} onClick={() => handleReveal(selected.id)}>
                    <Eye className="h-4 w-4" /> Ko'rsatish
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
                <p className={cn("font-semibold", selected.walletBalance < selected.debtLimit ? "text-danger" : "text-ink")}>{formatSom(selected.walletBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Qarz limiti</p>
                <p className="font-semibold text-ink">{formatSom(selected.debtLimit)}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Qo'shilgan sana</p>
                <p className="font-semibold text-ink">{formatDate(selected.joinedAt)}</p>
              </div>
            </div>
            <Badge tone={selected.archived ? "neutral" : STATUS_TONE[selected.status]}>
              {selected.archived ? "Arxivlangan" : STATUS_LABEL[selected.status]}
            </Badge>

            <div className="flex gap-2 border-t border-border pt-4">
              {selected.archived ? (
                <Button variant="secondary" size="sm" onClick={() => setConfirm({ type: "restore", driver: selected })}>
                  <RotateCcw className="h-4 w-4" /> Tiklash
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirm({ type: selected.status === "blocked" ? "unblock" : "block", driver: selected })}
                  >
                    {selected.status === "blocked" ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                    {selected.status === "blocked" ? "Blokdan chiqarish" : "Bloklash"}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirm({ type: "archive", driver: selected })}>
                    <Trash2 className="h-4 w-4" /> Arxivlash
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        {selected && editing && (
          <div className="space-y-4">
            <Input label="Ism" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Avtomobil modeli" value={form.carModel} onChange={(e) => setForm((f) => ({ ...f, carModel: e.target.value }))} />
            <Input label="Rangi" value={form.carColor} onChange={(e) => setForm((f) => ({ ...f, carColor: e.target.value }))} />
            <Input label="Davlat raqami" value={form.plate} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))} />
            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setEditing(false)}>
                Bekor qilish
              </Button>
              <Button fullWidth loading={saving} onClick={handleSave}>
                Saqlash
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.type === "block" ? "Haydovchini bloklash" : confirm?.type === "unblock" ? "Blokdan chiqarish" : confirm?.type === "archive" ? "Arxivlash" : "Tiklash"
        }
        description={`${confirm?.driver.name ?? ""} uchun amalni tasdiqlaysizmi?`}
        tone={confirm?.type === "block" || confirm?.type === "archive" ? "danger" : "accent"}
        loading={acting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
