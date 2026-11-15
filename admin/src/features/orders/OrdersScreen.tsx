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
import type {
  City,
  OrderCancelReasonCode,
  OrderFieldsPatch,
  OrderMode,
  OrderQuery,
  OrderStatus,
  OrderWithNames,
  Passenger,
  PaymentMethod,
} from "@/api/types";

const caps = api.capabilities;

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  completed: "success",
  cancelled: "neutral",
  in_progress: "accent",
  accepted: "accent",
  arrived: "accent",
  searching: "pending",
  no_driver: "danger",
  expired: "danger",
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
  in_progress: "Yo'lda",
  accepted: "Qabul qilingan",
  arrived: "Haydovchi yetib keldi",
  searching: "Qidirilmoqda",
  no_driver: "Haydovchi topilmadi",
  expired: "Muddati o'tgan",
};
// Only the statuses this backend can filter by.
const STATUS_OPTIONS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Barcha holatlar" },
  ...caps.orderStatuses.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];
/** Short display number: sample ids are "ord_123", real ones are UUIDs. */
const orderNo = (id: string) => (id.startsWith("ord_") ? id.slice(4) : id.slice(0, 8));
const PAYMENT_LABEL: Record<PaymentMethod, string> = { cash: "Naqd", card: "Karta", wallet: "Hamyon", payme: "Payme", click: "Click" };
const PAYMENT_METHODS = Object.keys(PAYMENT_LABEL) as PaymentMethod[];
const CANCEL_REASON_LABEL: Record<OrderCancelReasonCode, string> = {
  admin_decision: "Admin qarori",
  passenger_request: "Yo'lovchi so'rovi",
  driver_request: "Haydovchi so'rovi",
  duplicate: "Takroriy buyurtma",
  fraud: "Firibgarlik",
  other: "Boshqa sabab",
};
// Codes the server may put in Order.cancel_reason (admin and passenger reasons).
const CANCEL_CODE_LABEL: Record<string, string> = {
  ...CANCEL_REASON_LABEL,
  changed_plans: "Rejalar o'zgardi",
  long_wait: "Uzoq kutish",
  driver_asked: "Haydovchi so'radi",
  wrong_address: "Manzil noto'g'ri",
};
const editable = (f: (typeof caps.orderEditFields)[number]) => caps.orderEditFields.includes(f);
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
const pad2 = (n: number) => String(n).padStart(2, "0");
/** epoch ms ↔ <input type="datetime-local"> value (local time). */
function toLocalInput(ms: number | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
const fromLocalInput = (v: string): number | null => {
  const ms = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
};
type ScheduleMode = "none" | "at" | "range";
const INPUT_CLS =
  "h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

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
    // Only the create form needs these.
    if (!caps.orderCreate) return;
    Promise.all([api.getCities(), api.getPassengers({})])
      .then(([c, p]) => {
        setCities(c);
        setPassengers(p);
      })
      .catch(() => {});
  }, []);

  const [selected, setSelected] = useState<OrderWithNames | null>(null);
  const [editingOrder, setEditingOrder] = useState(false);
  const [editForm, setEditForm] = useState({
    seatIds: [] as string[],
    note: "",
    timeFrom: "",
    timeTo: "",
    paymentMethod: "cash" as PaymentMethod,
    scheduleMode: "none" as ScheduleMode,
    scheduleAt: "",
    scheduleFrom: "",
    scheduleTo: "",
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelCode, setCancelCode] = useState<OrderCancelReasonCode>("admin_decision");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    passengerId: "",
    fromCityId: "",
    toCityId: "",
    mode: "car" as OrderMode,
    seatIds: [] as string[],
    paymentMethod: "cash" as "cash" | "card",
    setTimeWindow: false,
    timeFrom: "08:00",
    timeTo: "10:00",
  });

  function openDetail(o: OrderWithNames) {
    setSelected(o);
    setEditingOrder(false);
    setCancelling(false);
    setCancelReason("");
    setCancelCode("admin_decision");
    setCancelError(null);
  }

  function startEditOrder(o: OrderWithNames) {
    setEditForm({
      seatIds: o.seatIds,
      note: o.note ?? "",
      timeFrom: o.timeWindow?.from ?? "",
      timeTo: o.timeWindow?.to ?? "",
      paymentMethod: o.paymentMethod,
      scheduleMode: o.scheduledAt ? "at" : o.scheduledRange ? "range" : "none",
      scheduleAt: toLocalInput(o.scheduledAt),
      scheduleFrom: toLocalInput(o.scheduledRange?.from),
      scheduleTo: toLocalInput(o.scheduledRange?.to),
    });
    setEditError(null);
    setEditingOrder(true);
  }

  /** Only the fields this backend edits, and only the ones that changed. */
  function buildPatch(o: OrderWithNames): OrderFieldsPatch | "invalid" {
    const patch: OrderFieldsPatch = {};
    if (editable("seats") && o.mode === "seat") patch.seatIds = editForm.seatIds;
    if (editable("timeWindow")) patch.timeWindow = editForm.timeFrom && editForm.timeTo ? { from: editForm.timeFrom, to: editForm.timeTo } : null;
    if (editable("note") && editForm.note !== (o.note ?? "")) patch.note = editForm.note;
    if (editable("paymentMethod") && editForm.paymentMethod !== o.paymentMethod) patch.paymentMethod = editForm.paymentMethod;
    if (editable("schedule")) {
      if (editForm.scheduleMode === "at") {
        const at = fromLocalInput(editForm.scheduleAt);
        if (at === null) return "invalid";
        if (toLocalInput(at) !== toLocalInput(o.scheduledAt)) patch.schedule = { at };
      } else if (editForm.scheduleMode === "range") {
        const from = fromLocalInput(editForm.scheduleFrom);
        const to = fromLocalInput(editForm.scheduleTo);
        if (from === null || to === null) return "invalid";
        if (toLocalInput(from) !== toLocalInput(o.scheduledRange?.from) || toLocalInput(to) !== toLocalInput(o.scheduledRange?.to)) {
          patch.schedule = { from, to };
        }
      }
    }
    return patch;
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
    const patch = buildPatch(selected);
    if (patch === "invalid") {
      setEditError("Vaqtni to'liq kiriting.");
      return;
    }
    if (Object.keys(patch).length === 0) {
      setEditingOrder(false);
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const updated = await api.updateOrderFields(selected.id, patch);
      setSelected(updated);
      setEditingOrder(false);
      setToast("Saqlandi");
      reload();
    } catch (e) {
      // e.g. 403 driver_assigned / trip_started / order_closed from the server.
      setEditError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!selected) return;
    if (!caps.orderCancelReasons && !cancelReason.trim()) return;
    setSaving(true);
    setCancelError(null);
    try {
      const updated = caps.orderCancelReasons
        ? await api.cancelOrder(selected.id, cancelCode, cancelReason.trim() || undefined)
        : await api.cancelOrder(selected.id, cancelReason.trim());
      setSelected(updated);
      setCancelling(false);
      setToast("Buyurtma bekor qilindi");
      reload();
    } catch (e) {
      setCancelError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<OrderWithNames>[] = [
    { key: "id", header: "Buyurtma", render: (o) => <span className="font-semibold text-ink">#{orderNo(o.id)}</span> },
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
    ...(caps.orderPassenger
      ? [
          {
            key: "passenger",
            header: "Yo'lovchi",
            sortValue: (o: OrderWithNames) => o.passengerName,
            render: (o: OrderWithNames) => (
              <span className="block max-w-[140px] truncate" title={o.passengerName}>
                {o.passengerName}
              </span>
            ),
          } as Column<OrderWithNames>,
        ]
      : []),
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
          searchEnabled={caps.orderSearch}
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
          {caps.orderCreate && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Yangi buyurtma
            </Button>
          )}
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

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Buyurtma #${orderNo(selected.id)}` : ""}
      >
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
              {caps.orderPassenger ? (
                <div>
                  <p className="text-xs text-ink/50">Yo'lovchi</p>
                  <p className="font-semibold text-ink">{selected.passengerName}</p>
                </div>
              ) : (
                selected.passengerId && (
                  // The API gives only the passenger's id, no name.
                  <div>
                    <p className="text-xs text-ink/50">Yo'lovchi ID</p>
                    <p className="tabular select-all font-semibold text-ink" title={selected.passengerId}>
                      #{selected.passengerId.slice(0, 8)}
                    </p>
                  </div>
                )
              )}
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
                <p className="font-semibold text-ink">{PAYMENT_LABEL[selected.paymentMethod]}</p>
              </div>
              {selected.scheduledAt ? (
                <div>
                  <p className="text-xs text-ink/50">Jo'nash vaqti</p>
                  <p className="font-semibold text-ink">{formatDateTime(selected.scheduledAt)}</p>
                </div>
              ) : selected.scheduledRange ? (
                <div>
                  <p className="text-xs text-ink/50">Jo'nash oralig'i</p>
                  <p className="font-semibold text-ink">
                    {formatDateTime(selected.scheduledRange.from)} – {formatDateTime(selected.scheduledRange.to)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-ink/50">Vaqt oralig'i</p>
                  <p className="font-semibold text-ink">{selected.timeWindow ? `${selected.timeWindow.from} – ${selected.timeWindow.to}` : "Tez orada"}</p>
                </div>
              )}
              {selected.mode === "seat" && (
                <div>
                  <p className="text-xs text-ink/50">O'rindiqlar</p>
                  <p className="font-semibold text-ink">{selected.seatIds.length}</p>
                </div>
              )}
            </div>
            {selected.cancelReason && (
              <div className="rounded-card bg-danger/10 p-3 text-xs text-danger">
                Bekor qilish sababi: {CANCEL_CODE_LABEL[selected.cancelReason] ?? selected.cancelReason}
              </div>
            )}

            <div className="border-t border-border pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink/50">Izoh</p>
                {caps.orderEdit && (
                  <button type="button" onClick={() => startEditOrder(selected)} className="flex items-center gap-1 text-xs font-semibold text-accent">
                    <Pencil className="h-3 w-3" /> Tahrirlash
                  </button>
                )}
              </div>
              <p className="text-sm text-ink/70">{selected.note || "Izoh yo'q"}</p>
            </div>

            {selected.canCancel && (
              <div className="border-t border-border pt-4">
                {cancelling ? (
                  <div className="space-y-2">
                    {caps.orderCancelReasons && (
                      <select
                        value={cancelCode}
                        onChange={(e) => setCancelCode(e.target.value as OrderCancelReasonCode)}
                        aria-label="Bekor qilish sababi"
                        className={INPUT_CLS}
                      >
                        {(Object.keys(CANCEL_REASON_LABEL) as OrderCancelReasonCode[]).map((r) => (
                          <option key={r} value={r}>
                            {CANCEL_REASON_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    )}
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder={caps.orderCancelReasons ? "Izoh (ixtiyoriy)…" : "Bekor qilish sababi…"}
                      aria-label={caps.orderCancelReasons ? "Izoh" : "Bekor qilish sababi"}
                      maxLength={caps.orderCancelReasons ? 500 : undefined}
                      rows={2}
                      className="w-full rounded-button border border-border bg-card p-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                    {cancelError && (
                      <p role="alert" className="text-xs font-semibold text-danger">
                        {cancelError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        loading={saving}
                        disabled={!caps.orderCancelReasons && !cancelReason.trim()}
                        onClick={handleCancel}
                      >
                        Bekor qilish
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCancelling(false)}>
                        Yopish
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setCancelError(null);
                      setCancelling(true);
                    }}
                  >
                    <X className="h-4 w-4" /> Buyurtmani bekor qilish
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {selected && editingOrder && (
          <div className="space-y-4">
            {editable("seats") && selected.mode === "seat" && (
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
            {editable("timeWindow") && (
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
            )}
            {editable("paymentMethod") && (
              <div>
                <label htmlFor="fld-tolov" className="mb-2 block text-sm font-semibold text-ink/80">To'lov usuli</label>
                <select
                  id="fld-tolov"
                  value={editForm.paymentMethod}
                  onChange={(e) => setEditForm((f) => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                  className={INPUT_CLS}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {editable("schedule") && (
              <div className="space-y-2">
                <label htmlFor="fld-jonash" className="block text-sm font-semibold text-ink/80">Jo'nash vaqti</label>
                <select
                  id="fld-jonash"
                  value={editForm.scheduleMode}
                  onChange={(e) => setEditForm((f) => ({ ...f, scheduleMode: e.target.value as ScheduleMode }))}
                  className={INPUT_CLS}
                >
                  {/* A set time can be changed but not removed (the API has no "clear"). */}
                  {!selected.scheduledAt && !selected.scheduledRange && <option value="none">Belgilanmagan (imkon qadar tez)</option>}
                  <option value="at">Aniq vaqt</option>
                  <option value="range">Vaqt oralig'i</option>
                </select>
                {editForm.scheduleMode === "at" && (
                  <input
                    type="datetime-local"
                    aria-label="Aniq jo'nash vaqti"
                    value={editForm.scheduleAt}
                    onChange={(e) => setEditForm((f) => ({ ...f, scheduleAt: e.target.value }))}
                    className={INPUT_CLS}
                  />
                )}
                {editForm.scheduleMode === "range" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      aria-label="Oraliq boshlanishi"
                      value={editForm.scheduleFrom}
                      onChange={(e) => setEditForm((f) => ({ ...f, scheduleFrom: e.target.value }))}
                      className={INPUT_CLS}
                    />
                    <span className="text-sm text-ink/60">–</span>
                    <input
                      type="datetime-local"
                      aria-label="Oraliq tugashi"
                      value={editForm.scheduleTo}
                      onChange={(e) => setEditForm((f) => ({ ...f, scheduleTo: e.target.value }))}
                      className={INPUT_CLS}
                    />
                  </div>
                )}
              </div>
            )}
            {editable("note") && (
              <div>
                <label htmlFor="fld-izoh" className="mb-2 block text-sm font-semibold text-ink/80">Izoh</label>
                <textarea id="fld-izoh"
                  value={editForm.note}
                  onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                  rows={3}
                  maxLength={caps.orderNoteMaxLength ?? undefined}
                  className="w-full rounded-button border border-border bg-card p-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>
            )}
            {editError && (
              <p role="alert" className="text-xs font-semibold text-danger">
                {editError}
              </p>
            )}
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
