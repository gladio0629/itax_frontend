import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { Address, AddressDetails, CarClass, OrderDetailsRules, SchedulingRules, Seat } from "@/api/types";
import { newStopUid, type OrderDraft } from "@/stores/orderStore";
import { useQuery } from "@/lib/useQuery";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { formatSom } from "@/lib/format";
import { BottomSheet, PrimaryButton, TextButton } from "@/ui";
import { AddressFlow } from "@/features/address/AddressFlow";
import { AddressDetailsScreen } from "@/features/address/AddressDetailsScreen";
import type { QuoteRenewal } from "@/features/order/OrderSheet";
import { TripScreen, type RoutePoint } from "./TripScreen";
import { ExtrasScreen } from "./ExtrasScreen";
import { TimeScreen } from "./TimeScreen";
import { PaymentScreen } from "./PaymentScreen";

const caps = api.capabilities;

type Overlay = { kind: "pick"; target: RoutePoint | "newStop" } | { kind: "details"; target: RoutePoint } | { kind: "extras" } | { kind: "time" } | null;

/** Loading/error/success with the last good value kept (no flicker while re-pricing). */
function settle<T>(q: { status: string; data?: T }, last: { current: T | null }) {
  if (q.status === "success") last.current = q.data as T;
  if (q.status === "error") return { status: "error" as const };
  if (last.current != null) return { status: "success" as const, data: last.current };
  return { status: "loading" as const };
}

/**
 * Passenger order, design v2: Trip (step 1) → Payment (step 2) → search
 * (order tracking). Extras ("Bagaj va izoh"), Time and the address flow open
 * over them. The step lives in the URL (?step=payment) so the saved-cards
 * screen can come back to it. Every number shown comes from the adapter:
 * seat map, class prices, quote lines and total.
 */
