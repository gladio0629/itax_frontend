import { useEffect, useState } from "react";
import { FormDrawer } from "@/components/FormDrawer";
import { Input, SelectField, TextArea } from "@/components/Input";
import { Segmented } from "@/components/Tabs";
import { cn } from "@/lib/cn";
import { api } from "@/api/client";
import { PAYMENT_LABEL } from "./labels";
import type { City, OrderFieldsPatch, OrderMode, OrderWithNames, Passenger, PaymentMethod } from "@/api/types";

const caps = api.capabilities;
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

export const SEATS = [
  { id: "front", label: "Old o'rindiq" },
  { id: "back-left", label: "Orqa chap" },
  { id: "back-mid", label: "Orqa o'rta" },
  { id: "back-right", label: "Orqa o'ng" },
];
const TIME_OPTIONS = Array.from({ length: 17 }, (_, i) => `${pad2(6 + i)}:00`);
const PAYMENT_METHODS = Object.keys(PAYMENT_LABEL) as PaymentMethod[];

type ScheduleMode = "none" | "at" | "range";

/** Seat picker (multi-select chips). */
function SeatPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label-caps mb-2 px-1 text-muted">O'rindiqlar</legend>
      <div className="grid grid-cols-2 gap-2">
        {SEATS.map((s) => {
          const on = value.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}
              className={cn(
                "h-11 rounded-full text-13 font-bold transition-colors",
                on ? "bg-ink text-white" : "bg-surface text-ink hover:bg-line"
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Edit an order: only the fields this backend accepts
 * (`capabilities.orderEditFields`), and only the ones that changed. */
export function OrderEditDrawer({
  order,
  open,
  onClose,
  onSaved,
}: {
  order: OrderWithNames;
  open: boolean;
  onClose: () => void;
  onSaved: (o: OrderWithNames) => void;
}) {
  const [f, setF] = useState(() => initial(order));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setF(initial(order));
      setError(null);
    }
  }, [open, order]);

  function buildPatch(): OrderFieldsPatch | "invalid" {
    const patch: OrderFieldsPatch = {};
    if (editable("seats") && order.mode === "seat") patch.seatIds = f.seatIds;
    if (editable("timeWindow")) patch.timeWindow = f.timeFrom && f.timeTo ? { from: f.timeFrom, to: f.timeTo } : null;
    if (editable("note") && f.note !== (order.note ?? "")) patch.note = f.note;
    if (editable("paymentMethod") && f.paymentMethod !== order.paymentMethod) patch.paymentMethod = f.paymentMethod;
    if (editable("schedule")) {
      if (f.scheduleMode === "at") {
        const at = fromLocalInput(f.scheduleAt);
        if (at === null) return "invalid";
        if (toLocalInput(at) !== toLocalInput(order.scheduledAt)) patch.schedule = { at };
      } else if (f.scheduleMode === "range") {
        const from = fromLocalInput(f.scheduleFrom);
        const to = fromLocalInput(f.scheduleTo);
        if (from === null || to === null) return "invalid";
        if (toLocalInput(from) !== toLocalInput(order.scheduledRange?.from) || toLocalInput(to) !== toLocalInput(order.scheduledRange?.to)) {
          patch.schedule = { from, to };
        }
      }
    }
    return patch;
  }

  async function save() {
    const patch = buildPatch();
    if (patch === "invalid") {
      setError("Vaqtni to'liq kiriting.");
      return;
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.updateOrderFields(order.id, patch));
    } catch (e) {
      // e.g. 403 driver_assigned / trip_started / order_closed from the server.
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDrawer open={open} onClose={onClose} title="Buyurtmani tahrirlash" onSubmit={save} loading={saving} error={error}>
      {editable("seats") && order.mode === "seat" && <SeatPicker value={f.seatIds} onChange={(seatIds) => setF((x) => ({ ...x, seatIds }))} />}
      {editable("timeWindow") && (
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Oraliq boshi"
            value={f.timeFrom}
            onChange={(e) => setF((x) => ({ ...x, timeFrom: e.target.value }))}
            options={[{ value: "", label: "Belgilanmagan" }, ...TIME_OPTIONS.map((t) => ({ value: t, label: t }))]}
          />
          <SelectField
            label="Oraliq oxiri"
            value={f.timeTo}
            onChange={(e) => setF((x) => ({ ...x, timeTo: e.target.value }))}
            options={[{ value: "", label: "Belgilanmagan" }, ...TIME_OPTIONS.map((t) => ({ value: t, label: t }))]}
          />
        </div>
      )}
      {editable("paymentMethod") && (
        <SelectField
          label="To'lov usuli"
          value={f.paymentMethod}
          onChange={(e) => setF((x) => ({ ...x, paymentMethod: e.target.value as PaymentMethod }))}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_LABEL[m] }))}
        />
      )}
      {editable("schedule") && (
        <div className="flex flex-col gap-2">
          <span className="label-caps px-1 text-muted">Jo'nash vaqti</span>
          <Segmented
            label="Jo'nash vaqti turi"
            value={f.scheduleMode}
            onChange={(scheduleMode) => setF((x) => ({ ...x, scheduleMode }))}
            items={[
              ...(order.scheduledAt || order.scheduledRange ? [] : [{ key: "none" as const, label: "Hozir" }]),
              { key: "at" as const, label: "Aniq vaqt" },
              { key: "range" as const, label: "Oraliq" },
            ]}
          />
          {f.scheduleMode === "at" && (
            <Input label="Aniq vaqt" type="datetime-local" value={f.scheduleAt} onChange={(e) => setF((x) => ({ ...x, scheduleAt: e.target.value }))} />
          )}
          {f.scheduleMode === "range" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input label="Dan" type="datetime-local" value={f.scheduleFrom} onChange={(e) => setF((x) => ({ ...x, scheduleFrom: e.target.value }))} />
              <Input label="Gacha" type="datetime-local" value={f.scheduleTo} onChange={(e) => setF((x) => ({ ...x, scheduleTo: e.target.value }))} />
            </div>
          )}
          {(order.scheduledAt || order.scheduledRange) && (
            <p className="px-1 text-xs font-medium text-muted">Belgilangan vaqtni o'zgartirish mumkin, lekin olib tashlab bo'lmaydi.</p>
          )}
        </div>
      )}
      {editable("note") && (
        <TextArea
          label="Izoh"
          value={f.note}
          maxLength={caps.orderNoteMaxLength ?? undefined}
          onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))}
          hint={caps.orderNoteMaxLength ? `${f.note.length}/${caps.orderNoteMaxLength}` : undefined}
        />
      )}
    </FormDrawer>
  );
}

