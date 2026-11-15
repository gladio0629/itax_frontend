import { useEffect, useRef, useState } from "react";
import { Armchair, Car as CarIcon, ChevronRight, Package, X } from "@/lib/icons";
import { api } from "@/api/client";
import type { Address, AddressDetails, CarClass, OrderDetailsRules, OrderOption, OrderOptionId, Seat } from "@/api/types";
import { addressById } from "@/clientData/addresses";
import { newStopUid, type OrderDraft } from "@/stores/orderStore";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { useQuery } from "@/lib/useQuery";
import { cn } from "@/lib/cn";
import { SeatMap, seatCountLabel } from "./SeatMap";
import { VehiclePicker } from "./VehiclePicker";
import { AddressPickerSheet } from "./AddressPickerSheet";
import { TimeSelector } from "./TimeSelector";
import { PaymentMethodSection } from "./PaymentMethodSection";
import { timingSummary } from "./timingSummary";
import { RouteFields, type RouteTarget } from "./RouteFields";
import { AddressDetailsSheet } from "./AddressDetailsSheet";
import { DriverComment } from "./OrderExtras";
import { CarClassPicker } from "./CarClassPicker";
import { IstaklarRow, IstaklarSheet } from "./IstaklarSheet";
import { LuggageStepper, PromoRow, RiderSection, type RiderError } from "./TripDetails";
import { detailsSummary } from "./addressDetails";
import { useIsIOS } from "@/lib/platform";
import { Segmented } from "@/components/ios/Segmented";

const STEP_KEYS = ["order.step.route", "order.step.details", "order.step.summary"] as const;