export function PassengerFlow({
  draft,
  setField,
  addresses,
  onAddressChange,
  onSubmit,
  submitting,
  submitError,
  quoteRenewal,
  onQuoteRenewalCancel,
  onClose,
}: {
  draft: OrderDraft;
  setField: <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => void;
  addresses: { from: Address | null; to: Address | null };
  onAddressChange: (which: "from" | "to", addr: Address) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
  quoteRenewal?: QuoteRenewal | null;
  onQuoteRenewalCancel?: () => void;
  onClose: () => void;
}) {
  const { t, intlTag } = useT();
  const [params, setParams] = useSearchParams();
  const step = params.get("step") === "payment" ? "payment" : "trip";
  const [overlay, setOverlay] = useState<Overlay>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const rules = useQuery<OrderDetailsRules | null>(() => api.getOrderDetailsRules().catch(() => null), []);
  const rulesData = rules.status === "success" ? rules.data : null;
  const scheduling = useQuery<SchedulingRules>(() => api.getSchedulingRules(), []);

  const canQuote = !!draft.fromAddressId && !!draft.toAddressId && draft.fromAddressId !== draft.toAddressId;
  const stopsKey = draft.stops.map((st) => st.addressId).join("|");
  const timingKey = JSON.stringify(draft.timing);
  const seatsKey = draft.seatIds.join(",");

  const [seatsReload, setSeatsReload] = useState(0);
  const seats = useQuery<Seat[]>(
    () => (canQuote ? api.getSeatMap({ fromAddressId: draft.fromAddressId, toAddressId: draft.toAddressId }) : Promise.resolve([])),
    [canQuote, draft.fromAddressId, draft.toAddressId, seatsReload]
  );
  // A seat taken in the meantime: drop it from the draft (whole car too).
  useEffect(() => {
    if (seats.status !== "success") return;
    const taken = new Set<string>(seats.data.filter((s) => s.taken).map((s) => s.id));
    const d = draftRef.current;
    if (d.mode === "car" && taken.size > 0) {
      setField("mode", "seat");
      setField("seatIds", []);
    } else if (d.seatIds.some((id) => taken.has(id))) setField("seatIds", d.seatIds.filter((id) => !taken.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats.status === "success" ? seats.data : null]);

  // Wishes are removed (2026-11-22): nothing is ever sent as an option.
  const quoteInput = {
    serviceType: "passenger" as const,
    fromAddressId: draft.fromAddressId,
    toAddressId: draft.toAddressId,
    stops: draft.stops.map((st) => st.addressId),
    mode: draft.mode,
    seatIds: draft.seatIds,
    promoCode: draft.promoCode || undefined,
    timing: draft.timing,
  };
  const quote = useQuery(
    // No route yet: stay "loading" (the price shows "…", not an error).
    () => (canQuote ? api.getQuote({ ...quoteInput, carClass: draft.carClass }) : new Promise<never>(() => {})),
    [canQuote, draft.fromAddressId, draft.toAddressId, stopsKey, draft.mode, seatsKey, draft.carClass, draft.promoCode, timingKey]
  );
  const classes = useQuery<CarClass[]>(
    () => (canQuote ? api.getCarClasses(quoteInput) : Promise.resolve([])),
    [canQuote, draft.fromAddressId, draft.toAddressId, stopsKey, draft.mode, seatsKey, draft.promoCode, timingKey]
  );
  // The chosen class went unavailable: take the first one the server offers.
  useEffect(() => {
    if (classes.status !== "success") return;
    const cur = classes.data.find((c) => c.id === draftRef.current.carClass);
    if (cur && !cur.available) {
      const first = classes.data.find((c) => c.available);
      if (first) setField("carClass", first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes.status === "success" ? classes.data : null]);
  // A renewed quote (submit found the old one unusable): re-price.
  useEffect(() => {
    if (!quoteRenewal) return;
    quote.refetch();
    classes.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteRenewal]);

  const luggage = useQuery(
    () => (canQuote && caps.orderOptions ? api.getLuggageRules({ fromAddressId: draft.fromAddressId, toAddressId: draft.toAddressId }).catch(() => null) : Promise.resolve(null)),
    [canQuote, draft.fromAddressId, draft.toAddressId]
  );

  const lastQuote = useRef(null as null | Awaited<ReturnType<typeof api.getQuote>>);
  const lastClasses = useRef<CarClass[] | null>(null);
  const lastSeats = useRef<Seat[] | null>(null);
  const quoteView = settle(quote as { status: string; data?: Awaited<ReturnType<typeof api.getQuote>> }, lastQuote);
  const classesView = settle(classes as { status: string; data?: CarClass[] }, lastClasses);
  const seatsView = settle(seats as { status: string; data?: Seat[] }, lastSeats);

  // ── Route points ───────────────────────────────────────────────────────
  function pointAddressId(p: RoutePoint): string {
    const d = draftRef.current;
    if (p === "from") return d.fromAddressId;
    if (p === "to") return d.toAddressId;
    return d.stops.find((st) => st.uid === p.stop)?.addressId ?? "";
  }
  function pointDetails(p: RoutePoint): AddressDetails {
    const d = draftRef.current;
    if (p === "from") return d.fromDetails;
    if (p === "to") return d.toDetails;
    return d.stops.find((st) => st.uid === p.stop)?.details ?? {};
  }
  function setPointDetails(p: RoutePoint, details: AddressDetails) {
    if (p === "from") setField("fromDetails", details);
    else if (p === "to") setField("toDetails", details);
    else setField("stops", draftRef.current.stops.map((st) => (st.uid === p.stop ? { ...st, details } : st)));
  }
  /** A new point starts clean; details typed on the map are kept; a saved
   * place brings its own back; an entrance from search fills Podyezd. */
  function pick(which: RoutePoint | "newStop", addr: Address, entrance?: string, entered?: AddressDetails) {
    let target: RoutePoint;
    if (which === "newStop") {
      const uid = newStopUid();
      setField("stops", [...draftRef.current.stops, { uid, addressId: addr.id, details: {} }]);
      target = { stop: uid };
    } else if (which === "from" || which === "to") {
      onAddressChange(which, addr);
      setField(which === "from" ? "fromDetails" : "toDetails", {});
      target = which;
    } else {
      setField("stops", draftRef.current.stops.map((st) => (st.uid === which.stop ? { ...st, addressId: addr.id, details: {} } : st)));
      target = which;
    }
    if (!caps.addressDetails) return;
    const fromSearch: AddressDetails = entrance ? { entrance } : {};
    if (entered) {
      setPointDetails(target, { ...entered, ...fromSearch });
      return;
    }
    if (entrance) setPointDetails(target, fromSearch);
    api
      .getSavedAddressDetails(addr.id)
      .then((saved) => {
        if (saved && pointAddressId(target) === addr.id) setPointDetails(target, { ...saved, ...fromSearch });
      })
      .catch(() => {});
  }

  // No drop-off yet: open its search right away (keyboard up).
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current) return;
    autoOpened.current = true;
    if (!addresses.to) setOverlay({ kind: "pick", target: "to" });
    else if (!addresses.from) setOverlay({ kind: "pick", target: "from" });
  }, [addresses.to, addresses.from]);

  const maxStops = !caps.stops ? 0 : rulesData ? rulesData.maxStops : null;
  const stopAddresses = draft.stops.map((st) => api.addressById(st.addressId));
  const goStep = (s: "trip" | "payment") => {
    const next = new URLSearchParams(params);
    if (s === "payment") next.set("step", "payment");
    else next.delete("step");
    setParams(next, { replace: s === "trip" });
  };

  // ── Overlays ───────────────────────────────────────────────────────────
  function renderOverlay() {
    if (!overlay) return null;
    if (overlay.kind === "pick") {
      const target = overlay.target;
      const stopIndex = typeof target === "object" ? draft.stops.findIndex((st) => st.uid === target.stop) : -1;
      return (
        <AddressFlow
          target={target === "from" ? "from" : target === "to" ? "to" : "stop"}
          title={target === "from" ? t("order.from") : target === "to" ? t("order.to") : target === "newStop" ? t("trip.addStop") : t("trip.stopLabel", { n: stopIndex + 1 })}
          fromLabel={addresses.from?.label}
          toLabel={addresses.to?.label}
          fromAddressId={target === "from" ? undefined : draft.fromAddressId}
          // A pickup can't be in the drop-off's city and vice versa; a stop can be anywhere.
          excludeCityId={target === "from" ? addresses.to?.cityId : target === "to" ? addresses.from?.cityId : undefined}
          rules={rulesData}
          onClose={() => setOverlay(null)}
          onDone={(addr, entrance, details) => {
            pick(target, addr, entrance, details);
            setOverlay(null);
          }}
        />
      );
    }
    if (overlay.kind === "details") {
      const addr = api.addressById(pointAddressId(overlay.target));
      if (!addr) return null;
      const target = overlay.target;
      return (
        <AddressDetailsScreen
          address={addr}
          value={pointDetails(target)}
          rules={rulesData}
          mode="point"
          onClose={() => setOverlay(null)}
          onDone={(d) => {
            setPointDetails(target, d);
            setOverlay(null);
          }}
        />
      );
    }
    if (overlay.kind === "extras") {
      return (
        <ExtrasScreen
          value={{ luggage: draft.luggage, comment: draft.comment, rider: draft.rider }}
          luggageRules={luggage.status === "success" ? luggage.data : null}
          rules={rulesData}
          onBack={() => setOverlay(null)}
          onDone={(v) => {
            setField("luggage", v.luggage);
            setField("comment", v.comment);
            setField("rider", v.rider);
            setOverlay(null);
          }}
        />
      );
    }
    if (overlay.kind === "time" && scheduling.status === "success") {
      return (
        <TimeScreen
          value={draft.timing}
          rules={scheduling.data}
          onBack={() => setOverlay(null)}
          onDone={(timing) => {
            setField("timing", timing);
            setOverlay(null);
          }}
        />
      );
    }
    return null;
  }

  return (
    <div className="relative h-full">
      {step === "trip" ? (
        <TripScreen
          draft={draft}
          from={addresses.from}
          to={addresses.to}
          stops={stopAddresses}
          maxStops={maxStops}
          seats={seatsView}
          classes={classesView}
          quote={quoteView}
          onBack={onClose}
          onPick={(p) => setOverlay({ kind: "pick", target: p })}
          onAddStop={() => setOverlay({ kind: "pick", target: "newStop" })}
          onRemoveStop={(uid) => setField("stops", draftRef.current.stops.filter((st) => st.uid !== uid))}
          onDetails={caps.addressDetails ? (p) => setOverlay({ kind: "details", target: p }) : undefined}
          onSeats={(mode, seatIds) => {
            setField("mode", mode);
            setField("seatIds", seatIds);
          }}
          onClass={(id) => setField("carClass", id)}
          onExtras={() => setOverlay({ kind: "extras" })}
          onRetrySeats={() => setSeatsReload((n) => n + 1)}
          onContinue={() => goStep("payment")}
        />
      ) : (
        <PaymentScreen
          quote={quoteView}
          timing={draft.timing}
          method={draft.paymentMethod}
          promoCode={draft.promoCode}
          onMethod={(m) => setField("paymentMethod", m)}
          onPromo={(c) => setField("promoCode", c)}
          onTime={() => setOverlay({ kind: "time" })}
          onSubmit={onSubmit}
          submitting={submitting}
          submitError={submitError}
          onBack={() => goStep("trip")}
        />
      )}
      {renderOverlay()}
      <BottomSheet
        open={!!quoteRenewal}
        onClose={() => onQuoteRenewalCancel?.()}
        title={t("order.quoteRenewal.title")}
        footer={
          <>
            <PrimaryButton loading={submitting} onClick={onSubmit}>
              {t("common.confirm")}
            </PrimaryButton>
            <TextButton onClick={() => onQuoteRenewalCancel?.()}>{t("common.cancel")}</TextButton>
          </>
        }
      >
        {quoteRenewal && (
          <p className="text-[15px] leading-[22px] text-iz-ink">
            {t(quoteRenewal.messageKey as TranslationKey)} {t("order.quoteRenewal.newPrice", { price: formatSom(quoteRenewal.total, intlTag) })}
          </p>
        )}
      </BottomSheet>
    </div>
  );
}