function initial(o: OrderWithNames) {
  return {
    seatIds: o.seatIds,
    note: o.note ?? "",
    timeFrom: o.timeWindow?.from ?? "",
    timeTo: o.timeWindow?.to ?? "",
    paymentMethod: o.paymentMethod,
    scheduleMode: (o.scheduledAt ? "at" : o.scheduledRange ? "range" : "none") as ScheduleMode,
    scheduleAt: toLocalInput(o.scheduledAt),
    scheduleFrom: toLocalInput(o.scheduledRange?.from),
    scheduleTo: toLocalInput(o.scheduledRange?.to),
  };
}

/** Create an order on a passenger's behalf (`capabilities.orderCreate`).
 * The price is decided by the server after creation. */
export function OrderCreateDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (o: OrderWithNames) => void }) {
  const [cities, setCities] = useState<City[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
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

  useEffect(() => {
    if (!open) return;
    setError(null);
    Promise.all([api.getCities(), api.getPassengers({})])
      .then(([c, p]) => {
        setCities(c);
        setPassengers(p);
        setF((x) => ({
          ...x,
          passengerId: x.passengerId || p[0]?.id || "",
          fromCityId: x.fromCityId || c[0]?.id || "",
          toCityId: x.toCityId || c[1]?.id || "",
        }));
      })
      .catch((e) => setError(errorText(e)));
  }, [open]);

  async function create() {
    if (f.fromCityId === f.toCityId) {
      setError("Qayerdan va qayerga bir xil bo'lmasin.");
      return;
    }
    if (f.mode === "seat" && f.seatIds.length === 0) {
      setError("Kamida bitta o'rindiq tanlang.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onCreated(
        await api.createOrderForPassenger({
          passengerId: f.passengerId,
          fromCityId: f.fromCityId,
          toCityId: f.toCityId,
          mode: f.mode,
          seatIds: f.mode === "seat" ? f.seatIds : [],
          paymentMethod: f.paymentMethod,
          timeWindow: f.setTimeWindow ? { from: f.timeFrom, to: f.timeTo } : undefined,
        })
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const cityOptions = cities.map((c) => ({ value: c.id, label: c.name }));
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Yangi buyurtma"
      submitLabel="Yaratish"
      onSubmit={create}
      loading={saving}
      disabled={!f.passengerId || !f.fromCityId || !f.toCityId}
      error={error}
    >
      <SelectField
        label="Yo'lovchi"
        required
        value={f.passengerId}
        onChange={(e) => setF((x) => ({ ...x, passengerId: e.target.value }))}
        options={passengers.map((p) => ({ value: p.id, label: `${p.name} · ${p.phone}` }))}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SelectField label="Qayerdan" required value={f.fromCityId} onChange={(e) => setF((x) => ({ ...x, fromCityId: e.target.value }))} options={cityOptions} />
        <SelectField label="Qayerga" required value={f.toCityId} onChange={(e) => setF((x) => ({ ...x, toCityId: e.target.value }))} options={cityOptions} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="label-caps px-1 text-muted">Buyurtma turi</span>
        <Segmented
          label="Buyurtma turi"
          value={f.mode}
          onChange={(mode) => setF((x) => ({ ...x, mode }))}
          items={[
            { key: "car", label: "Butun mashina" },
            { key: "seat", label: "O'rindiq" },
          ]}
        />
      </div>
      {f.mode === "seat" && <SeatPicker value={f.seatIds} onChange={(seatIds) => setF((x) => ({ ...x, seatIds }))} />}
      <div className="flex flex-col gap-2">
        <span className="label-caps px-1 text-muted">To'lov usuli</span>
        <Segmented
          label="To'lov usuli"
          value={f.paymentMethod}
          onChange={(paymentMethod) => setF((x) => ({ ...x, paymentMethod }))}
          items={[
            { key: "cash", label: "Naqd" },
            { key: "card", label: "Karta" },
          ]}
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm font-bold text-ink">
        <input
          type="checkbox"
          checked={f.setTimeWindow}
          onChange={(e) => setF((x) => ({ ...x, setTimeWindow: e.target.checked }))}
          className="h-5 w-5 accent-[var(--ink)]"
        />
        Olish vaqti oralig'ini belgilash
      </label>
      {f.setTimeWindow && (
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Dan"
            value={f.timeFrom}
            onChange={(e) => setF((x) => ({ ...x, timeFrom: e.target.value }))}
            options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
          />
          <SelectField
            label="Gacha"
            value={f.timeTo}
            onChange={(e) => setF((x) => ({ ...x, timeTo: e.target.value }))}
            options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
          />
        </div>
      )}
      <p className="px-1 text-xs font-medium text-muted">Narxni server hisoblaydi va buyurtmada ko'rsatadi.</p>
    </FormDrawer>
  );
}
