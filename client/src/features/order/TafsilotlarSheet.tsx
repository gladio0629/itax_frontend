import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { OrderMode, OrderTiming, OrderWithDetails, PaymentMethod, Seat } from "@/api/types";
import { addressById } from "@/clientData/addresses";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { useT } from "@/lib/i18n/provider";
import { PaymentMethodSection } from "./PaymentMethodSection";
import { SeatMap } from "./SeatMap";
import { AddressPickerSheet } from "./AddressPickerSheet";
import { TimeSelector } from "./TimeSelector";
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
  // A save that only changes, say, payment mustn't re-book the time.
  const [timingTouched, setTimingTouched] = useState(false);
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatsError, setSeatsError] = useState(false);
  const [seatsReload, setSeatsReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (fromAddressId && toAddressId) {
      api
        .getSeatMap({ fromAddressId, toAddressId })
        .then((s) => {
          setSeats(s);
          setSeatsError(false);
        })
        .catch(() => {
          setSeats([]);
          setSeatsError(true);
        });
    }
  }, [fromAddressId, toAddressId, seatsReload]);

  const fromAddress = addressById(fromAddressId) ?? null;
  const toAddress = addressById(toAddressId) ?? null;

  async function save() {
    setSaving(true);
    setError(false);
    try {
      const updated = await api.updateOrder(order.id, {
        fromAddressId,
        toAddressId,
        mode,
        seatIds,
        paymentMethod,
        ...(timingTouched ? { timing } : {}),
      });
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
          <SeatMap
            seats={seats}
            mode={mode}
            seatIds={seatIds}
            onChange={(m, ids) => {
              setMode(m);
              setSeatIds(ids);
            }}
            loadError={seatsError}
            onRetry={() => setSeatsReload((n) => n + 1)}
          />
        </div>

        <div className="mb-5">
          <TimeSelector
            value={timing}
            onChange={(next, source) => {
              setTiming(next);
              if (source === "user") setTimingTouched(true);
            }}
          />
        </div>

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

    </Sheet>
  );
}
