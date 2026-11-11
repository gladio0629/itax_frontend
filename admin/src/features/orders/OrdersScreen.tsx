import { useEffect, useState } from "react";
import { Pencil, Plus, Route as RouteIcon, X } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Drawer } from "@/components/Drawer";
import { FormDrawer } from "@/components/FormDrawer";
import { MapView } from "@/components/MapView";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { ListToolbar } from "@/components/ListToolbar";
import { FilterSelect } from "@/components/FilterSelect";
import { api } from "@/api/client";
import { useAdapterList } from "@/hooks/useAdapterList";
import { formatDateTime, formatKm, formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { City, OrderMode, OrderQuery, OrderStatus, OrderWithNames, Passenger, PaymentMethod } from "@/api/types";

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  completed: "success",
  cancelled: "neutral",
  in_progress: "accent",
  accepted: "accent",
  searching: "pending",
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
const STATUS_OPTIONS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Barcha holatlar" },
  ...(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];

const SEATS = [
  { id: "front", label: "Old o'rindiq" },
  { id: "back-left", label: "Orqa chap" },
  { id: "back-mid", label: "Orqa o'rta" },
  { id: "back-right", label: "Orqa o'ng" },
];

const TIME_OPTIONS = Array.from({ length: 17 }, (_, i) => `${String(6 + i).padStart(2, "0")}:00`);

export function OrdersScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const query: OrderQuery = { search, status };
  const { items: orders, error, reload } = useAdapterList(api.getOrders, query);

  const [cities, setCities] = useState<City[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  useEffect(() => {
    Promise.all([api.getCities(), api.getPassengers({})]).then(([c, p]) => {
      setCities(c);
      setPassengers(p);
    });
  }, []);

  const [selected, setSelected] = useState<OrderWithNames | null>(null);
  const [editingOrder, setEditingOrder] = useState(false);
  const [editForm, setEditForm] = useState({ seatIds: [] as string[], note: "", timeFrom: "", timeTo: "" });
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    passengerId: "",
    fromCityId: "",
    toCityId: "",
    mode: "car" as OrderMode,
    seatIds: [] as string[],
    paymentMethod: "cash" as PaymentMethod,
    setTimeWindow: false,
    timeFrom: "08:00",
    timeTo: "10:00",
  });

  function openDetail(o: OrderWithNames) {
    setSelected(o);
    setEditingOrder(false);
    setCancelling(false);
    setCancelReason("");
  }

  function startEditOrder(o: OrderWithNames) {
    setEditForm({ seatIds: o.seatIds, note: o.note ?? "", timeFrom: o.timeWindow?.from ?? "", timeTo: o.timeWindow?.to ?? "" });
    setEditingOrder(true);
  }

  function openCreate() {
    setForm({
      passengerId: passengers[0]?.id ?? "",
      fromCityId: cities[0]?.id ?? "",
      toCityId: cities[1]?.id ?? "",
      mode: "car",
      seatIds: [],
      paymentMethod: "cash",
      setTimeWindow: false,
      timeFrom: "08:00",
      timeTo: "10:00",
    });
    setCreating(true);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const order = await api.createOrderForPassenger({
        passengerId: form.passengerId,
        fromCityId: form.fromCityId,
        toCityId: form.toCityId,
        mode: form.mode,
        seatIds: form.seatIds,
        paymentMethod: form.paymentMethod,
        timeWindow: form.setTimeWindow ? { from: form.timeFrom, to: form.timeTo } : undefined,
      });
      setToast("Buyurtma yaratildi");
      setCreating(false);
      reload();
      setSelected(order);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.updateOrderFields(selected.id, {
        seatIds: selected.mode === "seat" ? editForm.seatIds : undefined,
        note: editForm.note,
        timeWindow: editForm.timeFrom && editForm.timeTo ? { from: editForm.timeFrom, to: editForm.timeTo } : null,
      });
      setSelected(updated);
      setEditingOrder(false);
      setToast("Saqlandi");
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!selected || !cancelReason.trim()) return;
    setSaving(true);
    try {
      const updated = await api.cancelOrder(selected.id, cancelReason.trim());
      setSelected(updated);
      setCancelling(false);
      setToast("Buyurtma bekor qilindi");
      reload();
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<OrderWithNames>[] = [
    { key: "id", header: "Buyurtma", render: (o) => <span className="font-semibold text-ink">#{o.id.replace("ord_", "")}</span> },
    {
      key: "route",
      header: "Yo'nalish",
      width: "180px",
      render: (o) => (
        <span className="block max-w-[180px] truncate" title={`${o.fromCityName} → ${o.toCityName}`}>
          {o.fromCityName} → {o.toCityName}
        </span>
      ),
    },
    {
      key: "passenger",
      header: "Yo'lovchi",
      sortValue: (o) => o.passengerName,
      render: (o) => <span className="block max-w-[140px] truncate" title={o.passengerName}>{o.passengerName}</span>,
    },
    {
      key: "driver",
      header: "Haydovchi",
      sortValue: (o) => o.driverName ?? "",
      render: (o) => <span className="block max-w-[140px] truncate" title={o.driverName ?? undefined}>{o.driverName ?? "—"}</span>,
    },
    { key: "price", header: "Narx", align: "right", sortValue: (o) => o.price, render: (o) => <span className="tabular">{formatSom(o.price)}</span> },
    { key: "status", header: "Holat", render: (o) => <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge> },
    {
      key: "createdAt",
      header: "Sana",
      sortValue: (o) => o.createdAt,
      render: (o) => <span className="text-ink/60">{formatDateTime(o.createdAt)}</span>,
    },
  ];

  if (error) return <ErrorState onRetry={reload} />;
  if (!orders) {
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
          searchPlaceholder="Buyurtma, ism yoki shahar…"
          resultCount={orders.length}
          hasActiveFilters={hasActiveFilters}
          onClear={() => setStatus("all")}
        >
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Holat bo'yicha filtr" />
        </ListToolbar>
        <div className="flex shrink-0 items-center gap-2">
          <ExportButton
            section="orders"
            rows={orders}
            filenamePrefix="buyurtmalar"
            buildRow={(o) => ({ ID: o.id, Yolnalish: `${o.fromCityName}-${o.toCityName}`, Yolovchi: o.passengerName, Narx: o.price, Holat: o.status })}
          />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Yangi buyurtma
          </Button>
        </div>
      </div>

      <DataTable
        key={`${search}-${status}`}
        columns={columns}
        rows={orders}
        rowKey={(o) => o.id}
        emptyIcon={<RouteIcon className="h-6 w-6" />}
        emptyTitle="Buyurtma topilmadi"
        emptyDescription="Qidiruv yoki filtrlarga mos buyurtma yo'q."
        onRowClick={openDetail}
      />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `Buyurtma #${selected.id.replace("ord_", "")}` : ""}>
        {selected && !editingOrder && (
          <div className="space-y-5">
            <div className="h-56 overflow-hidden rounded-card">
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
              <div>
                <p className="text-xs text-ink/50">Vaqt oralig'i</p>
                <p className="font-semibold text-ink">{selected.timeWindow ? `${selected.timeWindow.from} – ${selected.timeWindow.to}` : "Tez orada"}</p>
              </div>
              {selected.mode === "seat" && (
                <div>
                  <p className="text-xs text-ink/50">O'rindiqlar</p>
                  <p className="font-semibold text-ink">{selected.seatIds.length}</p>
                </div>
              )}
            </div>
            {selected.cancelReason && <div className="rounded-card bg-danger/10 p-3 text-xs text-danger">Bekor qilish sababi: {selected.cancelReason}</div>}

            <div className="border-t border-border pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink/50">Izoh</p>
                <button type="button" onClick={() => startEditOrder(selected)} className="flex items-center gap-1 text-xs font-semibold text-accent">
                  <Pencil className="h-3 w-3" /> Tahrirlash
                </button>
              </div>
              <p className="text-sm text-ink/70">{selected.note || "Izoh yo'q"}</p>
            </div>

            {selected.canCancel && (
              <div className="border-t border-border pt-4">
                {cancelling ? (
                  <div className="space-y-2">
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Bekor qilish sababi…"
                      rows={2}
                      className="w-full rounded-button border border-border bg-card p-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" loading={saving} disabled={!cancelReason.trim()} onClick={handleCancel}>
                        Bekor qilish
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCancelling(false)}>
                        Yopish
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => setCancelling(true)}>
                    <X className="h-4 w-4" /> Buyurtmani bekor qilish
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {selected && editingOrder && (
          <div className="space-y-4">
            {selected.mode === "seat" && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink/80">O'rindiqlar</label>
                <div className="grid grid-cols-2 gap-2">
                  {SEATS.map((s) => (
                    <button
            type="button"
            aria-pressed={editForm.seatIds.includes(s.id)}
                      key={s.id}
                      onClick={() =>
                        setEditForm((f) => ({
                          ...f,
                          seatIds: f.seatIds.includes(s.id) ? f.seatIds.filter((x) => x !== s.id) : [...f.seatIds, s.id],
                        }))
                      }
                      className={cn(
                        "rounded-button border-2 py-2 text-xs font-semibold",
                        editForm.seatIds.includes(s.id) ? "border-brand-yellow bg-brand-yellow/15 text-on-yellow" : "border-border text-ink/70 hover:bg-ink/[0.03]"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label htmlFor="fld-vaqt-oralig-i" className="mb-2 block text-sm font-semibold text-ink/80">Vaqt oralig'i</label>
              <div className="flex items-center gap-3">
                <select id="fld-vaqt-oralig-i"
                  value={editForm.timeFrom}
                  onChange={(e) => setEditForm((f) => ({ ...f, timeFrom: e.target.value }))}
                  className="h-10 flex-1 rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                >
                  <option value="">—</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <span className="text-sm text-ink/60">dan</span>
                <select
                  value={editForm.timeTo}
                  onChange={(e) => setEditForm((f) => ({ ...f, timeTo: e.target.value }))}
                  className="h-10 flex-1 rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                >
                  <option value="">—</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="fld-izoh" className="mb-2 block text-sm font-semibold text-ink/80">Izoh</label>
              <textarea id="fld-izoh"
                value={editForm.note}
                onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                rows={3}
                className="w-full rounded-button border border-border bg-card p-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setEditingOrder(false)}>
                Bekor qilish
              </Button>
              <Button fullWidth loading={saving} onClick={handleSaveEdit}>
                Saqlash
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      <FormDrawer
        open={creating}
        onClose={() => setCreating(false)}
        title="Yangi buyurtma"
        onSubmit={handleCreate}
        submitLabel="Buyurtma yaratish"
        loading={saving}
        disabled={!form.passengerId || form.fromCityId === form.toCityId || (form.mode === "seat" && form.seatIds.length === 0)}
      >
        <div>
          <label htmlFor="fld-yo-lovchi" className="mb-2 block text-sm font-semibold text-ink/80">Yo'lovchi<span className="ml-1 text-danger" aria-hidden>
            *
          </span></label>
          <select id="fld-yo-lovchi"
            value={form.passengerId}
            onChange={(e) => setForm((f) => ({ ...f, passengerId: e.target.value }))}
            className="h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          >
            {passengers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fld-qayerdan" className="mb-2 block text-sm font-semibold text-ink/80">Qayerdan<span className="ml-1 text-danger" aria-hidden>
            *
          </span></label>
            <select id="fld-qayerdan"
              value={form.fromCityId}
              onChange={(e) => setForm((f) => ({ ...f, fromCityId: e.target.value }))}
              className="h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fld-qayerga" className="mb-2 block text-sm font-semibold text-ink/80">Qayerga<span className="ml-1 text-danger" aria-hidden>
            *
          </span></label>
            <select id="fld-qayerga"
              value={form.toCityId}
              onChange={(e) => setForm((f) => ({ ...f, toCityId: e.target.value }))}
              className="h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={form.mode === "car"}
            onClick={() => setForm((f) => ({ ...f, mode: "car", seatIds: [] }))}
            className={cn("rounded-button border-2 py-3 text-sm font-semibold", form.mode === "car" ? "border-brand-yellow bg-brand-yellow/15 text-on-yellow" : "border-border text-ink/70 hover:bg-ink/[0.03]")}
          >
            Butun mashina
          </button>
          <button
            type="button"
            aria-pressed={form.mode === "seat"}
            onClick={() => setForm((f) => ({ ...f, mode: "seat" }))}
            className={cn("rounded-button border-2 py-3 text-sm font-semibold", form.mode === "seat" ? "border-brand-yellow bg-brand-yellow/15 text-on-yellow" : "border-border text-ink/70 hover:bg-ink/[0.03]")}
          >
            Bir joy
          </button>
        </div>
        {form.mode === "seat" && (
          <div className="grid grid-cols-2 gap-2">
            {SEATS.map((s) => (
              <button
            type="button"
            aria-pressed={form.seatIds.includes(s.id)}
                key={s.id}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    seatIds: f.seatIds.includes(s.id) ? f.seatIds.filter((x) => x !== s.id) : [...f.seatIds, s.id],
                  }))
                }
                className={cn(
                  "rounded-button border-2 py-2 text-xs font-semibold",
                  form.seatIds.includes(s.id) ? "border-brand-yellow bg-brand-yellow/15 text-on-yellow" : "border-border text-ink/70 hover:bg-ink/[0.03]"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={form.paymentMethod === "cash"}
            onClick={() => setForm((f) => ({ ...f, paymentMethod: "cash" }))}
            className={cn("rounded-button border-2 py-3 text-sm font-semibold", form.paymentMethod === "cash" ? "border-brand-yellow bg-brand-yellow/15 text-on-yellow" : "border-border text-ink/70 hover:bg-ink/[0.03]")}
          >
            Naqd
          </button>
          <button
            type="button"
            aria-pressed={form.paymentMethod === "card"}
            onClick={() => setForm((f) => ({ ...f, paymentMethod: "card" }))}
            className={cn("rounded-button border-2 py-3 text-sm font-semibold", form.paymentMethod === "card" ? "border-brand-yellow bg-brand-yellow/15 text-on-yellow" : "border-border text-ink/70 hover:bg-ink/[0.03]")}
          >
            Karta
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={form.setTimeWindow} onChange={(e) => setForm((f) => ({ ...f, setTimeWindow: e.target.checked }))} className="h-4 w-4 rounded border-border accent-accent" />
          Vaqt oralig'ini belgilash
        </label>
        {form.setTimeWindow && (
          <div className="flex items-center gap-3">
            <select
              value={form.timeFrom}
              onChange={(e) => setForm((f) => ({ ...f, timeFrom: e.target.value }))}
              className="h-10 flex-1 rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <span className="text-sm text-ink/60">dan</span>
            <select
              value={form.timeTo}
              onChange={(e) => setForm((f) => ({ ...f, timeTo: e.target.value }))}
              className="h-10 flex-1 rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </FormDrawer>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
