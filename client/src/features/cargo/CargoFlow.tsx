import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { Address, AddressDetails, CargoInfoTopic, CargoInput, CargoRules, DeliveryVehicleSpec, OrderDetailsRules, Profile, Quote, RideAlong, SchedulingRules } from "@/api/types";
import { newStopUid, type OrderDraft } from "@/stores/orderStore";
import { useQuery } from "@/lib/useQuery";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { ruleErrorKey } from "@/lib/apiError";
import { formatSom } from "@/lib/format";
import { BottomSheet, PrimaryButton, Screen, StateError, StateLoading, Steps, TextButton } from "@/ui";
import { AddressFlow } from "@/features/address/AddressFlow";
import { AddressDetailsScreen } from "@/features/address/AddressDetailsScreen";
import { detailsSummary } from "@/features/order/addressDetails";
import { PaymentScreen } from "@/features/trip/PaymentScreen";
import { TimeScreen } from "@/features/trip/TimeScreen";
import type { QuoteRenewal } from "@/features/home/HomeScreen";
import { CargoRouteCard, CargoScreen, type DropRef } from "./CargoScreen";
import { CargoContactsScreen, type ContactIssues } from "./CargoContactsScreen";
import { CargoTermsScreen } from "./CargoTermsScreen";
import { CargoInfoSheet, WarehouseSheet } from "./CargoSheets";

const caps = api.capabilities;
type Step = "cargo" | "contacts" | "terms" | "payment";
type Point = "from" | DropRef | "new";

function encodePoint(p: Point): string {
  if (p === "from" || p === "new") return p;
  return p.kind === "to" ? "to" : `stop:${p.uid}`;
}
function decodePoint(s: string): Point | null {
  if (s === "from" || s === "new") return s;
  if (s === "to") return { kind: "to" };
  if (s.startsWith("stop:")) return { kind: "stop", uid: s.slice(5) };
  return null;
}

type Sheet =
  | { kind: "pick"; point: Point }
  | { kind: "warehouse"; point: Point }
  | { kind: "details"; point: "from" | DropRef }
  | { kind: "info"; topic: CargoInfoTopic }
  | { kind: "time" }
  | null;

function decodeSheet(s: string | null): Sheet {
  if (!s) return null;
  if (s === "time") return { kind: "time" };
  const i = s.indexOf(":");
  const kind = s.slice(0, i);
  const rest = s.slice(i + 1);
  if (kind === "info") return { kind: "info", topic: rest as CargoInfoTopic };
  const p = decodePoint(rest);
  if (!p) return null;
  if (kind === "pick") return { kind: "pick", point: p };
  if (kind === "warehouse") return { kind: "warehouse", point: p };
  if (kind === "details" && p !== "new") return { kind: "details", point: p };
  return null;
}
function encodeSheet(s: NonNullable<Sheet>): string {
  if (s.kind === "time") return "time";
  if (s.kind === "info") return `info:${s.topic}`;
  return `${s.kind}:${encodePoint(s.point)}`;
}

/** Keep the last good value while re-loading (no flicker). */
function settle<T>(q: { status: string; data?: T }, last: { current: T | null }) {
  if (q.status === "success") last.current = q.data as T;
  if (q.status === "error") return { status: "error" as const };
  if (last.current != null) return { status: "success" as const, data: last.current };
  return { status: "loading" as const };
}

/**
 * Delivery order, design v2: Yuk → Kontakt → Shartlar → To'lov (with the
 * backend's cargo extras; without them Yuk → To'lov). Steps and sheets live
 * in the URL (?step=…&sheet=…), so back — the Android button too — closes
 * the open sheet first, then steps back.
 */
