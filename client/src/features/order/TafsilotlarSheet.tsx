import { useEffect, useState } from "react";
import { ArrowUpDown } from "lucide-react";
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
    if (mode === "seat" && fromAddressId && toAddressId) {
      api.getSeatMap({ fromAddressId, toAddressId }).then(setSeats).catch(() => setSeats([]));
    }
  }, [mode, fromAddressId, toAddressId]);

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
      <div className="px-5 pb-6 pt-3">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("track.details")}</h2>

        <div className="mb-4 space-y-1 rounded-xl bg-accent-5 p-2">
          <button onClick={() => setPicker("from")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-ink/60">{t("order.from")}</p>
              <p className="truncate text-sm font-semibold text-ink">{fromAddress?.label ?? t("order.choosePlace")}</p>
            </div>
          </button>
          <div className="relative">
            <div className="mx-3 h-px bg-border" />
            <button
              onClick={() => {
                const f = fromAddressId;
                setFromAddressId(toAddressId);
                setToAddressId(f);
              }}
              aria-label={t("order.swap")}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-card text-accent shadow-softer"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setPicker("to")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-yellow" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-ink/60">{t("order.to")}</p>
              <p className="truncate text-sm font-semibold text-ink">{toAddress?.label ?? t("order.choosePlace")}</p>
            </div>
          </button>
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
          {mode === "seat" && (
            <div className="mt-3">
              <SeatMap
                seats={seats}
                selected={seatIds}
                onToggle={(id) => setSeatIds(seatIds.includes(id) ? seatIds.filter((s) => s !== id) : [...seatIds, id])}
              />
            </div>
          )}
        </div>

        <button
          onClick={() => setTimePickerOpen(true)}
          className="mb-4 flex w-full items-center justify-between rounded-xl bg-accent-5 px-4 py-3 text-left text-sm font-semibold text-accent"
        >
          <span className="tabular">{timingSummary(timing, t)}</span>
        </button>

        <PaymentMethodSection value={paymentMethod} onChange={setPaymentMethod} />

        {error && <p className="mt-3 text-xs font-medium text-danger">{t("order.submitError")}</p>}

        <div className="mt-5 flex gap-2">
          <Button variant="danger" onClick={onCancel}>
            {t("cancel.confirmAction")}
          </Button>
          <Button fullWidth loading={saving} onClick={save}>
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
