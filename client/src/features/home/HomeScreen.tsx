import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { Address, AddressDetails, OrderWithDetails, Profile, RouteSuggestion, SavedAddressInfo } from "@/api/types";
import { MapCanvas } from "@/components/MapCanvas";
import { LiveMap, LIVE_MAP } from "@/components/LiveMap";
import { useGeolocation } from "@shared/map/useGeolocation";
import type { MapMarker } from "@shared/map/MapView";
import { addressPoint } from "@/features/order/mapPoints";
import { LowConnectionBanner } from "@/components/LowConnectionBanner";
import { setDefaultFromAddress, useOrderStore } from "@/stores/orderStore";
import { useFloatingControl } from "@/stores/floatingControlStore";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { CargoFlow } from "@/features/cargo/CargoFlow";
import { Toast } from "@/components/Toast";
import { AddressFlow } from "@/features/address/AddressFlow";
import { PassengerFlow } from "@/features/trip/PassengerFlow";
import { isApiError } from "@shared/http/errors";
import { ruleErrorKey, serverErrorKey } from "@/lib/apiError";
import { HomeSheet, PickupPin, HomeTopBar } from "./HomeView";
import { rememberHomeBase } from "@/lib/homeBase";
import { Icon } from "@/ui";


// Where new drafts start: the adapter's default pickup (sample data:
// Toshkent; real backend: none until the passenger picks or locates one).
setDefaultFromAddress(api.defaultPickupId());

/** The quoted price couldn't be used: the server's new total, awaiting a yes. */
export type QuoteRenewal = { messageKey: string; total: number };

const QUOTE_ERRORS = new Set(["QUOTE_NOT_FOUND", "QUOTE_EXPIRED", "QUOTE_ALREADY_USED", "QUOTE_MISMATCH"]);

/**
 * Home (reference structure): full-screen map, the pickup caption at the top,
 * a pin bubble with the pickup ETA, round map buttons, and a sheet with the
 * IZGO mark, "Taksi", the search pill and saved addresses as list rows.
 *
 * The flow lives in the URL (?flow=search|route), so back, Escape and the
 * browser's swipe-back step search → home and route → home without leaving
 * the order; the draft itself is in the store.
 */