export function CargoFlow({
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
  const location = useLocation();
  const navigate = useNavigate();
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const steps: Step[] = caps.cargoExtras ? ["cargo", "contacts", "terms", "payment"] : ["cargo", "payment"];
  const stepParam = params.get("step") as Step | null;
  const step: Step = stepParam && steps.includes(stepParam) ? stepParam : "cargo";
  const stepIndex = steps.indexOf(step);
  const stepNames = steps.map((s) => t(`cargo.v2.step.${s}` as TranslationKey));
  const sheet = decodeSheet(params.get("sheet"));
  const pushed = (location.state as { pushed?: boolean } | null)?.pushed;

  /** Steps and sheets push a history entry; back pops it. */
  function go(patch: { step?: Step; sheet?: string | null }, replace = false) {
    const next = new URLSearchParams(params);
    if (patch.step !== undefined) {
      if (patch.step === "cargo") next.delete("step");
      else next.set("step", patch.step);
    }
    if (patch.sheet !== undefined) {
      if (patch.sheet) next.set("sheet", patch.sheet);
      else next.delete("sheet");
    }
    setParams(next, replace ? { replace: true, state: location.state } : { state: { pushed: true } });
  }
  function back() {
    if (pushed) navigate(-1);
    else if (sheet) go({ sheet: null }, true);
    else if (stepIndex > 0) go({ step: steps[stepIndex - 1] }, true);
    else onClose();
  }
  const openSheet = (s: NonNullable<Sheet>, replace = false) => go({ sheet: encodeSheet(s) }, replace);
  const closeSheet = () => (pushed && sheet ? navigate(-1) : go({ sheet: null }, true));

  // ── Data ───────────────────────────────────────────────────────────────
  const rulesQ = useQuery<CargoRules | null>(() => (caps.cargoExtras ? api.getCargoRules() : Promise.resolve(null)), []);
  const rules = rulesQ.status === "success" ? rulesQ.data : null;
  const detailRules = useQuery<OrderDetailsRules | null>(() => api.getOrderDetailsRules().catch(() => null), []);
  const scheduling = useQuery<SchedulingRules>(() => api.getSchedulingRules(), []);
  const vehicles = useQuery<DeliveryVehicleSpec[]>(() => api.getDeliveryVehicles(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  const tab = draft.cargo.tab ?? rules?.defaultTab ?? "intercity";
  const setCargo = (patch: Partial<CargoInput>) => setField("cargo", { ...draftRef.current.cargo, ...patch });

  // A tab without "Soatbay" falls back to "Marshrut bo'yicha".
  useEffect(() => {
    if (!rules) return;
    const m = rules.pricingModes[tab].find((x) => x.id === (draftRef.current.cargo.pricingMode ?? "route"));
    if (!m?.available) setCargo({ pricingMode: "route", hours: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, tab]);

  const rideAlong = useQuery<RideAlong | null>(
    () => (caps.cargoExtras ? api.getRideAlong({ vehicle: draft.cargo.vehicle, loaders: draft.cargo.loaders ?? 0 }) : Promise.resolve(null)),
    [draft.cargo.vehicle, draft.cargo.loaders]
  );
  const rideData = rideAlong.status === "success" ? rideAlong.data : null;
  useEffect(() => {
    if (rideData && !rideData.available && draftRef.current.cargo.rideAlong) setCargo({ rideAlong: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideData]);

  const canQuote = !!draft.fromAddressId && !!draft.toAddressId;
  const stopsKey = draft.stops.map((s) => s.addressId).join("|");
  // Typing the note mustn't re-price.
  const cargoKey = JSON.stringify({ ...draft.cargo, note: undefined });
  const timingKey = JSON.stringify(draft.timing);
  const quote = useQuery<Quote>(
    () =>
      canQuote
        ? api.getQuote({
            serviceType: "delivery",
            fromAddressId: draft.fromAddressId,
            toAddressId: draft.toAddressId,
            stops: draft.stops.map((s) => s.addressId),
            mode: draft.mode,
            seatIds: [],
            cargo: draft.cargo,
            promoCode: draft.promoCode || undefined,
            timing: draft.timing,
          })
        : new Promise<never>(() => {}),
    [canQuote, draft.fromAddressId, draft.toAddressId, stopsKey, cargoKey, draft.promoCode, timingKey]
  );
  useEffect(() => {
    if (quoteRenewal) quote.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteRenewal]);
  const lastQuote = useRef<Quote | null>(null);
  const lastVehicles = useRef<DeliveryVehicleSpec[] | null>(null);
  const quoteView = settle(quote as { status: string; data?: Quote }, lastQuote);
  const vehiclesView = settle(vehicles as { status: string; data?: DeliveryVehicleSpec[] }, lastVehicles);
  const quoteRuleKey = quote.status === "error" ? ruleErrorKey(quote.error) : null;
  const quoteError = quoteRuleKey ? t(quoteRuleKey as TranslationKey) : null;

  // ── Route points ───────────────────────────────────────────────────────
  const drops = [
    ...draft.stops.map((s) => ({ ref: { kind: "stop", uid: s.uid } as DropRef, address: api.addressById(s.addressId) ?? null, details: s.details })),
    { ref: { kind: "to" } as DropRef, address: addresses.to, details: draft.toDetails },
  ];
  const maxExtra = rules ? rules.maxExtraDropoffs[tab] : caps.stops ? null : 0;

  function detailsOf(p: "from" | DropRef): AddressDetails {
    const d = draftRef.current;
    if (p === "from") return d.fromDetails;
    if (p.kind === "to") return d.toDetails;
    return d.stops.find((s) => s.uid === p.uid)?.details ?? {};
  }
  function addressIdOf(p: "from" | DropRef): string {
    const d = draftRef.current;
    if (p === "from") return d.fromAddressId;
    if (p.kind === "to") return d.toAddressId;
    return d.stops.find((s) => s.uid === p.uid)?.addressId ?? "";
  }
  function setDetails(p: "from" | DropRef, details: AddressDetails) {
    if (p === "from") setField("fromDetails", details);
    else if (p.kind === "to") setField("toDetails", details);
    else setField("stops", draftRef.current.stops.map((s) => (s.uid === p.uid ? { ...s, details } : s)));
  }
  /** A new point starts clean (details from the map kept, a saved place brings its own). */
  function place(point: Point, addr: Address, entrance?: string, entered?: AddressDetails) {
    const d = draftRef.current;
    let target: "from" | DropRef;
    if (point === "new") {
      // A new drop-off goes last: the current last one becomes an extra stop.
      setField("stops", [...d.stops, { uid: newStopUid(), addressId: d.toAddressId, details: d.toDetails }]);
      onAddressChange("to", addr);
      setField("toDetails", {});
      target = { kind: "to" };
    } else if (point === "from" || point.kind === "to") {
      onAddressChange(point === "from" ? "from" : "to", addr);
      setField(point === "from" ? "fromDetails" : "toDetails", {});
      target = point;
    } else {
      setField("stops", d.stops.map((s) => (s.uid === point.uid ? { ...s, addressId: addr.id, details: {} } : s)));
      target = point;
    }
    if (!caps.addressDetails) return;
    const fromSearch: AddressDetails = entrance ? { entrance } : {};
    if (entered) return setDetails(target, { ...entered, ...fromSearch });
    if (entrance) setDetails(target, fromSearch);
    api
      .getSavedAddressDetails(addr.id)
      .then((saved) => {
        if (saved && addressIdOf(target) === addr.id) setDetails(target, { ...saved, ...fromSearch });
      })
      .catch(() => {});
  }
  function removeDrop(ref: DropRef) {
    const d = draftRef.current;
    if (ref.kind === "stop") return setField("stops", d.stops.filter((s) => s.uid !== ref.uid));
    const last = d.stops[d.stops.length - 1];
    if (!last) return;
    setField("stops", d.stops.slice(0, -1));
    setField("toAddressId", last.addressId);
    setField("toDetails", last.details);
  }
  /** Reverse the route: the pickup becomes the last drop-off (stops reversed). */
  function swapRoute() {
    const d = draftRef.current;
    if (!d.toAddressId) return;
    const f = d.fromAddressId;
    const fd = d.fromDetails;
    setField("fromAddressId", d.toAddressId);
    setField("fromDetails", d.toDetails);
    setField("toAddressId", f);
    setField("toDetails", fd);
    setField("stops", [...d.stops].reverse());
  }
  /** Drop-offs in a new order; the one that ends last becomes "Qayerga". */
  function reorderDrops(fromIndex: number, to: number) {
    const d = draftRef.current;
    const list = [...d.stops, { uid: newStopUid(), addressId: d.toAddressId, details: d.toDetails }];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(to, 0, moved);
    const last = list.pop()!;
    setField("stops", list);
    setField("toAddressId", last.addressId);
    setField("toDetails", last.details ?? {});
  }
  /** Where the search may look: the scope decides. */
  function scope(point: Point): { excludeCityId?: string; onlyCityId?: string } {
    const fromCity = addresses.from?.cityId;
    if (point === "from" || !caps.cargoExtras) return {};
    if (tab === "city") return { onlyCityId: fromCity };
    if (tab === "intercity" && (point === "new" || point.kind === "to")) return { excludeCityId: fromCity };
    return {};
  }
  function pickDrop(point: Point) {
    // "Marketpleys": the last drop-off is a warehouse from the server's list.
    const last = point === "new" || (point !== "from" && point.kind === "to");
    if (caps.cargoExtras && tab === "marketplace" && last) openSheet({ kind: "warehouse", point });
    else openSheet({ kind: "pick", point });
  }

  // No drop-off yet: open its picker right away.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || sheet) return;
    autoOpened.current = true;
    if (!addresses.to) pickDropAuto();
    else if (!addresses.from) openSheet({ kind: "pick", point: "from" }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function pickDropAuto() {
    if (caps.cargoExtras && tab === "marketplace") openSheet({ kind: "warehouse", point: { kind: "to" } }, true);
    else openSheet({ kind: "pick", point: { kind: "to" } }, true);
  }

  // ── Contacts step: the adapter checks the people ───────────────────────
  const [issues, setIssues] = useState<ContactIssues>({});
  const [checking, setChecking] = useState(false);
  async function contactsNext() {
    setChecking(true);
    setIssues({});
    try {
      const d = draftRef.current;
      const res = await api.checkCargo({
        fromAddressId: d.fromAddressId,
        toAddressId: d.toAddressId,
        stops: d.stops.map((s) => s.addressId),
        cargo: d.cargo,
        sender: d.sender,
        receiver: d.receiver,
      });
      const found: ContactIssues = {};
      for (const i of res.issues) if (/^(sender|receiver)\.(name|phone)$/.test(i.field)) found[i.field as keyof ContactIssues] = t(i.messageKey as TranslationKey);
      if (Object.keys(found).length) setIssues(found);
      else go({ step: steps[stepIndex + 1] });
    } catch {
      setIssues({ "receiver.name": t("common.errorMessage") });
    } finally {
      setChecking(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const route = (
    <CargoRouteCard
      draft={draft}
      from={addresses.from}
      drops={drops}
      maxExtra={maxExtra}
      onPickFrom={() => openSheet({ kind: "pick", point: "from" })}
      onPickDrop={pickDrop}
      onAddDrop={() => pickDrop("new")}
      onRemoveDrop={removeDrop}
      onSwap={tab === "marketplace" ? undefined : swapRoute}
      onReorder={caps.stops ? reorderDrops : undefined}
      lockLast={tab === "marketplace"}
      onDetails={caps.addressDetails ? (p) => openSheet({ kind: "details", point: p }) : undefined}
    />
  );

  function renderStep() {
    if (step === "contacts")
      return (
        <CargoContactsScreen
          stepNames={stepNames}
          current={stepIndex}
          profile={profile}
          sender={draft.sender}
          receiver={draft.receiver}
          note={draft.cargo.note ?? ""}
          issues={issues}
          checking={checking}
          onSender={(r) => {
            setField("sender", r);
            setIssues({});
          }}
          onReceiver={(c) => {
            setField("receiver", c);
            setIssues({});
          }}
          onNote={(note) => setCargo({ note })}
          onReceiverDetails={caps.addressDetails && draft.toAddressId ? () => openSheet({ kind: "details", point: { kind: "to" } }) : undefined}
          receiverDetailsSummary={detailsSummary(draft.toDetails, t)}
          onNext={contactsNext}
          onBack={back}
        />
      );
    // Rules didn't load: say so and retry, never fall back to another step.
    if (step === "terms" && !rules)
      return (
        <Screen title={t("cargo.v2.step.terms")} onBack={back} top={<Steps steps={stepNames} current={stepIndex} label={t("trip.steps")} />}>
          {rulesQ.status === "error" ? <StateError onRetry={rulesQ.refetch} /> : <StateLoading rows={3} />}
        </Screen>
      );
    if (step === "terms" && rules)
      return (
        <CargoTermsScreen
          stepNames={stepNames}
          current={stepIndex}
          rules={rules}
          cargo={draft.cargo}
          rideAlong={rideData}
          rideAlongError={rideAlong.status === "error"}
          onRetryRideAlong={rideAlong.refetch}
          quote={quoteView}
          quoteReady={quote.status === "success"}
          quoteError={quoteError}
          onRetryQuote={quote.refetch}
          onCargo={setCargo}
          onInfo={(topic) => openSheet({ kind: "info", topic })}
          onNext={() => go({ step: "payment" })}
          onBack={back}
        />
      );
    if (step === "payment")
      return (
        <PaymentScreen
          quote={quoteView}
          quoteReady={quote.status === "success"}
          onRetryQuote={quote.refetch}
          timing={draft.timing}
          method={draft.paymentMethod}
          promoCode={draft.promoCode}
          onMethod={(m) => setField("paymentMethod", m)}
          onPromo={(c) => setField("promoCode", c)}
          onTime={() => openSheet({ kind: "time" })}
          onSubmit={onSubmit}
          submitting={submitting}
          submitError={submitError}
          onBack={back}
          steps={{ names: stepNames, current: stepIndex }}
        />
      );
    return (
      <CargoScreen
        draft={draft}
        stepNames={stepNames}
        current={stepIndex}
        rules={rules}
        rulesError={rulesQ.status === "error"}
        onRetryRules={rulesQ.refetch}
        vehicles={vehiclesView}
        route={route}
        quote={quoteView}
        quoteReady={quote.status === "success"}
        quoteError={quoteError}
        onRetryQuote={quote.refetch}
        onRetryVehicles={vehicles.refetch}
        onTab={(v) => setCargo({ tab: v })}
        onVehicle={(v) => setCargo({ vehicle: v })}
        onNote={(note) => setCargo({ note })}
        showNote={!caps.cargoExtras}
        onInfo={rules ? (topic) => openSheet({ kind: "info", topic }) : undefined}
        onNext={() => go({ step: steps[1] })}
        onBack={back}
      />
    );
  }

  function renderSheet() {
    if (!sheet) return null;
    if (sheet.kind === "info") return <CargoInfoSheet topic={sheet.topic} onClose={closeSheet} />;
    if (sheet.kind === "warehouse") {
      const point = sheet.point;
      return (
        <WarehouseSheet
          fromAddressId={draft.fromAddressId}
          onClose={closeSheet}
          onSelect={(w) => {
            place(point, w.address);
            closeSheet();
          }}
        />
      );
    }
    if (sheet.kind === "pick") {
      const point = sheet.point;
      const dropIndex = point === "new" ? drops.length : point === "from" ? -1 : drops.findIndex((d) => (d.ref.kind === "to" ? point.kind === "to" : point.kind === "stop" && d.ref.uid === point.uid));
      return (
        <AddressFlow
          target={point === "from" ? "from" : point === "new" || point.kind === "stop" ? "stop" : "to"}
          title={point === "from" ? t("cargo.v2.pickup") : t("cargo.v2.drop", { n: dropIndex + 1 })}
          fromLabel={addresses.from?.label}
          toLabel={addresses.to?.label}
          fromAddressId={point === "from" ? undefined : draft.fromAddressId}
          rules={detailRules.status === "success" ? detailRules.data : null}
          {...scope(point)}
          onClose={closeSheet}
          onDone={(addr, entrance, details) => {
            place(point, addr, entrance, details);
            closeSheet();
          }}
        />
      );
    }
    if (sheet.kind === "details") {
      const point = sheet.point;
      const addr = api.addressById(addressIdOf(point));
      if (!addr) return null;
      return (
        <AddressDetailsScreen
          address={addr}
          value={detailsOf(point)}
          rules={detailRules.status === "success" ? detailRules.data : null}
          mode="point"
          onClose={closeSheet}
          onDone={(d) => {
            setDetails(point, d);
            closeSheet();
          }}
        />
      );
    }
    if (sheet.kind === "time") {
      if (scheduling.status !== "success")
        return (
          <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("time.title")}>
            <Screen title={t("time.title")} onBack={closeSheet}>
              {scheduling.status === "error" ? <StateError onRetry={scheduling.refetch} /> : <StateLoading rows={2} />}
            </Screen>
          </div>
        );
      return (
        <TimeScreen
          value={draft.timing}
          rules={scheduling.data}
          onBack={closeSheet}
          onDone={(timing) => {
            setField("timing", timing);
            closeSheet();
          }}
        />
      );
    }
    return null;
  }

  return (
    <div className="relative h-full">
      {renderStep()}
      {renderSheet()}
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