function StepHeader({
  step,
  cargo,
  onClose,
}: {
  step: number;
  /** Dostavka details: the panel reads as "Kargo" with a cargo icon. */
  cargo: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div className="px-5 pb-1 pt-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-1.5">
          {STEP_KEYS.map((_, i) => (
            <span
              key={i}
              className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-brand-yellow" : "bg-border")}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/70">
            <X className="h-4 w-4" />
          </span>
        </button>
      </div>
      {cargo ? (
        <div className="mt-1 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-on-yellow">
            <Package className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{t("cargo.title")}</h2>
            <p className="text-xs font-semibold text-ink/60">{t(STEP_KEYS[step])}</p>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs font-semibold text-ink/60">{t(STEP_KEYS[step])}</p>
      )}
    </div>
  );
}

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
  onClose: () => void;
}) {
  const { t, intlTag } = useT();
  const ios = useIsIOS();
  const [step, setStepRaw] = useState(0);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");
  const bodyRef = useRef<HTMLDivElement>(null);
  function setStep(next: number) {
    setDirection(next > step ? "fwd" : "back");
    setStepRaw(next);
    bodyRef.current?.scrollTo({ top: 0 });
  }
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
   * address brings its own back from the adapter. */
  function pickAddress(which: RouteTarget | "newStop", addr: Address) {
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
    api
      .getSavedAddressDetails(addr.id)
      .then((saved) => {
        if (saved && pointAddressId(target) === addr.id) setPointDetails(target, saved);
      })
      .catch(() => {});
  }

  const stopsKey = draft.stops.map((st) => st.addressId).join("|");
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
    // Keyed on the vehicle, not the cargo object — typing a note mustn't
    // refetch; likewise the comment and Tafsilotlar never re-quote. Every
    // stop add/remove/reorder/change does.
    [step, draft.serviceType, draft.fromAddressId, draft.toAddressId, stopsKey, draft.mode, draft.seatIds, draft.cargo.vehicle, optionsKey, variantsKey, draft.carClass, draft.promoCode]
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

  /** Leaving the details step: the adapter checks "Kim ketadi?" while its
   * fields are still on screen. */
  async function nextFromDetails() {
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
          riderRef.current?.focus(field);
        } else setRiderError({ field: "form", message: t("common.errorMessage") });
        return;
      } finally {
        setValidating(false);
      }
    }
    setStep(2);
  }

  const canNext =
    step === 0
      ? canQuote
      : step === 1
      ? draft.serviceType === "delivery" || draft.mode === "car" || draft.seatIds.length > 0
      : true;

  // Dostavka's Panel 2 confirms the vehicle (price + Tasdiqlash) and moves on
  // to the summary — the same step change, not a separate action.
  const cargoConfirm = step === 1 && draft.serviceType === "delivery";

  return (
    <div className="flex h-full flex-col">
      <StepHeader step={step} cargo={step === 1 && draft.serviceType === "delivery"} onClose={onClose} />

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-3">
        <div key={step} className={direction === "fwd" ? "animate-step-fwd" : "animate-step-back"}>
        {step === 0 && (
          <>
            <RouteFields
              from={addresses.from}
              to={addresses.to}
              onPick={setPicker}
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
              maxStops={rules?.maxStops ?? null}
              onAddStop={() => setPicker("newStop")}
              onPickStop={(uid) => setPicker({ stop: uid })}
              onRemoveStop={(uid) => setField("stops", draftRef.current.stops.filter((st) => st.uid !== uid))}
              onReorderStops={(from, to) => {
                const next = [...draftRef.current.stops];
                const [moved] = next.splice(from, 1);
                next.splice(to, 0, moved);
                setField("stops", next);
              }}
            />
            {canQuote && (
              <div className="mt-3 flex min-h-[44px] items-center justify-between gap-3 px-1" aria-live="polite">
                <span className="text-sm text-ink/60">{t("order.priceEstimate")}</span>
                {quote.status === "success" ? (
                  <span className="text-base font-semibold text-ink tabular">{formatSom(quote.data.total, intlTag)}</span>
                ) : quote.status === "error" ? (
                  <button onClick={quote.refetch} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
                    {t("order.quoteError")}
                  </button>
                ) : (
                  <Skeleton className="h-5 w-24" />
                )}
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {ios ? (
              <Segmented
                ariaLabel={t("order.step.details")}
                value={draft.serviceType}
                onChange={(v) => {
                  setField("serviceType", v);
                  setField("optionIds", []);
                }}
                options={[
                  { id: "passenger", label: t("order.passenger"), icon: Armchair },
                  { id: "delivery", label: t("order.delivery"), icon: CarIcon },
                ]}
              />
            ) : (
            <div className="grid grid-cols-2 gap-2">
              <SegmentButton
                selected={draft.serviceType === "passenger"}
                icon={Armchair}
                label={t("order.passenger")}
                onClick={() => {
                  setField("serviceType", "passenger");
                  setField("optionIds", []);
                }}
              />
              <SegmentButton
                selected={draft.serviceType === "delivery"}
                icon={CarIcon}
                label={t("order.delivery")}
                onClick={() => {
                  setField("serviceType", "delivery");
                  setField("optionIds", []);
                }}
              />
            </div>
            )}

            {draft.serviceType === "passenger" ? (
              <>
                <CarClassPicker
                  status={classes.status}
                  classes={classes.status === "success" ? classes.data : lastClasses.current}
                  value={draft.carClass}
                  onChange={(id) => setField("carClass", id)}
                  onRetry={classes.refetch}
                />
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
              </>
            ) : (
              <VehiclePicker value={draft.cargo} onChange={(v) => setField("cargo", v)} />
            )}

            <TimeSelector value={draft.timing} onChange={(timing) => setField("timing", timing)} />

            {passenger && luggage && (
              <LuggageStepper rules={luggage} value={Math.min(draft.luggage, luggage.max)} onChange={(n) => setField("luggage", n)} />
            )}

            {passenger && (
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
            )}

            {/* Dostavka has its own "Izoh" on the vehicle picker. */}
            {passenger && (
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
            )}

            {options.status === "error" ? (
              <button onClick={options.refetch} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
                {t("common.loadFailedRetry")}
              </button>
            ) : (
              optionList.length > 0 && (
                <IstaklarRow options={optionList} selected={draft.optionIds} variants={draft.optionVariants} onOpen={() => setIstaklarOpen(true)} />
              )
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-accent-5 p-4">
              <p className="text-xs font-semibold text-ink/60">{t("order.route")}</p>
              <ol className="mt-1.5 space-y-1.5">
                {[
                  { key: "from", label: addresses.from?.label, details: draft.fromDetails, dot: "bg-ink" },
                  ...draft.stops.map((st) => ({
                    key: st.uid,
                    label: addressById(st.addressId)?.label,
                    details: st.details,
                    dot: "border-2 border-ink/50 bg-card",
                  })),
                  { key: "to", label: addresses.to?.label, details: draft.toDetails, dot: "bg-brand-yellow ring-1 ring-on-yellow/40" },
                ].map((p) => {
                  const line = detailsSummary(p.details, t);
                  return (
                    <li key={p.key} className="flex gap-2.5">
                      <span className={cn("mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full", p.dot)} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{p.label}</span>
                        {line && <span className="block text-xs text-ink/60">{line}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 flex items-center justify-between text-xs text-ink/60">
                <span>
                  {draft.serviceType === "passenger"
                    ? draft.mode === "car"
                      ? t("order.wholeCar")
                      : seatCountLabel(t, draft.seatIds.length, intlTag)
                    : `${t("order.delivery")} · ${t(`cargo.vehicle.${draft.cargo.vehicle}` as TranslationKey)}`}
                </span>
                <span className="tabular">{timingSummary(draft.timing, t, intlTag)}</span>
              </div>
              {passenger && (
                <dl className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
                  <SummaryRow
                    label={t("class.title")}
                    value={t(`class.${draft.carClass}` as TranslationKey)}
                  />
                  {draft.optionIds.length > 0 && (
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
                  {luggage && (
                    <SummaryRow
                      label={t("luggage.title")}
                      value={draft.luggage > 0 ? t("luggage.count", { n: draft.luggage }) : t("luggage.none")}
                    />
                  )}
                  {draft.rider.kind === "other" && (
                    <SummaryRow label={t("rider.summary")} value={`${draft.rider.name.trim()}, +998 ${draft.rider.phone}`} />
                  )}
                </dl>
              )}
              {draft.serviceType === "passenger" && draft.comment.trim() && (
                <p className="mt-2 border-t border-border pt-2 text-xs text-ink/60">
                  <span className="font-semibold">{t("comment.title")}:</span>{" "}
                  <span className="break-words text-ink">{draft.comment.trim()}</span>
                </p>
              )}
            </div>

            {quote.status === "loading" && (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            )}
            {quote.status === "error" && (
              <button onClick={quote.refetch} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
                {t("order.quoteError")}
              </button>
            )}
            {quote.status === "success" && (
              <div className="space-y-2">
                {quote.data.lines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 text-ink/60">{t(line.key as TranslationKey, line.params)}</span>
                    <span className="shrink-0 tabular font-normal text-ink">{formatSom(line.amount, intlTag)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span className="text-ink">{t("order.total")}</span>
                  <span className="tabular text-ink">{formatSom(quote.data.total, intlTag)}</span>
                </div>
              </div>
            )}

            <p className="pt-1 text-sm font-semibold text-ink">{t("order.step.payment")}</p>
            <PaymentMethodSection value={draft.paymentMethod} onChange={(m) => setField("paymentMethod", m)} />

            <p className="pt-1 text-sm font-semibold text-ink">{t("promo.title")}</p>
            <PromoRow value={draft.promoCode} onChange={(code) => setField("promoCode", code)} />
          </div>
        )}
        </div>
      </div>

      <div className="border-t border-border px-5 py-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}>
        {cargoConfirm && (
          <div className="mb-3 flex min-h-[28px] items-center justify-between gap-3" aria-live="polite">
            <span className="text-sm text-ink/60">{t("cargo.price")}</span>
            {quote.status === "success" ? (
              <span className="text-lg font-bold text-ink tabular">{formatSom(quote.data.total, intlTag)}</span>
            ) : quote.status === "error" ? (
              <button onClick={quote.refetch} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
                {t("order.quoteError")}
              </button>
            ) : (
              <Skeleton className="h-6 w-28" />
            )}
          </div>
        )}
        {submitError && (
          <p role="alert" aria-live="polite" className="mb-2 text-xs font-normal text-danger">
            {t("order.submitError")}
          </p>
        )}
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              {t("common.back")}
            </Button>
          )}
          {cargoConfirm ? (
            <Button fullWidth disabled={!canNext} onClick={() => setStep(2)}>
              {t("common.confirm")}
            </Button>
          ) : step < 2 ? (
            <Button fullWidth disabled={!canNext} loading={validating} onClick={() => (step === 1 ? nextFromDetails() : setStep(step + 1))}>
              {t("order.next")} <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button fullWidth loading={submitting} disabled={quote.status !== "success"} onClick={onSubmit}>
              {t("order.submit")}
            </Button>
          )}
        </div>
      </div>

      {picker && (
        <AddressPickerSheet
          title={
            picker === "from"
              ? t("order.from")
              : picker === "to"
              ? t("order.to")
              : picker === "newStop"
              ? t("stops.add")
              : t("stops.label", { n: draft.stops.findIndex((st) => st.uid === picker.stop) + 1 })
          }
          // A stop can be anywhere, including the pickup or drop-off city.
          excludeCityId={picker === "from" ? addresses.to?.cityId : picker === "to" ? addresses.from?.cityId : undefined}
          onClose={() => setPicker(null)}
          onSelect={(addr) => {
            pickAddress(picker, addr);
            setPicker(null);
          }}
        />
      )}

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

    </div>
  );
}

function SegmentButton({
  selected,
  icon: Icon,
  label,
  onClick,
}: {
  selected: boolean;
  icon: typeof CarIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 text-sm font-semibold transition-colors",
        selected ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink/60">{label}:</dt>
      <dd className="min-w-0 break-words text-ink">{value}</dd>
    </div>
  );
}
