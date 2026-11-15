import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Bell, ChevronRight, LocateFixed, MapPin, PersonStanding } from "@/lib/icons";
import { api } from "@/api/client";
import type { Address, AddressDetails, SavedAddressInfo } from "@/api/types";
import { ADDRESSES, addressById } from "@/clientData/addresses";
import { MapCanvas } from "@/components/MapCanvas";
import { Skeleton } from "@/components/Skeleton";
import { Logo } from "@/components/Logo";
import { LowConnectionBanner } from "@/components/LowConnectionBanner";
import { MapButton } from "@/components/ui/MapButton";
import { SearchPill } from "@/components/ui/SearchPill";
import { ListRow } from "@/components/ui/ListRow";
import { PinBubble } from "@/components/ui/PinBubble";
import { setDefaultFromAddress, useOrderStore } from "@/stores/orderStore";
import { useFloatingControl } from "@/stores/floatingControlStore";
import { useT } from "@/lib/i18n/provider";
import { OrderSheet } from "@/features/order/OrderSheet";
import { SearchScreen } from "@/features/order/SearchScreen";
import { detailsSummary } from "@/features/order/addressDetails";
import { formatDuration } from "@/features/order/duration";

// New drafts start from Toshkent. This module only loads where the ordering
// flow exists (see ./Home.tsx), so http builds don't carry the address book.
setDefaultFromAddress(ADDRESSES.find((a) => a.cityId === "tsh")?.id ?? ADDRESSES[0]?.id ?? "");

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
  const searchTarget = params.get("target") === "from" ? "from" : "to";
  const [eta, setEta] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedAddressInfo[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(false);
  const [savedReload, setSavedReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [panelH, setPanelH] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const setFabPlacement = useFloatingControl((s) => s.setFabPlacement);

  const fromAddress = addressById(draft.fromAddressId) ?? null;
  const toAddress = addressById(draft.toAddressId) ?? null;
  // A route needs a drop-off; a stale ?flow=route falls back to home.
  const view = flow === "search" ? "search" : flow === "route" && toAddress ? "route" : "home";

  useEffect(() => {
    api.getPickupEta().then((r) => setEta(r.minutes)).catch(() => {});
  }, []);

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
    if (!draft.fromAddressId) return;
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
    setFabPlacement(view === "home" ? { hidden: false, bottomPx: panelH } : { hidden: true });
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
    setSubmitError(false);
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
        optionIds: draft.optionIds,
        optionVariants: draft.optionVariants,
        // Class, bags and "Kim ketadi?" are Yo'lovchi-only fields.
        carClass: draft.serviceType === "passenger" ? draft.carClass : undefined,
        luggage: draft.serviceType === "passenger" ? draft.luggage : undefined,
        rider: draft.serviceType === "passenger" ? draft.rider : undefined,
        sender: draft.serviceType === "delivery" ? draft.sender : undefined,
        receiver: draft.serviceType === "delivery" ? draft.receiver : undefined,
      });
      navigate(`/order/track/${order.id}`, { replace: true });
      reset();
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "route") {
    return (
      <div className="relative h-full bg-bg">
        <OrderSheet
          draft={draft}
          setField={setField}
          addresses={{ from: fromAddress, to: toAddress }}
          onAddressChange={(which, addr) => setField(which === "from" ? "fromAddressId" : "toAddressId", addr.id)}
          onSubmit={submit}
          submitting={submitting}
          submitError={submitError}
          onClose={back}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-bg">
      <MapCanvas className="absolute inset-0" />

      {/* Pickup caption, top centre. */}
      <button
        type="button"
        onClick={() => go({ flow: "search", target: "from" })}
        aria-label={`${t("home.pickupChange")}: ${fromAddress?.label ?? ""}`}
        className="absolute left-1/2 max-w-[60%] -translate-x-1/2 text-center"
        style={{ top: "calc(var(--safe-top) + 16px)" }}
      >
        <span className="flex items-center justify-center gap-0.5 text-sub text-ink/70">
          {t("order.pickupCaption")} <ChevronRight className="h-3.5 w-3.5" />
        </span>
        <span className="block truncate text-control font-semibold text-ink">{fromAddress?.label}</span>
      </button>

      <Link
        to="/notifications"
        aria-label={t("home.notifications")}
        className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-card text-ink shadow-[0_2px_12px_rgba(0,0,0,0.16)]"
        style={{ top: "calc(var(--safe-top) + 16px)" }}
      >
        <Bell className="h-5 w-5" />
      </Link>

      <div className="pointer-events-none absolute inset-x-0 top-0 [&>*]:pointer-events-auto" style={{ paddingTop: "calc(var(--safe-top) + 76px)" }}>
        <LowConnectionBanner />
      </div>

      {/* Pickup pin and its bubble, centred on the visible map. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center" style={{ height: `calc(100% - ${panelH}px)` }}>
        <div className="mt-auto mb-auto flex flex-col items-center">
          <PinBubble icon={<PersonStanding className="h-5 w-5" />} caption={t("pin.pickup")} value={eta != null ? t("pin.eta", { n: eta }) : "…"} />
          <span className="mt-1 h-5 w-[3px] rounded-full bg-ink" aria-hidden="true" />
          <span className="-mt-1 h-3 w-3 rounded-full border-[3px] border-ink bg-card" aria-hidden="true" />
        </div>
      </div>

      <MapButton
        aria-label={t("home.locateMe")}
        className="absolute right-3"
        style={{ bottom: panelH + 12 }}
        // "Where am I": the adapter resolves the device position (the map's
        // centre in the demo) to a pickup point.
        onClick={() => api.reverseGeocode(50, 50).then((a) => setPoint("from", a)).catch(() => {})}
      >
        <LocateFixed className="h-5 w-5" />
      </MapButton>

      <div
        ref={panelRef}
        role="region"
        aria-label={t("home.orderSheet")}
        className="absolute inset-x-0 bottom-0 z-20 rounded-t-sheet-home bg-card px-4 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}
      >
        <div className="flex justify-center" aria-hidden="true">
          <span className="h-[5px] w-9 rounded-full bg-ink/15" />
        </div>
        <div className="mb-4 mt-2 flex items-center gap-3">
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
            <Logo size={48} />
          </span>
          <h1 className="text-display font-bold text-ink">{t("home.title")}</h1>
        </div>

        <SearchPill label={t("home.whereTo")} onClick={() => go({ flow: "search", target: "to" })} />

        <div className="mt-3">
          {savedLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-12 w-full rounded-control" />
              <Skeleton className="h-12 w-full rounded-control" />
            </div>
          ) : savedError ? (
            <button
              onClick={() => setSavedReload((n) => n + 1)}
              className="inline-flex min-h-[44px] items-center text-sub font-semibold text-danger underline"
            >
              {t("common.errorMessage")} — {t("common.retry")}
            </button>
          ) : saved.length === 0 ? (
            <p className="py-3 text-sub text-ink/60">{t("home.noSavedAddresses")}</p>
          ) : (
            <div aria-label={t("order.savedAddresses")} role="group">
              {saved.map(({ address, area, details, etaMinutes }, i) => (
                <ListRow
                  key={address.id}
                  icon={<MapPin className="h-5 w-5" />}
                  title={address.label}
                  subtitle={(details && detailsSummary(details, t)) || area}
                  trailing={formatDuration(etaMinutes, t)}
                  last={i === saved.length - 1}
                  onClick={() => {
                    setPoint("to", address, details ?? {});
                    go({ flow: "route" });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "search" && (
        <SearchScreen
          title={searchTarget === "from" ? t("order.from") : t("order.to")}
          fromLabel={searchTarget === "to" ? fromAddress?.label : undefined}
          fromAddressId={searchTarget === "to" ? draft.fromAddressId : undefined}
          excludeCityId={searchTarget === "to" ? fromAddress?.cityId : toAddress?.cityId}
          onClose={back}
          onSelect={(addr, entrance) => {
            setPoint(searchTarget, addr, undefined, entrance);
            // A drop-off goes on to the route; a new pickup returns home.
            if (searchTarget === "to") go({ flow: "route" }, true);
            else back();
          }}
        />
      )}
    </div>
  );
}