export default function OrderingHome() {
  const navigate = useNavigate();
  const { t } = useT();
  const { draft, setField, reset } = useOrderStore();
  const [params, setParams] = useSearchParams();
  const flow = params.get("flow");
  const targetParam = params.get("target");
  const searchTarget: "from" | "to" | "save" = targetParam === "from" || targetParam === "save" ? targetParam : "to";
  /** A recent route narrows the drop-off search to its city. */
  const searchCity = params.get("city") ?? undefined;
  /** Open the point picker on the map (Home "+", design: MapPick). */
  const searchOnMap = params.get("map") === "1";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cityNames, setCityNames] = useState<Record<string, string>>({});
  const [recent, setRecent] = useState<RouteSuggestion[]>([]);
  const [recentLoading, setRecentLoading] = useState(api.capabilities.recentRoutes);
  const [recentError, setRecentError] = useState(false);
  const [recentReload, setRecentReload] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedAddressInfo[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(false);
  const [savedReload, setSavedReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  /** Translation key of the last submit failure. */
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** The quoted price couldn't be used: the new one, awaiting confirmation. */
  const [renewal, setRenewal] = useState<QuoteRenewal | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [panelH, setPanelH] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const setFabPlacement = useFloatingControl((s) => s.setFabPlacement);

  const fromAddress = api.addressById(draft.fromAddressId) ?? null;
  const toAddress = api.addressById(draft.toAddressId) ?? null;
  // The map: the passenger's own position (GPS; the sample data's mock
  // coordinates) and the pickup, which the camera centres on.
  const me = useGeolocation({ enabled: LIVE_MAP, simulated: api.simulatedPosition() });
  const pickupPoint = addressPoint(fromAddress);
  /** Bumped by "where am I": brings the camera back to the pickup. */
  const [recentre, setRecentre] = useState(0);
  // A route needs a drop-off; a stale ?flow=route falls back to home.
  const view = flow === "search" ? "search" : flow === "route" && toAddress ? "route" : "home";

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile(null));
    api
      .getCities()
      .then((cs) => setCityNames(Object.fromEntries(cs.map((c) => [c.id, c.name]))))
      .catch(() => setCityNames({}));
    // Pickup ETA for the pin (where the adapter has one).
    if (api.capabilities.pickupEta) api.getPickupEta().then((r) => setEta(r.minutes)).catch(() => setEta(null));
  }, []);

  // Recent routes: only where the adapter has them (capabilities.recentRoutes).
  useEffect(() => {
    if (!api.capabilities.recentRoutes) return;
    setRecentLoading(true);
    setRecentError(false);
    api
      .getRecentRoutes()
      .then(setRecent)
      .catch(() => {
        setRecent([]);
        setRecentError(true);
      })
      .finally(() => setRecentLoading(false));
  }, [recentReload]);

  // The history entry Home had before the order flow (react-router keeps an
  // index in history.state). After ordering, the app goes back to it first,
  // so one back press from tracking leaves the flow (round 4).
  const location = useLocation();
  const baseIdx = useRef<number | null>(null);
  const pendingTrack = useRef<{ path: string; state?: unknown } | null>(null);
  const historyIdx = () => (window.history.state as { idx?: number } | null)?.idx;
  useEffect(() => {
    // Only a real Home entry (no ?flow=) is the base; while going back to it
    // the reset draft also shows Home, which must not move the base.
    const next = pendingTrack.current;
    if (!flow && !next) baseIdx.current = historyIdx() ?? null;
    if (next && historyIdx() === baseIdx.current) {
      pendingTrack.current = null;
      navigate(next.path, { state: next.state });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, location.key]);
  function openTracking(path: string, state?: unknown) {
    rememberHomeBase(baseIdx.current);
    const cur = historyIdx();
    const delta = baseIdx.current != null && cur != null ? baseIdx.current - cur : 0;
    if (delta < 0) {
      pendingTrack.current = { path, state };
      navigate(delta);
    } else {
      navigate(path, { replace: true, state });
    }
  }

  // "Faol buyurtma": checked when Home opens and each time it is shown again.
  const [activeOrder, setActiveOrder] = useState<OrderWithDetails | null>(null);
  useEffect(() => {
    if (view !== "home") return;
    let alive = true;
    api
      .getActiveOrder()
      .then((o) => alive && setActiveOrder(o))
      .catch(() => alive && setActiveOrder(null));
    return () => {
      alive = false;
    };
  }, [view, location.key]);

  // Back on Home after the order flow: refetch saved addresses, since the
  // flow may have changed one's Tafsilotlar.
  const wasAway = useRef(false);
  useEffect(() => {
    if (view !== "home") wasAway.current = true;
    else if (wasAway.current) {
      wasAway.current = false;
      setSavedReload((n) => n + 1);
    }
  }, [view]);

  useEffect(() => {
    if (saved.length === 0) setSavedLoading(true);
    setSavedError(false);
    api
      .getSavedAddresses(draft.fromAddressId)
      .then(setSaved)
      .catch(() => {
        setSaved([]);
        setSavedError(true);
      })
      .finally(() => setSavedLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.fromAddressId, savedReload]);

  // The floating test-panel button sits above the home sheet, and steps aside
  // in the order flow.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPanelH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);
  useEffect(() => {
    // Above the sheet and the "where am I" button.
    setFabPlacement(view === "home" ? { hidden: false, bottomPx: panelH + 72 } : { hidden: true });
  }, [view, panelH, setFabPlacement]);
  useEffect(() => () => setFabPlacement({ hidden: false, bottomPx: null }), [setFabPlacement]);

  const go = (next: Record<string, string>, replace = false) => setParams(next, { replace });
  function back() {
    if (window.history.state?.idx > 0) navigate(-1);
    else go({}, true);
  }

  /** Same rule as in the flow: a new point starts clean; an entrance chosen
   * in search fills Podyezd; a saved address brings its details back. */
  function setPoint(which: "from" | "to", addr: Address, details?: AddressDetails, entrance?: string) {
    setField(which === "from" ? "fromAddressId" : "toAddressId", addr.id);
    // Where the order can't carry Tafsilotlar, the draft holds none (they
    // would be shown and then dropped).
    if (!api.capabilities.addressDetails) {
      setField(which === "from" ? "fromDetails" : "toDetails", {});
      return;
    }
    const picked: AddressDetails = { ...(details ?? {}), ...(entrance ? { entrance } : {}) };
    setField(which === "from" ? "fromDetails" : "toDetails", picked);
    if (!details) {
      api
        .getSavedAddressDetails(addr.id)
        .then((s) => {
          const id = which === "from" ? useOrderStore.getState().draft.fromAddressId : useOrderStore.getState().draft.toAddressId;
          if (s && id === addr.id) setField(which === "from" ? "fromDetails" : "toDetails", { ...s, ...(entrance ? { entrance } : {}) });
        })
        .catch(() => {});
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    setRenewal(null);
    try {
      const order = await api.createOrder({
        serviceType: draft.serviceType,
        fromAddressId: draft.fromAddressId,
        toAddressId: draft.toAddressId,
        mode: draft.mode,
        seatIds: draft.seatIds,
        cargo: draft.serviceType === "delivery" ? draft.cargo : undefined,
        paymentMethod: draft.paymentMethod,
        timing: draft.timing,
        promoCode: draft.promoCode || undefined,
        fromDetails: draft.fromDetails,
        toDetails: draft.toDetails,
        stops: draft.stops.map((st) => ({ addressId: st.addressId, details: st.details })),
        // The comment field is shown for Yo'lovchi only (Dostavka has its own Izoh).
        comment: draft.serviceType === "passenger" ? draft.comment : undefined,
        // Wishes were removed (2026-11-22): no options are sent.
        // Class, bags and "Kim ketadi?" are Yo'lovchi-only fields.
        carClass: draft.serviceType === "passenger" ? draft.carClass : undefined,
        luggage: draft.serviceType === "passenger" ? draft.luggage : undefined,
        sender: draft.serviceType === "delivery" && api.capabilities.cargoExtras ? draft.sender : undefined,
        receiver: draft.serviceType === "delivery" && api.capabilities.cargoExtras ? draft.receiver : undefined,
        rider: draft.serviceType === "passenger" && api.capabilities.rider ? draft.rider : undefined,
      });
      // Payme / Click: pay on the provider's page when the server gives one
      // (system browser); otherwise the tracking screen says it comes later.
      const paysInApp = draft.paymentMethod === "payme" || draft.paymentMethod === "click";
      if (paysInApp && order.paymentUrl) window.open(order.paymentUrl, "_blank", "noopener,noreferrer");
      openTracking(`/order/track/${order.id}`, paysInApp && !order.paymentUrl ? { paymentLater: true } : undefined);
      reset();
    } catch (e) {
      // The quote behind the shown price is gone (expired, used, changed):
      // the adapter fetched a new one; show it and wait for a confirmation.
      const total = isApiError(e) ? e.params.total : undefined;
      if (isApiError(e) && QUOTE_ERRORS.has(e.code) && typeof total === "number") {
        setRenewal({ messageKey: e.message, total });
      } else {
        setSubmitError(ruleErrorKey(e) ?? serverErrorKey(e) ?? "order.submitError");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "route") {
    return (
      <div className="relative h-full bg-bg">
        {draft.serviceType === "passenger" ? (
          <PassengerFlow
            draft={draft}
            setField={setField}
            addresses={{ from: fromAddress, to: toAddress }}
            onAddressChange={(which, addr) => setField(which === "from" ? "fromAddressId" : "toAddressId", addr.id)}
            onSubmit={submit}
            submitting={submitting}
            submitError={submitError}
            quoteRenewal={renewal}
            onQuoteRenewalCancel={() => setRenewal(null)}
            onClose={back}
          />
        ) : (
        <CargoFlow
          draft={draft}
          setField={setField}
          addresses={{ from: fromAddress, to: toAddress }}
          onAddressChange={(which, addr) => setField(which === "from" ? "fromAddressId" : "toAddressId", addr.id)}
          onSubmit={submit}
          submitting={submitting}
          submitError={submitError}
          quoteRenewal={renewal}
          onQuoteRenewalCancel={() => setRenewal(null)}
          onClose={back}
        />
        )}
      </div>
    );
  }

  const markers: MapMarker[] = [];
  if (me) markers.push({ id: "me", position: me, kind: "user", animate: true });
  if (pickupPoint) markers.push({ id: "pickup", position: pickupPoint, content: <PickupPin eta={eta} /> });

  function swap() {
    const d = useOrderStore.getState().draft;
    if (!d.toAddressId) return;
    setField("fromAddressId", d.toAddressId);
    setField("toAddressId", d.fromAddressId);
    setField("fromDetails", d.toDetails);
    setField("toDetails", d.fromDetails);
  }

  const searchTitle = searchTarget === "from" ? t("order.from") : searchTarget === "save" ? t("home.saveAddressTitle") : t("order.to");

  return (
    <div className="relative h-full overflow-hidden bg-iz-map">
      {/* Full-screen interactive map behind the sheet; the drawn map where it isn't available. */}
      <LiveMap
        className="absolute inset-0"
        ariaLabel={t("map.label")}
        center={pickupPoint ?? me}
        zoom={15}
        // The camera moves when the pickup changes, when the first GPS fix
        // arrives (no pickup yet) and on "where am I" — not on every fix,
        // which would pull the map back while the passenger is panning it.
        fitKey={`${pickupPoint ? draft.fromAddressId : me ? "me" : "none"}:${recentre}`}
        markers={markers}
        // The top bar covers the top, the sheet the bottom.
        padding={{ top: 88, bottom: panelH }}
        fallback={
          <>
            <MapCanvas className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center" style={{ height: `calc(100% - ${panelH}px)` }}>
              <div className="mb-auto mt-auto">
                <PickupPin eta={eta} />
              </div>
            </div>
          </>
        }
      />

      <HomeTopBar
        cityName={fromAddress ? cityNames[fromAddress.cityId] : undefined}
        onCity={() => go({ flow: "search", target: "from" })}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 [&>*]:pointer-events-auto" style={{ paddingTop: "calc(var(--safe-top) + 76px)" }}>
        <LowConnectionBanner />
      </div>

      <button
        type="button"
        aria-label={t("home.myLocation")}
        className="absolute right-5 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-iz-sheet text-iz-ink shadow-[0_8px_20px_var(--iz-shadow)] active:scale-95"
        style={{ bottom: panelH + 16 }}
        // "Where am I": the adapter resolves the device position (the map's
        // centre in the demo) to a pickup point.
        onClick={() =>
          api
            .locateMe()
            .then((a) => {
              setPoint("from", a);
              setRecentre((n) => n + 1);
            })
            .catch((e) => setToast(t((serverErrorKey(e) ?? "common.errorMessage") as TranslationKey)))
        }
      >
        <Icon name="locate" size={22} />
      </button>

      <HomeSheet
        panelRef={panelRef}
        activeOrder={activeOrder}
        onActiveOrder={activeOrder ? () => navigate(`/order/track/${activeOrder.id}`) : undefined}
        profile={profile}
        fromLabel={fromAddress?.label ?? null}
        toLabel={toAddress?.label ?? null}
        serviceType={draft.serviceType}
        onServiceType={(v) => setField("serviceType", v)}
        onFrom={() => go({ flow: "search", target: "from" })}
        onTo={() => go({ flow: "search", target: "to" })}
        onSwap={swap}
        saved={saved}
        savedLoading={savedLoading}
        savedError={savedError}
        onRetrySaved={() => setSavedReload((n) => n + 1)}
        onSaved={(info) => {
          setPoint("to", info.address, info.details ?? {});
          go({ flow: "route" });
        }}
        onAddSaved={() => go({ flow: "search", target: "save", map: "1" })}
        recent={recent}
        recentLoading={recentLoading}
        recentError={recentError}
        onRetryRecent={() => setRecentReload((n) => n + 1)}
        cityNames={cityNames}
        onRecent={(r) => go({ flow: "search", target: "to", city: r.toCityId })}
      />

      {view === "search" && (
        <AddressFlow
          key={`${searchTarget}:${searchCity ?? ""}`}
          target={searchTarget}
          title={searchTitle}
          fromLabel={fromAddress?.label}
          toLabel={toAddress?.label}
          fromAddressId={searchTarget === "to" ? draft.fromAddressId : undefined}
          excludeCityId={searchTarget === "to" && !searchCity ? fromAddress?.cityId : searchTarget === "from" ? toAddress?.cityId : undefined}
          onlyCityId={searchTarget === "to" ? searchCity : undefined}
          startOnMap={searchOnMap}
          onSwap={searchTarget === "save" ? undefined : swap}
          onClose={back}
          onDone={(addr, entrance, details) => {
            if (searchTarget === "save") {
              setSavedReload((n) => n + 1);
              setToast(t("home.addressSaved"));
              back();
              return;
            }
            setPoint(searchTarget, addr, details, entrance);
            // A drop-off goes on to the route; a new pickup returns home.
            if (searchTarget === "to") go({ flow: "route" }, true);
            else back();
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

