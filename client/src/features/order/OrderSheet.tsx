import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Banknote, CreditCard, Package, SlidersHorizontal } from "@/lib/icons";
import { api } from "@/api/client";
import type { Address, AddressDetails, CargoCheck, CargoInfoTopic, CargoInput, CarClass, OrderDetailsRules, OrderOption, Seat } from "@/api/types";
import { addressById } from "@/clientData/addresses";
import { newStopUid, type OrderDraft } from "@/stores/orderStore";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { MapCanvas, ROUTE } from "@/components/MapCanvas";
import { MapButton } from "@/components/ui/MapButton";
import { TextTabs } from "@/components/ui/TextTabs";
import { Chip } from "@/components/ui/Chip";
import { CloseButton } from "@/components/ui/CloseButton";
import { formatSom, formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { useQuery } from "@/lib/useQuery";
import { cn } from "@/lib/cn";
import { ruleErrorKey } from "@/lib/apiError";
import { SeatMap, seatCountLabel } from "./SeatMap";
import { VehiclePicker } from "./VehiclePicker";
import { TimeSelector } from "./TimeSelector";
import { PaymentMethodSection } from "./PaymentMethodSection";
import { timingSummary } from "./timingSummary";
import { RouteFields, type RouteStopLabels, type RouteTarget } from "./RouteFields";
import { AddressDetailsSheet } from "./AddressDetailsSheet";
import { DriverComment } from "./OrderExtras";
import { CarClassPicker } from "./CarClassPicker";
import { IstaklarRow, IstaklarSheet } from "./IstaklarSheet";
import { ContactFields, ContactNote, LuggageStepper, PromoRow, RiderSection, type RiderError } from "./TripDetails";
import { CargoInfoChips, CargoInfoSheet, CargoTabs, LoadersControl, PricingModeControl, RideAlongRow, WarehouseSheet } from "./KargoControls";
import { SearchScreen } from "./SearchScreen";
import { detailsSummary } from "./addressDetails";
import { formatDuration } from "./duration";

/**
 * The route screen (reference structure): the map with the route line and
 * its bubbles, and a sheet — route rows (Podyezd capsules, round +), TAKSI /
 * KARGO tabs, the class carousel, chips for seats / time / price, and a
 * bottom bar (payment · Buyurtma berish · options). Kargo is a stack of
 * white cards on the dark backdrop with its own confirm button.
 * Everything priced, limited or validated comes from the adapter.
 */
export function OrderSheet({
  draft,
  setField,
  addresses,
  onAddressChange,
  onSubmit,
  submitting,
  submitError,
  onClose,
}: {
  draft: OrderDraft;
  setField: <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => void;
  addresses: { from: Address | null; to: Address | null };
  onAddressChange: (which: "from" | "to", addr: Address) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: boolean;
  /** Back to the home screen. */
  onClose: () => void;
}) {
  const { t, intlTag } = useT();
  // "newStop" opens the search for a stop that is only added once picked,
  // so an empty stop never reaches the quote.
  const [picker, setPicker] = useState<RouteTarget | "newStop" | null>(null);
  const [detailsFor, setDetailsFor] = useState<RouteTarget | null>(null);
  const [rules, setRules] = useState<OrderDetailsRules | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    let alive = true;
    let attempt = 0;
    const load = () =>
      api
        .getOrderDetailsRules()
        .then((r) => alive && setRules(r))
        .catch(() => {
          if (alive && ++attempt < 4) window.setTimeout(load, 800);
        });
    load();
    return () => {
      alive = false;
    };
  }, []);

  const passenger = draft.serviceType === "passenger";
  const options = useQuery(
    () => api.getOrderOptions({ serviceType: draft.serviceType, carClass: passenger ? draft.carClass : undefined }),
    [draft.serviceType, draft.carClass]
  );
  const optionList = options.status === "success" ? options.data : [];
  const [istaklarOpen, setIstaklarOpen] = useState(false);
  const riderRef = useRef<{ focus: (f: "name" | "phone") => void }>(null);
  const [riderError, setRiderError] = useState<RiderError>(null);
  const [validating, setValidating] = useState(false);

  /** Switching an option on applies the adapter's default sub-choice (the
   * child seat's age group); off clears it. */
  function setOption(o: OrderOption, on: boolean) {
    const d = draftRef.current;
    setField("optionIds", on ? [...d.optionIds.filter((x) => x !== o.id), o.id] : d.optionIds.filter((x) => x !== o.id));
    if (o.variants) {
      const v = { ...d.optionVariants };
      if (on) v[o.id] = v[o.id] ?? o.defaultVariant;
      else delete v[o.id];
      setField("optionVariants", v);
    }
  }

  // A class change can make a selected option unavailable: drop it rather
  // than send something the adapter will refuse.
  const optionData = options.status === "success" ? options.data : null;
  useEffect(() => {
    if (!optionData) return;
    const ok = new Set(optionData.filter((o) => o.available).map((o) => o.id));
    const d = draftRef.current;
    const kept = d.optionIds.filter((id) => ok.has(id));
    if (kept.length !== d.optionIds.length) setField("optionIds", kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionData]);

  function pointAddressId(target: RouteTarget, d: OrderDraft = draftRef.current) {
    if (target === "from") return d.fromAddressId;
    if (target === "to") return d.toAddressId;
    return d.stops.find((st) => st.uid === target.stop)?.addressId ?? "";
  }
  function pointDetails(target: RouteTarget): AddressDetails {
    if (target === "from") return draft.fromDetails;
    if (target === "to") return draft.toDetails;
    return draft.stops.find((st) => st.uid === target.stop)?.details ?? {};
  }
  function setPointDetails(target: RouteTarget, details: AddressDetails) {
    if (target === "from") setField("fromDetails", details);
    else if (target === "to") setField("toDetails", details);
    else {
      setField(
        "stops",
        draftRef.current.stops.map((st) => (st.uid === target.stop ? { ...st, details } : st))
      );
    }
  }

  /** A new address starts without the old one's Tafsilotlar; a saved
   * address brings its own back from the adapter, and an entrance variant
   * picked in search (the adapter's) fills in "Podyezd". */
  function pickAddress(which: RouteTarget | "newStop", addr: Address, entrance?: string) {
    let target: RouteTarget;
    if (which === "newStop") {
      const uid = newStopUid();
      setField("stops", [...draftRef.current.stops, { uid, addressId: addr.id, details: {} }]);
      target = { stop: uid };
    } else if (which === "from" || which === "to") {
      onAddressChange(which, addr);
      setField(which === "from" ? "fromDetails" : "toDetails", {});
      target = which;
    } else {
      setField(
        "stops",
        draftRef.current.stops.map((st) => (st.uid === which.stop ? { ...st, addressId: addr.id, details: {} } : st))
      );
      target = which;
    }
    const picked: AddressDetails = entrance ? { entrance } : {};
    if (entrance) setPointDetails(target, picked);
    api
      .getSavedAddressDetails(addr.id)
      .then((saved) => {
        if (saved && pointAddressId(target) === addr.id) setPointDetails(target, { ...saved, ...picked });
      })
      .catch(() => {});
  }

  const stopsKey = draft.stops.map((st) => st.addressId).join("|");
  const cargoKey = JSON.stringify({ ...draft.cargo, note: undefined });
  const contactsKey = JSON.stringify([draft.sender, draft.receiver]);
  const optionsKey = draft.optionIds.join(",");
  const variantsKey = JSON.stringify(draft.optionVariants);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatsError, setSeatsError] = useState(false);
  const [seatsReload, setSeatsReload] = useState(0);
  const autoOpenedPicker = useRef(false);

  // Spec: expanding into the route step without a "to" address yet should
  // jump straight into the search sheet, keyboard up.
  useEffect(() => {
    if (!autoOpenedPicker.current && !addresses.to) {
      autoOpenedPicker.current = true;
      setPicker("to");
    }
  }, [addresses.to]);

  const canQuote = !!draft.fromAddressId && !!draft.toAddressId && draft.fromAddressId !== addresses.to?.id;

  useEffect(() => {
    if (draft.serviceType === "passenger" && draft.fromAddressId && draft.toAddressId) {
      api
        .getSeatMap({ fromAddressId: draft.fromAddressId, toAddressId: draft.toAddressId })
        .then((s) => {
          setSeats(s);
          setSeatsError(false);
        })
        .catch(() => {
          setSeats([]);
          setSeatsError(true);
        });
    }
  }, [draft.serviceType, draft.fromAddressId, draft.toAddressId, seatsReload]);

  const quote = useQuery(
    () =>
      api.getQuote({
        serviceType: draft.serviceType,
        fromAddressId: draft.fromAddressId,
        toAddressId: draft.toAddressId,
        stops: draft.stops.map((st) => st.addressId),
        mode: draft.mode,
        seatIds: draft.seatIds,
        cargo: draft.serviceType === "delivery" ? draft.cargo : undefined,
        optionIds: draft.optionIds,
        optionVariants: draft.optionVariants,
        carClass: passenger ? draft.carClass : undefined,
        promoCode: draft.promoCode || undefined,
      }),
    // Keyed on the cargo without its note — typing a note mustn't refetch;
    // likewise the comment and Tafsilotlar never re-quote. Every stop
    // add/remove/reorder/change does.
    [draft.serviceType, draft.fromAddressId, draft.toAddressId, stopsKey, draft.mode, draft.seatIds, cargoKey, optionsKey, variantsKey, draft.carClass, draft.promoCode]
  );

  // Class cards: each price is the adapter's total for this order with that
  // class, so they follow the same inputs as the quote (minus the class).
  const classes = useQuery(
    () =>
      passenger && canQuote
        ? api.getCarClasses({
            serviceType: "passenger",
            fromAddressId: draft.fromAddressId,
            toAddressId: draft.toAddressId,
            stops: draft.stops.map((st) => st.addressId),
            mode: draft.mode,
            seatIds: draft.seatIds,
            optionIds: draft.optionIds,
            optionVariants: draft.optionVariants,
            promoCode: draft.promoCode || undefined,
          })
        : Promise.resolve([] as CarClass[]),
    [passenger, canQuote, draft.fromAddressId, draft.toAddressId, stopsKey, draft.mode, draft.seatIds, optionsKey, variantsKey, draft.promoCode]
  );
  // Keep the last cards on screen while they re-price.
  const lastClasses = useRef<CarClass[]>([]);
  if (classes.status === "success") lastClasses.current = classes.data;
  const classData = classes.status === "success" ? classes.data : null;
  useEffect(() => {
    if (!classData || !passenger) return;
    const current = classData.find((c) => c.id === draftRef.current.carClass);
    if (current && !current.available) {
      const first = classData.find((c) => c.available);
      if (first) setField("carClass", first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classData]);

  const luggageRules = useQuery(
    () => (canQuote ? api.getLuggageRules({ fromAddressId: draft.fromAddressId, toAddressId: draft.toAddressId }) : Promise.resolve(null)),
    [canQuote, draft.fromAddressId, draft.toAddressId]
  );
  const luggage = luggageRules.status === "success" ? luggageRules.data : null;

  // ── Kargo ────────────────────────────────────────────────────────────────
  const delivery = draft.serviceType === "delivery";
  const cargoRules = useQuery(() => api.getCargoRules(), []);
  const cr = cargoRules.status === "success" ? cargoRules.data : null;
  const tab = draft.cargo.tab ?? cr?.defaultTab ?? "intercity";
  const mode = draft.cargo.pricingMode ?? "route";
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [infoTopic, setInfoTopic] = useState<CargoInfoTopic | null>(null);
  function setCargo(patch: Partial<CargoInput>) {
    setField("cargo", { ...draftRef.current.cargo, ...patch });
  }
  // A tab without "Soatbay" falls back to "Marshrut bo'yicha".
  useEffect(() => {
    if (!cr) return;
    const m = cr.pricingModes[tab].find((x) => x.id === mode);
    if (!m?.available) setCargo({ pricingMode: "route" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr, tab]);
  const rideAlong = useQuery(
    () => (delivery ? api.getRideAlong({ vehicle: draft.cargo.vehicle, loaders: draft.cargo.loaders ?? 0 }) : Promise.resolve(null)),
    [delivery, draft.cargo.vehicle, draft.cargo.loaders]
  );
  const rideAlongData = rideAlong.status === "success" ? rideAlong.data : null;
  // No free seat (vehicle, or loaders took it): ride-along turns off.
  useEffect(() => {
    if (rideAlongData && !rideAlongData.available && draftRef.current.cargo.rideAlong) setCargo({ rideAlong: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideAlongData]);

  // "Tasdiqlash" readiness comes from the adapter (debounced, latest wins).
  const [cargoCheck, setCargoCheck] = useState<CargoCheck | null>(null);
  const checkReq = useRef(0);
  useEffect(() => {
    if (!delivery || !canQuote) return;
    const req = ++checkReq.current;
    let timer = 0;
    const run = () => {
      const d = draftRef.current;
      api
        .checkCargo({
          fromAddressId: d.fromAddressId,
          toAddressId: d.toAddressId,
          stops: d.stops.map((st) => st.addressId),
          cargo: d.cargo,
          sender: d.sender,
          receiver: d.receiver,
        })
        .then((r) => {
          if (req === checkReq.current) setCargoCheck(r);
        })
        // A dropped check would leave Tasdiqlash stuck: try again shortly.
        .catch(() => {
          if (req === checkReq.current) timer = window.setTimeout(run, 1000);
        });
    };
    timer = window.setTimeout(run, 250);
    return () => window.clearTimeout(timer);
  }, [delivery, canQuote, draft.fromAddressId, draft.toAddressId, stopsKey, cargoKey, contactsKey]);
  // Field errors show once the person has left that field.
  const [touched, setTouched] = useState<string[]>([]);
  const touch = (f: string) => setTouched((x) => (x.includes(f) ? x : [...x, f]));
  const fieldIssue = (f: string) => {
    if (!touched.includes(f)) return undefined;
    const key = cargoCheck?.issues.find((i) => i.field === f)?.messageKey;
    return key ? t(key as TranslationKey) : undefined;
  };

  /** Where the address search may look: Kargo follows its tab. */
  function pickerScope(target: RouteTarget | "newStop"): { excludeCityId?: string; onlyCityId?: string } {
    const fromCity = addresses.from?.cityId;
    if (target === "from") return delivery ? {} : { excludeCityId: addresses.to?.cityId };
    if (delivery) {
      if (tab === "city") return { onlyCityId: fromCity };
      if (tab === "intercity" && target === "to") return { excludeCityId: fromCity };
      return {};
    }
    // A stop can be anywhere, including the pickup or drop-off city.
    return target === "to" ? { excludeCityId: fromCity } : {};
  }
  const stopLabels: RouteStopLabels | undefined = delivery
    ? {
        add: t("kargo.addDropoff"),
        item: (n) => t("kargo.dropoff", { n }),
        remove: (n) => t("kargo.dropoffRemove", { n }),
        reorder: (n) => t("kargo.dropoffReorder", { n }),
        limit: (max) => t("kargo.dropoffLimit", { max }),
      }
    : undefined;
  const stopMax = delivery ? (cr ? cr.maxExtraDropoffs[tab] : null) : rules?.maxStops ?? null;

  // ── Sheets of the route screen ──────────────────────────────────────────
  const [sheet, setSheet] = useState<null | "options" | "seats" | "price" | "payment" | "cargoSummary">(null);

  /** "Buyurtma berish": the adapter checks "Kim ketadi?" first; a problem
   * opens the options sheet with the field focused (nothing is guessed here). */
  async function submitTaxi() {
    if (passenger && draft.rider.kind === "other") {
      setValidating(true);
      setRiderError(null);
      try {
        await api.validateRider(draft.rider);
      } catch (err) {
        const e = err as { code?: string; message?: string };
        if (e.code === "RIDER_NAME" || e.code === "RIDER_PHONE") {
          const field = e.code === "RIDER_NAME" ? "name" : "phone";
          setRiderError({ field, message: t(e.message as TranslationKey) });
          setSheet("options");
          window.setTimeout(() => riderRef.current?.focus(field), 350);
        } else setRiderError({ field: "form", message: t("common.errorMessage") });
        return;
      } finally {
        setValidating(false);
      }
    }
    onSubmit();
  }

  // Per-seat booking needs at least one seat (the old step gate).
  const needSeats = passenger && draft.mode === "seat" && draft.seatIds.length === 0;
  const routeEta = quote.status === "success" ? formatDuration(quote.data.durationMinutes, t) : undefined;
  const selectedClass = (classes.status === "success" ? classes.data : lastClasses.current).find((c) => c.id === draft.carClass);

  const routeBlock = (
    <RouteFields
      from={addresses.from}
      to={addresses.to}
      // Marketpleysga: the drop-off is a warehouse from the list.
      onPick={(which) => (delivery && tab === "marketplace" && which === "to" ? setWarehouseOpen(true) : setPicker(which))}
      onSwap={() => {
        const f = draft.fromAddressId;
        const fd = draft.fromDetails;
        setField("fromAddressId", draft.toAddressId);
        setField("toAddressId", f);
        setField("fromDetails", draft.toDetails);
        setField("toDetails", fd);
        // Swapping reverses the whole route, stops included.
        setField("stops", [...draft.stops].reverse());
      }}
      fromDetailsLine={detailsSummary(draft.fromDetails, t)}
      toDetailsLine={detailsSummary(draft.toDetails, t)}
      onDetails={setDetailsFor}
      stops={draft.stops.map((st) => ({
        uid: st.uid,
        address: addressById(st.addressId) ?? null,
        detailsLine: detailsSummary(st.details, t),
      }))}
      maxStops={stopMax}
      onAddStop={stopMax === 0 ? undefined : () => setPicker("newStop")}
      labels={stopLabels}
      toLabel={delivery && tab === "marketplace" ? t("kargo.warehouse") : undefined}
      canSwap={!(delivery && tab === "marketplace")}
      // Taxi rows: address only, "Podyezd" capsule, round + (reference);
      // Kargo rows: labelled, "Tafsilotlar" capsules, "Manzil +" chip.
      addStyle={delivery ? "chip" : "plus"}
      showLabels={delivery}
      fromDetailsText={delivery ? undefined : t("details.entrance")}
      toDetailsText={delivery ? undefined : t("details.entrance")}
      toTrailing={delivery ? undefined : routeEta}
      onPickStop={(uid) => setPicker({ stop: uid })}
      onRemoveStop={(uid) => setField("stops", draftRef.current.stops.filter((st) => st.uid !== uid))}
      onReorderStops={(from, to) => {
        const next = [...draftRef.current.stops];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setField("stops", next);
      }}
    />
  );

  /** A rule the person can fix shows the adapter's reason; anything else a retry. */
  const quoteError = (err: unknown, onRetry: () => void, className?: string) => {
    const key = ruleErrorKey(err);
    return key ? (
      <p role="alert" className={cn("text-sub font-semibold text-danger", className)}>
        {t(key as TranslationKey)}
      </p>
    ) : (
      <button onClick={onRetry} className={cn("inline-flex min-h-[44px] items-center text-sub font-semibold text-danger underline", className)}>
        {t("order.quoteError")}
      </button>
    );
  };

  const serviceTabs = (
    <TextTabs
      uppercase
      ariaLabel={t("service.tabs")}
      value={draft.serviceType}
      onChange={(v) => {
        setField("serviceType", v);
        setField("optionIds", []);
      }}
      options={[
        { id: "passenger", label: t("service.taxi") },
        { id: "delivery", label: t("service.cargo") },
      ]}
    />
  );

  const priceLines = (
    <div aria-live="polite">
      {quote.status === "loading" && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      )}
      {quote.status === "error" && quoteError(quote.error, quote.refetch)}
      {quote.status === "success" && (
        <div className="space-y-2">
          {quote.data.lines.map((line, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-control">
              <span className="min-w-0 text-ink/60">{t(line.key as TranslationKey, line.params)}</span>
              <span className="shrink-0 tabular text-ink">{formatSom(line.amount, intlTag)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-hairline pt-2 text-body font-semibold">
            <span className="text-ink">{t("order.total")}</span>
            <span className="tabular text-ink">{formatSom(quote.data.total, intlTag)}</span>
          </div>
        </div>
      )}
    </div>
  );

  const summaryBlock = (
    <div className="space-y-1.5">
      <ol className="space-y-1.5">
        {[
          { key: "from", label: addresses.from?.label, details: draft.fromDetails },
          ...draft.stops.map((st) => ({ key: st.uid, label: addressById(st.addressId)?.label, details: st.details })),
          { key: "to", label: addresses.to?.label, details: draft.toDetails },
        ].map((p) => {
          const line = detailsSummary(p.details, t);
          return (
            <li key={p.key}>
              <span className="block text-control text-ink">{p.label}</span>
              {line && <span className="block text-sub text-ink/60">{line}</span>}
            </li>
          );
        })}
      </ol>
      <dl className="space-y-1 border-t border-hairline pt-2 text-sub">
        <SummaryRow
          label={t("order.seatsTitle")}
          value={
            passenger
              ? draft.mode === "car"
                ? t("order.wholeCar")
                : seatCountLabel(t, draft.seatIds.length, intlTag)
              : `${t("order.delivery")} · ${t(`cargo.vehicle.${draft.cargo.vehicle}` as TranslationKey)}`
          }
        />
        <SummaryRow label={t("when.title")} value={timingSummary(draft.timing, t, intlTag)} />
        {passenger && <SummaryRow label={t("class.title")} value={t(`class.${draft.carClass}` as TranslationKey)} />}
        {passenger && draft.optionIds.length > 0 && (
          <SummaryRow
            label={t("options.title")}
            value={optionList
              .filter((o) => draft.optionIds.includes(o.id))
              .map((o) => {
                const v = o.variants?.find((x) => x.id === draft.optionVariants[o.id]);
                return v ? `${t(o.titleKey as TranslationKey)} (${t(v.labelKey as TranslationKey)})` : t(o.titleKey as TranslationKey);
              })
              .join(", ")}
          />
        )}
        {passenger && luggage && <SummaryRow label={t("luggage.title")} value={draft.luggage > 0 ? t("luggage.count", { n: draft.luggage }) : t("luggage.none")} />}
        {passenger && draft.rider.kind === "other" && <SummaryRow label={t("rider.summary")} value={`${draft.rider.name.trim()}, +998 ${draft.rider.phone}`} />}
        {passenger && draft.comment.trim() && <SummaryRow label={t("comment.title")} value={draft.comment.trim()} />}
        {delivery && cr && (
          <>
            <SummaryRow label={t("kargo.summary.type")} value={t(cr.tabs.find((x) => x.id === tab)?.labelKey as TranslationKey)} />
            <SummaryRow
              label={t("kargo.mode.title")}
              value={mode === "hourly" ? `${t("kargo.mode.hourly")} · ${t("kargo.hours.value", { n: draft.cargo.hours ?? cr.hours.min })}` : t("kargo.mode.route")}
            />
            <SummaryRow label={t("kargo.loaders.title")} value={(draft.cargo.loaders ?? 0) > 0 ? String(draft.cargo.loaders) : t("kargo.loaders.none")} />
            <SummaryRow label={t("kargo.sender")} value={draft.sender.kind === "me" ? t("rider.me") : `${draft.sender.name.trim()}, +998 ${draft.sender.phone}`} />
            <SummaryRow label={t("kargo.receiver")} value={`${draft.receiver.name.trim()}, +998 ${draft.receiver.phone}`} />
            {draft.cargo.rideAlong && <SummaryRow label={t("kargo.rideAlong")} value={t("kargo.summary.yes")} />}
          </>
        )}
      </dl>
    </div>
  );

  const PayIcon = draft.paymentMethod === "card" ? CreditCard : Banknote;
  const payLabel = draft.paymentMethod === "card" ? t("order.card") : t("order.cash");

  // ── Kargo: stacked white cards on the dark backdrop ─────────────────────
  if (delivery) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col bg-backdrop" role="dialog" aria-modal="true" aria-label={t("cargo.title")}>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
          <div className="flex flex-col gap-[2px]">
            {/* Header card */}
            <div className="flex items-center gap-3 rounded-card bg-card px-4 py-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-on-yellow" aria-hidden="true">
                <Package className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-display font-bold text-ink">{t("cargo.title")}</span>
                <span className="block truncate text-sub text-ink/60">{addresses.from?.label}</span>
              </span>
              <CloseButton label={t("common.close")} onClick={() => setField("serviceType", "passenger")} />
            </div>

            {/* Tabs, body, loaders, info chips */}
            <div className="space-y-4 rounded-card bg-card px-4 pb-5 pt-2">
              {cr ? (
                <CargoTabs rules={cr} value={tab} onChange={(v) => setCargo({ tab: v })} />
              ) : cargoRules.status === "error" ? (
                <button onClick={cargoRules.refetch} className="inline-flex min-h-[44px] items-center text-sub font-semibold text-danger underline">
                  {t("common.loadFailedRetry")}
                </button>
              ) : (
                <Skeleton className="h-11 w-full" />
              )}
              <VehiclePicker
                value={draft.cargo}
                onChange={(v) => setField("cargo", v)}
                belowChips={cr && <LoadersControl rules={cr} value={draft.cargo.loaders ?? 0} onChange={(n) => setCargo({ loaders: n })} />}
              />
              {cr && <CargoInfoChips rules={cr} onOpen={setInfoTopic} />}
            </div>

            {/* Price calculation + addresses */}
            <div className="space-y-4 rounded-card bg-card px-4 pb-5 pt-5">
              {cr && (
                <PricingModeControl
                  rules={cr}
                  tab={tab}
                  mode={mode}
                  hours={Math.min(cr.hours.max, Math.max(cr.hours.min, draft.cargo.hours ?? cr.hours.min))}
                  onMode={(m) =>
                    // Switching to Soatbay starts within the adapter's bounds.
                    setCargo(m === "hourly" ? { pricingMode: m, hours: Math.min(cr.hours.max, Math.max(cr.hours.min, draftRef.current.cargo.hours ?? cr.hours.min)) } : { pricingMode: m })
                  }
                  onHours={(h) => setCargo({ hours: h })}
                />
              )}
              {routeBlock}
            </div>

            {/* Contacts */}
            <section aria-labelledby="cargo-contacts" className="space-y-4 rounded-card bg-card px-4 pb-5 pt-5">
              <h3 id="cargo-contacts" className="text-section font-bold text-ink">
                {t("kargo.contacts.title")}
              </h3>
              <RiderSection
                title={t("kargo.sender")}
                prefix="sender"
                note={null}
                value={draft.sender}
                onChange={(r) => setField("sender", r)}
                nameMaxLength={rules?.riderNameMaxLength}
                error={null}
                errors={{ name: fieldIssue("sender.name"), phone: fieldIssue("sender.phone") }}
                onBlurField={(f) => touch(`sender.${f}`)}
              />
              <div className="space-y-3">
                <p className="text-control font-semibold text-ink">{t("kargo.receiver")}</p>
                <ContactFields
                  prefix="receiver"
                  value={draft.receiver}
                  onChange={(v) => setField("receiver", v)}
                  nameMaxLength={rules?.riderNameMaxLength}
                  errors={{ name: fieldIssue("receiver.name"), phone: fieldIssue("receiver.phone") }}
                  onBlurField={(f) => touch(`receiver.${f}`)}
                />
                <ContactNote>{t("kargo.receiverNote")}</ContactNote>
              </div>
              <RideAlongRow
                state={rideAlongData}
                value={!!draft.cargo.rideAlong}
                onChange={(v) => setCargo({ rideAlong: v })}
                onRetry={rideAlong.status === "error" ? rideAlong.refetch : undefined}
              />
            </section>

            {/* Pickup time (radio rows) */}
            <div className="rounded-card bg-card px-4 pb-5 pt-5">
              <TimeSelector value={draft.timing} onChange={(timing) => setField("timing", timing)} />
            </div>
          </div>
        </div>

        {/* Bottom card: payment, adapter price, Tasdiqlash */}
        <div className="rounded-t-card bg-card px-2 pt-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 8px)" }}>
          <div className="flex min-h-[48px] items-center gap-3 px-2" aria-live="polite">
            <button type="button" onClick={() => setSheet("payment")} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={t("order.paymentFor", { m: payLabel })}>
              <PayIcon className="h-6 w-6 shrink-0 text-ink" />
              <span className="truncate text-control text-ink">{payLabel}</span>
            </button>
            {quote.status === "success" ? (
              <span className="shrink-0 text-display font-normal text-ink tabular">{formatSom(quote.data.total, intlTag)}</span>
            ) : quote.status === "error" ? (
              quoteError(quote.error, quote.refetch, "max-w-[62%] text-right")
            ) : (
              <Skeleton className="h-7 w-32" />
            )}
          </div>
          {cargoCheck && !cargoCheck.ready && (
            <p id="cargo-fill-hint" className="px-2 pb-2 text-sub font-semibold text-ink/70">
              {t("kargo.fillAll")}
            </p>
          )}
          <Button
            fullWidth
            disabled={!cargoCheck?.ready || quote.status !== "success"}
            aria-describedby={cargoCheck && !cargoCheck.ready ? "cargo-fill-hint" : undefined}
            onClick={() => setSheet("cargoSummary")}
          >
            {t("common.confirm")}
          </Button>
        </div>

        {renderOverlays()}
      </div>
    );
  }

  // ── Taxi: map + sheet + bottom bar ───────────────────────────────────────
  const point = (x: number, y: number) => ({
    // MapCanvas is "slice"-fitted: a 0–100 point lands at 50% + (p−50) of the
    // larger side (container query units).
    left: `calc(50% + (${x} - 50) * max(1cqw, 1cqh))`,
    top: `calc(50% + (${y} - 50) * max(1cqw, 1cqh))`,
  });
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={t("home.orderSheet")}>
      <div className="relative min-h-[120px] flex-1 [container-type:size]">
        <MapCanvas route className="absolute inset-0" />
        {quote.status === "success" && quote.data.arrivalAt && (
          <span
            className="absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-chip bg-card px-3 py-1 text-control font-medium text-ink shadow-[0_2px_10px_rgba(0,0,0,0.14)] tabular"
            style={point(ROUTE.to[0], ROUTE.to[1])}
          >
            {t("order.arrival", { time: formatTime(quote.data.arrivalAt) })}
          </span>
        )}
        {selectedClass?.etaMinutes != null && (
          <span
            className="absolute flex -translate-x-1/2 -translate-y-[calc(100%+8px)] flex-col items-center rounded-[13px] bg-brand-yellow px-2.5 py-1 text-center leading-tight text-on-yellow shadow-[0_2px_10px_rgba(0,0,0,0.14)]"
            style={point(ROUTE.from[0], ROUTE.from[1])}
          >
            <span className="text-lead font-bold tabular">{selectedClass.etaMinutes}</span>
            <span className="text-[11px]">{t("order.minutesShort")}</span>
          </span>
        )}
        <MapButton onClick={onClose} aria-label={t("order.back")} className="absolute bottom-8 left-3">
          <ArrowLeft className="h-5 w-5" />
        </MapButton>
      </div>

      <div className="relative -mt-5 flex max-h-[78%] flex-col rounded-t-sheet bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex justify-center pt-2" aria-hidden="true">
          <span className="h-[5px] w-9 rounded-full bg-ink/15" />
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-3 pt-1">
          {routeBlock}
          {serviceTabs}
          <CarClassPicker
            status={classes.status}
            classes={classes.status === "success" ? classes.data : lastClasses.current}
            value={draft.carClass}
            onChange={(id) => setField("carClass", id)}
            onRetry={classes.refetch}
            errorKey={classes.status === "error" ? ruleErrorKey(classes.error) : null}
          />
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip onClick={() => setSheet("seats")} selected={needSeats}>
              {draft.mode === "car" ? t("order.wholeCar") : draft.seatIds.length ? seatCountLabel(t, draft.seatIds.length, intlTag) : t("order.seatsHint")}
            </Chip>
            <Chip onClick={() => setSheet("options")}>{timingSummary(draft.timing, t, intlTag)}</Chip>
            <Chip onClick={() => setSheet("price")}>{t("order.priceDetails")}</Chip>
          </div>
          {quote.status === "error" && quoteError(quote.error, quote.refetch)}
        </div>

        {/* Bottom bar: payment · Buyurtma berish · options (radius 23, measured). */}
        <div className="rounded-t-[23px] border-t border-hairline bg-card px-2 pt-2" style={{ paddingBottom: "calc(var(--safe-bottom) + 8px)" }}>
          {(submitError || riderError?.field === "form") && (
            <p role="alert" className="px-2 pb-2 text-sub text-danger">
              {riderError?.field === "form" ? riderError.message : t("order.submitError")}
            </p>
          )}
          {needSeats && (
            <p id="seat-hint" className="px-2 pb-2 text-sub font-semibold text-ink/70">
              {t("order.seatsHint")}
            </p>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSheet("payment")}
              aria-label={t("order.paymentFor", { m: payLabel })}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-button text-ink hover:bg-ink/5"
            >
              <PayIcon className="h-7 w-7" />
            </button>
            <Button
              fullWidth
              loading={submitting || validating}
              disabled={quote.status !== "success" || needSeats}
              aria-describedby={needSeats ? "seat-hint" : undefined}
              onClick={submitTaxi}
            >
              {t("order.submit")}
            </Button>
            <button
              type="button"
              onClick={() => setSheet("options")}
              aria-label={t("order.settings")}
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-button text-ink hover:bg-ink/5"
            >
              <SlidersHorizontal className="h-6 w-6" />
              {draft.optionIds.length > 0 && (
                <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white tabular">
                  {draft.optionIds.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {renderOverlays()}
    </div>
  );

  function renderOverlays() {
    return (
      <>
        {sheet === "options" && (
          <Sheet open onClose={() => setSheet(null)} ariaLabel={t("order.settings")} floatingCloseLabel={t("common.close")}>
            <div className="space-y-6 px-4 pb-2 pt-1">
              {/* Title over a hairline; the close X floats above the sheet (photo 1). */}
              <h2 className="border-b border-hairline pb-3 pt-2 text-display font-bold text-ink">{t("order.settings")}</h2>
              <TimeSelector value={draft.timing} onChange={(timing) => setField("timing", timing)} />
              {options.status === "error" ? (
                <button onClick={options.refetch} className="inline-flex min-h-[44px] items-center text-sub font-semibold text-danger underline">
                  {t("common.loadFailedRetry")}
                </button>
              ) : (
                optionList.length > 0 && (
                  <IstaklarRow options={optionList} selected={draft.optionIds} variants={draft.optionVariants} onOpen={() => setIstaklarOpen(true)} />
                )
              )}
              <DriverComment
                value={draft.comment}
                onChange={(v) => setField("comment", v)}
                maxLength={rules?.commentMaxLength}
                serviceType={draft.serviceType}
                carClass={draft.carClass}
                options={optionList}
                selectedOptionIds={draft.optionIds}
                onApplyHint={(id) => {
                  const o = optionList.find((x) => x.id === id);
                  if (o?.available && !draftRef.current.optionIds.includes(id)) setOption(o, true);
                }}
              />
              {luggage && <LuggageStepper rules={luggage} value={Math.min(draft.luggage, luggage.max)} onChange={(n) => setField("luggage", n)} />}
              <RiderSection
                ref={riderRef}
                value={draft.rider}
                onChange={(r) => {
                  setField("rider", r);
                  setRiderError(null);
                }}
                nameMaxLength={rules?.riderNameMaxLength}
                error={riderError}
              />
              <section className="space-y-2">
                <h3 className="text-control font-semibold text-ink">{t("promo.title")}</h3>
                <PromoRow value={draft.promoCode} onChange={(code) => setField("promoCode", code)} />
              </section>
              <div className="sticky bottom-0 -mx-4 bg-card px-2 pt-2">
                <Button fullWidth onClick={() => setSheet(null)}>
                  {t("options.done")}
                </Button>
              </div>
            </div>
          </Sheet>
        )}

        {sheet === "seats" && (
          <Sheet open onClose={() => setSheet(null)} ariaLabel={t("order.seatsTitle")} floatingCloseLabel={t("common.close")}>
            <div className="space-y-4 px-4 pb-2 pt-1">
              {/* Title over a hairline; the close X floats above the sheet (photo 1). */}
              <h2 className="border-b border-hairline pb-3 pt-2 text-display font-bold text-ink">{t("order.seatsTitle")}</h2>
              <SeatMap
                seats={seats}
                mode={draft.mode}
                seatIds={draft.seatIds}
                onChange={(m, ids) => {
                  setField("mode", m);
                  setField("seatIds", ids);
                }}
                loadError={seatsError}
                onRetry={() => setSeatsReload((n) => n + 1)}
              />
              <div className="sticky bottom-0 -mx-4 bg-card px-2 pt-2">
                <Button fullWidth disabled={needSeats} onClick={() => setSheet(null)}>
                  {t("options.done")}
                </Button>
              </div>
            </div>
          </Sheet>
        )}

        {(sheet === "price" || sheet === "cargoSummary") && (
          <Sheet open onClose={() => setSheet(null)} ariaLabel={sheet === "price" ? t("order.priceDetails") : t("kargo.summaryTitle")} floatingCloseLabel={t("common.close")}>
            <div className="space-y-5 px-4 pb-2 pt-1">
              {/* Title over a hairline; the close X floats above the sheet (photo 1). */}
              <h2 className="border-b border-hairline pb-3 pt-2 text-display font-bold text-ink">
                  {sheet === "price" ? t("order.priceDetails") : t("kargo.summaryTitle")}
                </h2>
              {summaryBlock}
              {priceLines}
              {sheet === "cargoSummary" && (
                <>
                  <section className="space-y-2">
                    <h3 className="text-control font-semibold text-ink">{t("order.step.payment")}</h3>
                    <PaymentMethodSection value={draft.paymentMethod} onChange={(m) => setField("paymentMethod", m)} />
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-control font-semibold text-ink">{t("promo.title")}</h3>
                    <PromoRow value={draft.promoCode} onChange={(code) => setField("promoCode", code)} />
                  </section>
                  {submitError && (
                    <p role="alert" className="text-sub text-danger">
                      {t("order.submitError")}
                    </p>
                  )}
                  <div className="sticky bottom-0 -mx-4 bg-card px-2 pt-2">
                    <Button fullWidth loading={submitting} disabled={quote.status !== "success"} onClick={onSubmit}>
                      {t("order.submit")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Sheet>
        )}

        {sheet === "payment" && (
          <Sheet open onClose={() => setSheet(null)} ariaLabel={t("order.step.payment")} floatingCloseLabel={t("common.close")}>
            <div className="space-y-4 px-4 pb-2 pt-1">
              {/* Title over a hairline; the close X floats above the sheet (photo 1). */}
              <h2 className="border-b border-hairline pb-3 pt-2 text-display font-bold text-ink">{t("order.step.payment")}</h2>
              <PaymentMethodSection value={draft.paymentMethod} onChange={(m) => setField("paymentMethod", m)} />
              <div className="sticky bottom-0 -mx-4 bg-card px-2 pt-2">
                <Button fullWidth onClick={() => setSheet(null)}>
                  {t("options.done")}
                </Button>
              </div>
            </div>
          </Sheet>
        )}

        {picker && (
          <SearchScreen
            title={
              picker === "from"
                ? t("order.from")
                : picker === "to"
                ? t("order.to")
                : picker === "newStop"
                ? stopLabels?.add ?? t("stops.add")
                : (stopLabels?.item ?? ((n: number) => t("stops.label", { n })))(draft.stops.findIndex((st) => st.uid === picker.stop) + 1)
            }
            fromLabel={picker === "from" ? undefined : addresses.from?.label}
            fromAddressId={picker === "from" ? undefined : draft.fromAddressId}
            {...pickerScope(picker)}
            onClose={() => setPicker(null)}
            onSelect={(addr, entrance) => {
              pickAddress(picker, addr, entrance);
              setPicker(null);
            }}
          />
        )}

        {warehouseOpen && (
          <WarehouseSheet
            fromAddressId={draft.fromAddressId}
            onClose={() => setWarehouseOpen(false)}
            onSelect={(w) => {
              pickAddress("to", w.address);
              setWarehouseOpen(false);
            }}
          />
        )}
        {infoTopic && <CargoInfoSheet topic={infoTopic} onClose={() => setInfoTopic(null)} />}

        {istaklarOpen && (
          <IstaklarSheet
            options={optionList}
            selected={draft.optionIds}
            variants={draft.optionVariants}
            onToggle={(o) => setOption(o, !draftRef.current.optionIds.includes(o.id))}
            onVariant={(id, v) => setField("optionVariants", { ...draftRef.current.optionVariants, [id]: v })}
            onClose={() => setIstaklarOpen(false)}
          />
        )}

        {detailsFor && addressById(pointAddressId(detailsFor, draft)) && (
          <AddressDetailsSheet
            // Re-mount per point so the form starts from that point's details.
            key={typeof detailsFor === "string" ? detailsFor : detailsFor.stop}
            address={addressById(pointAddressId(detailsFor, draft))!}
            value={pointDetails(detailsFor)}
            rules={rules}
            onSave={(d) => setPointDetails(detailsFor, d)}
            onClose={() => setDetailsFor(null)}
          />
        )}
      </>
    );
  }
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink/60">{label}:</dt>
      <dd className="min-w-0 break-words text-ink">{value}</dd>
    </div>
  );
}
