import { useEffect, useState } from "react";
import { Pencil } from "@/lib/icons";
import { api } from "@/api/client";
import type { OrderMode, OrderTiming, OrderWithDetails, PaymentMethod, Seat } from "@/api/types";
import { addressById } from "@/clientData/addresses";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { useT } from "@/lib/i18n/provider";
import { PassengerCountButtons } from "./PassengerCountButtons";
import { PaymentMethodSection } from "./PaymentMethodSection";
import { SeatMap } from "./SeatMap";
import { AddressPickerSheet } from "./AddressPickerSheet";
import { TimePickerSheet } from "./TimePickerSheet";
import { timingSummary } from "./timingSummary";
import { RouteFields } from "./RouteFields";

export function TafsilotlarSheet({
  order,
  onClose,
  onUpdated,
  onCancel,
}: {
  order: OrderWithDetails;
  onClose: () => void;
  onUpdated: (order: OrderWithDetails) => void;
  onCancel: () => void;
}) {
  const { t } = useT();

  // Snapshotted once from the order as it stood when Tafsilotlar opened —
  // the track screen polls every 1.5s, and re-syncing from that would wipe
  // out whatever the passenger is mid-way through editing here.
  const [fromAddressId, setFromAddressId] = useState(order.extras?.fromAddressId ?? "");
  const [toAddressId, setToAddressId] = useState(order.extras?.toAddressId ?? "");
  const [mode, setMode] = useState<OrderMode>(order.mode);
  const [seatIds, setSeatIds] = useState<string[]>(order.seatIds);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order.paymentMethod);
  const [timing, setTiming] = useState<OrderTiming>(order.extras?.timing ?? { timeMode: "now" });
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (fromAddressId && toAddressId) {
      api.getSeatMap({ fromAddressId, toAddressId }).then(setSeats).catch(() => setSeats([]));
    }
  }, [fromAddressId, toAddressId]);

  const fromAddress = addressById(fromAddressId) ?? null;
  const toAddress = addressById(toAddressId) ?? null;

  async function save() {
    setSaving(true);
    setError(false);
    try {
      const updated = await api.updateOrder(order.id, { fromAddressId, toAddressId, mode, seatIds, paymentMethod, timing });
      onUpdated(updated);
      onClose();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!order.editable) {
    return (
      <Sheet open onClose={onClose} ariaLabel={t("track.details")}>
        <div className="px-5 pb-6 pt-3">
          <h2 className="mb-2 text-sm font-semibold text-ink">{t("track.details")}</h2>
          <p className="mb-5 text-sm text-ink/60">{t("order.locked.notEditable")}</p>
          <Button variant="danger" fullWidth onClick={onCancel}>
            {t("cancel.confirmAction")}
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} ariaLabel={t("track.details")}>
      <div className="px-5 pt-3">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("track.details")}</h2>

        <div className="mb-4">
          <RouteFields
            from={fromAddress}
            to={toAddress}
            onPick={setPicker}
            onSwap={() => {
              const f = fromAddressId;
              setFromAddressId(toAddressId);
              setToAddressId(f);
            }}
          />
        </div>

        <div className="mb-4">
          <PassengerCountButtons
            seats={seats}
            mode={mode}
            seatIds={seatIds}
            onChange={(m, s) => {
              setMode(m);
              setSeatIds(s);
            }}
          />
          <div className="mt-3">
            <SeatMap
              seats={seats}
              selected={seatIds}
              onToggle={(id) => setSeatIds(seatIds.includes(id) ? seatIds.filter((s) => s !== id) : [...seatIds, id])}
              wholeCar={mode === "car"}
              onWholeCarChange={(whole) => {
                setMode(whole ? "car" : "seat");
                setSeatIds([]);
              }}
            />
          </div>
        </div>

        <button
          onClick={() => setTimePickerOpen(true)}
          className="mb-4 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl bg-accent-5 px-4 py-3 text-left text-sm font-semibold text-accent"
        >
          <span className="tabular">{timingSummary(timing, t)}</span>
          <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>

        <PaymentMethodSection value={paymentMethod} onChange={setPaymentMethod} />

        {error && (
          <p role="alert" aria-live="polite" className="mt-3 text-xs font-normal text-danger">
            {t("order.submitError")}
          </p>
        )}

        <div className="sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-3 border-t border-border bg-card px-5 pt-3">
          <Button variant="dangerSoft" fullWidth onClick={onCancel}>
            {t("cancel.confirmAction")}
          </Button>
          <Button fullWidth loading={saving} disabled={mode === "seat" && seatIds.length === 0} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>

      {picker && (
        <AddressPickerSheet
          title={t(picker === "from" ? "order.from" : "order.to")}
          excludeCityId={picker === "from" ? toAddress?.cityId : fromAddress?.cityId}
          onClose={() => setPicker(null)}
          onSelect={(addr) => {
            if (picker === "from") setFromAddressId(addr.id);
            else setToAddressId(addr.id);
            setPicker(null);
          }}
        />
      )}

      {timePickerOpen && (
        <TimePickerSheet initial={timing} onClose={() => setTimePickerOpen(false)} onApply={(t) => { setTiming(t); setTimePickerOpen(false); }} />
      )}
    </Sheet>
  );
}
