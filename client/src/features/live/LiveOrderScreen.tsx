import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { OrderTiming, OrderWithDetails, SchedulingRules } from "@/api/types";
import { Toast } from "@/components/Toast";
import { DEMO_MODE } from "@/config";
import { serverErrorKey } from "@/lib/apiError";
import { formatClock, formatNumber, formatSom, formatTime, SOM_LABEL } from "@/lib/format";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { useQuery } from "@/lib/useQuery";
import { useOrderStore } from "@/stores/orderStore";
import { useFloatingControl } from "@/stores/floatingControlStore";
import { leaveToHome } from "@/lib/homeBase";
import { Icon, PrimaryButton, Screen, StateError, StateLoading, TextButton, useShellChrome, useStatusBar } from "@/ui";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/features/order/duration";
import { detailsSummary } from "@/features/order/addressDetails";
import { timingSummary } from "@/features/order/timingSummary";
import { TrackMap } from "@/features/order/TrackMap";
import { TimeScreen } from "@/features/trip/TimeScreen";
import { ActionTiles, DrawnLiveMap, DriverCardDark, DriverRow, LiveHeading, PhaseBar, payLabel, WaitRing, type LiveAction } from "./LiveParts";
import { CancelSheet } from "./CancelSheet";
import { SafetySheet, shareTrip } from "./SafetySheet";
import { EditOrderScreen, type EditSub } from "./EditOrderScreen";

// The sample data's own "no driver" cut-off; the real backend decides itself (expired).
const SEARCH_TIMEOUT_S = 300;

type Sheet = "cancel" | "safety" | "time" | "edit" | "edit:from" | "edit:to" | "edit:time" | null;
const SHEETS = new Set(["cancel", "safety", "time", "edit", "edit:from", "edit:to", "edit:time"]);

/** Every second while mounted: the clock for countdowns and "minutes left". */
function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

/** Round button over the map (Yopish / Asosiy sahifaga, SOS). */
function MapButton({ label, onClick, children, sos, style }: { label: string; onClick: () => void; children: React.ReactNode; sos?: boolean; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={style}
      className={cn(
        "absolute z-10 flex h-12 w-12 items-center justify-center rounded-full active:scale-95",
        sos
          ? "right-5 bg-iz-sos text-[13px] font-extrabold text-iz-head-text shadow-[0_8px_20px_var(--iz-sos-shadow)]"
          : "left-5 bg-iz-map-pin text-iz-head-text shadow-[0_8px_20px_var(--iz-shadow-strong)]"
      )}
    >
      {children}
    </button>
  );
}

/**
 * A live order on the map (design v2: Search, NoDriver, Driver, Arrived,
 * OnTrip). The bottom sheet follows the server's status; every number on it
 * (price, ETA, waiting terms, kilometres, arrival) is the adapter's and its
 * block hides when the server doesn't send it. Sheets (cancel, SOS, edit,
 * time) live in the URL so the Android back button closes only them.
 */
export function LiveOrderScreen() {
  const { t, intlTag } = useT();
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const draft = useOrderStore((s) => s.draft);
  useShellChrome();
  useStatusBar("map");

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [error, setError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  /** NoDriver: the time to search again with (design: "O'zgartirish"). */
  const [retryTiming, setRetryTiming] = useState<OrderTiming | null>(null);
  // Payme / Click without a payment page from the server: say it comes later.
  const [toast, setToast] = useState<string | null>(() =>
    (location.state as { paymentLater?: boolean } | null)?.paymentLater ? t("pay.later") : null
  );
  // Stable: the screen re-renders every second, which must not restart the toast's timer.
  const clearToast = useCallback(() => setToast(null), []);
  const startRef = useRef(Date.now());
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState(0);

  const raw = params.get("sheet");
  const sheet: Sheet = raw && SHEETS.has(raw) ? (raw as Sheet) : null;
  const setSheet = (s: Sheet) => {
    const next = new URLSearchParams(params);
    if (!s) {
      if ((location.state as { sheet?: boolean } | null)?.sheet) {
        navigate(-1);
        return;
      }
      next.delete("sheet");
      setParams(next, { replace: true });
      return;
    }
    next.set("sheet", s);
    // From one sheet to the next inside the edit screen: still one entry each.
    setParams(next, { state: { sheet: true } });
  };

  async function poll() {
    try {
      const res = await api.getOrder(orderId);
      setOrder(res);
      setError(false);
      if (res.status === "completed") navigate(`/order/finished/${orderId}`, { replace: true });
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    startRef.current = Date.now();
    setOrder(null);
    poll();
    // The server pushes order changes over the WebSocket; the interval is
    // only a safety net (the sample data has no push, so it polls fast).
    const interval = setInterval(poll, DEMO_MODE ? 1500 : 15000);
    const unsubscribe = api.onOrderEvent((e) => {
      if (e.orderId === orderId) poll();
    });
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(tick);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPanelH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [order != null]);
  // The sample-data test button sits above the sheet, never on its buttons.
  const setFabPlacement = useFloatingControl((s) => s.setFabPlacement);
  // (Again after a sheet closes: its own footer resets the placement.)
  useEffect(() => {
    if (panelH && !sheet) setFabPlacement({ bottomPx: panelH + 8 });
  }, [panelH, sheet, setFabPlacement]);
  useEffect(() => () => setFabPlacement({ bottomPx: null }), [setFabPlacement]);

  const timedOut = DEMO_MODE && order?.status === "searching" && elapsed >= SEARCH_TIMEOUT_S;
  const view: "search" | "noDriver" | "toPickup" | "arrived" | "trip" | "cancelled" | "done" | null = !order
    ? null
    : order.status === "searching"
      ? timedOut
        ? "noDriver"
        : "search"
      : order.status === "no_driver"
        ? "noDriver"
        : order.status === "accepted"
          ? order.driverArrived
            ? "arrived"
            : "toPickup"
          : order.status === "in_progress"
            ? "trip"
            : order.status === "cancelled"
              ? "cancelled"
              : "done";
  const now = useNow(view === "arrived" || view === "trip");
  const scheduling = useQuery<SchedulingRules | null>(() => (view === "noDriver" ? api.getSchedulingRules() : Promise.resolve(null)), [view === "noDriver"]);

  // A sheet that no longer fits the order (it moved on) closes itself.
  useEffect(() => {
    if (!order || !sheet) return;
    const live = order.status === "searching" || order.status === "accepted" || order.status === "in_progress";
    const cancellable = order.canCancel !== false && (order.status === "searching" || order.status === "accepted");
    if ((sheet.startsWith("edit") || sheet === "safety") && !live) setSheet(null);
    if (sheet === "cancel" && !cancellable) setSheet(null);
    if (sheet === "time" && view !== "noDriver") setSheet(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, view]);

  async function retrySearch() {
    if (!order) return;
    setRetrying(true);
    setRetryError(null);
    try {
      // The adapter re-sends what was ordered; the draft only fills what an
      // old sample order doesn't record. The time is the one shown here.
      const res = await api.repeatOrder(
        orderId,
        {
          serviceType: draft.serviceType,
          mode: draft.mode,
          seatIds: draft.seatIds,
          cargo: draft.cargo,
          paymentMethod: draft.paymentMethod,
          timing: draft.timing,
        },
        { timing: retryTiming ?? order.extras?.timing ?? { timeMode: "now" } }
      );
      navigate(`/order/track/${res.id}`, { replace: true });
    } catch (e) {
      setRetryError(t((serverErrorKey(e) ?? "track.retryError") as TranslationKey));
    } finally {
      setRetrying(false);
    }
  }

  async function confirmCancel(reason: string) {
    setCancelling(true);
    setCancelError(null);
    try {
      await api.cancelOrder(orderId, reason);
      leaveToHome(navigate);
    } catch (e) {
      setCancelError(t((serverErrorKey(e) ?? "track.cancelError") as TranslationKey));
    } finally {
      setCancelling(false);
    }
  }

  if (error && !order) {
    return (
      <Screen title={t("track.title")} onBack={() => navigate("/home")}>
        <StateError onRetry={poll} />
      </Screen>
    );
  }
  if (!order || !view) {
    return (
      <Screen title={t("track.title")} onBack={() => navigate("/home")}>
        <StateLoading rows={3} />
      </Screen>
    );
  }

  const driver = order.driver;
  const callDriver = () => setToast(t("driver.callUnavailable"));
  const share = () => shareTrip(orderId, t, setToast);
  const live = view === "search" || view === "toPickup" || view === "arrived" || view === "trip";
  const canCancel = order.canCancel !== false && (view === "search" || view === "toPickup" || view === "arrived");
  const canEdit = api.capabilities.orderDetails && order.editable;
  const pickupLine = [order.extras?.fromAddressId ? api.addressById(order.extras.fromAddressId)?.label : order.fromCity.name, detailsSummary(order.extras?.fromDetails, t)]
    .filter(Boolean)
    .join(", ");

  const actions: LiveAction[] = [];
  if (canEdit) actions.push({ key: "edit", icon: "edit", label: t("live.edit"), onClick: () => setSheet("edit") });
  if (api.capabilities.safety) actions.push({ key: "share", icon: "share", label: t("live.share"), onClick: share });
  if (canCancel) actions.push({ key: "cancel", icon: "close", label: view === "arrived" ? t("live.cancelShort") : t("cancel.confirmAction"), onClick: () => setSheet("cancel"), danger: true });

  const timing = retryTiming ?? order.extras?.timing ?? { timeMode: "now" as const };
  const timingText = timing.timeMode === "now" ? t("time.now") : timingSummary(timing, t, intlTag);
  const who = order.extras?.serviceType === "delivery" ? t("live.delivery") : order.mode === "car" ? t("live.wholeCar") : t("live.people", { n: Math.max(1, order.seatIds.length) });
  const etaLabel = order.driverEtaMinutes != null ? t("live.etaShort", { n: order.driverEtaMinutes }) : undefined;

  // ── The sheet for each phase ────────────────────────────────────────────
  let panel: React.ReactNode;
  if (view === "search") {
    const steps = [
      { key: "live.search.sent", state: "done" },
      { key: "live.search.reviewing", state: "active" },
      { key: "live.search.accept", state: "next" },
    ] as const;
    panel = (
      <>
        <LiveHeading title={t("live.search.title")} sub={<span className="text-[14px] leading-[21px]">{t("live.search.desc")}</span>} />
        <ol className="flex flex-col" aria-label={t("live.search.title")}>
          {steps.map((s, i) => (
            <li key={s.key} className="flex flex-col">
              {i > 0 && <span aria-hidden className={cn("ml-[11px] h-3 w-0.5", s.state === "next" ? "bg-iz-chip-border" : "bg-iz-ink")} />}
              <span className="flex h-8 items-center gap-3.5" aria-current={s.state === "active" ? "step" : undefined}>
                {s.state === "done" ? (
                  <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-iz-ink text-iz-on-selected">
                    <Icon name="check" size={13} strokeWidth={3} />
                  </span>
                ) : s.state === "active" ? (
                  <span aria-hidden className="h-6 w-6 shrink-0 animate-pulse rounded-full border-[7px] border-iz-green bg-iz-sheet" />
                ) : (
                  <span aria-hidden className="h-6 w-6 shrink-0 rounded-full border-2 border-iz-dash" />
                )}
                <span className={cn("text-[14px]", s.state === "active" ? "font-extrabold text-iz-ink" : s.state === "done" ? "font-bold text-iz-ink" : "font-semibold text-iz-muted")}>
                  {t(s.key)}
                </span>
                {s.state === "active" && <span className="ml-auto text-[13px] font-bold tabular-nums text-iz-muted">{formatClock(elapsed)}</span>}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex items-center justify-between gap-3 rounded-iz-field bg-iz-field px-4 py-3.5">
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="truncate text-[15px] font-extrabold text-iz-ink">{`${order.fromCity.name} → ${order.toCity.name}`}</span>
            <span className="truncate text-[12px] font-semibold text-iz-muted">{[who, timingText, payLabel(order, t)].join(" · ")}</span>
          </span>
          <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums text-iz-ink">{formatNumber(order.price, intlTag)}</span>
        </div>
        {canCancel && (
          <button type="button" onClick={() => setSheet("cancel")} className="flex h-14 shrink-0 items-center justify-center rounded-full border border-iz-chip-border text-[15px] font-extrabold text-iz-ink active:bg-iz-field">
            {t("cancel.confirmAction")}
          </button>
        )}
        {canEdit && (
          <TextButton tone="ink" onClick={() => setSheet("edit")}>
            {t("live.edit")}
          </TextButton>
        )}
      </>
    );
  } else if (view === "noDriver") {
    panel = (
      <>
        <LiveHeading title={t("live.noDriver.title")} sub={<span className="text-[14px] leading-[21px]">{t("live.noDriver.desc")}</span>} />
        {api.capabilities.repeatOrder && (
          <button type="button" onClick={() => setSheet("time")} className="flex h-[68px] shrink-0 items-center gap-3.5 rounded-iz-field bg-iz-field px-3.5 text-left active:opacity-80">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-sheet text-iz-ink">
              <Icon name="calendar" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("pay.pickupTime")}</span>
              <span className="truncate text-[16px] font-extrabold text-iz-ink">{timingText}</span>
            </span>
            <span className="text-[13px] font-extrabold text-iz-green-text">{t("pay.change")}</span>
          </button>
        )}
        {retryError && (
          <p role="alert" className="text-[13px] font-semibold text-iz-danger">
            {retryError}
          </p>
        )}
        {api.capabilities.repeatOrder ? (
          <PrimaryButton loading={retrying} icon="refresh" onClick={retrySearch}>
            {t("live.noDriver.retry")}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => leaveToHome(navigate)}>{t("finished.backHome")}</PrimaryButton>
        )}
        {api.capabilities.repeatOrder && (
          <TextButton onClick={() => leaveToHome(navigate)}>{t("cancel.title")}</TextButton>
        )}
      </>
    );
  } else if (view === "cancelled") {
    panel = (
      <>
        <LiveHeading title={t("track.cancelledTitle")} sub={order.cancelReason ? t(order.cancelReason as TranslationKey) : undefined} />
        <PrimaryButton onClick={() => leaveToHome(navigate)}>{t("finished.backHome")}</PrimaryButton>
      </>
    );
  } else if (view === "toPickup") {
    panel = (
      <>
        <LiveHeading
          label={t("live.found")}
          title={order.driverEtaMinutes != null ? t("live.eta", { n: order.driverEtaMinutes }) : t("live.onTheWay")}
          sub={pickupLine || undefined}
        />
        <PhaseBar current={0} />
        {driver && <DriverCardDark driver={driver} order={order} onCall={callDriver} />}
        <ActionTiles actions={actions} />
      </>
    );
  } else if (view === "arrived") {
    const car = driver ? [driver.carColor, driver.carModel].filter(Boolean).join(" ") : "";
    const w = order.waiting;
    const left = w ? Math.max(0, Math.round((w.freeUntil - now) / 1000)) : 0;
    const price = w ? `${formatNumber(w.pricePerMinute, intlTag)} ${SOM_LABEL}` : "";
    panel = (
      <>
        <LiveHeading label={t("live.arrivedLabel")} title={car ? t("live.arrivedTitle", { car: car.charAt(0).toUpperCase() + car.slice(1) }) : t("track.arrived")} />
        <PhaseBar current={1} />
        {w && (
          <div className="flex items-center gap-4 rounded-iz-card bg-iz-head p-4" role="timer" aria-live="off">
            <WaitRing fraction={left / Math.max(1, (w.freeUntil - w.startedAt) / 1000)} label={formatClock(left)} />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[16px] font-extrabold text-iz-head-text">{left > 0 ? t("live.freeWait") : t("live.paidWait")}</span>
              <span className="text-[13px] leading-[19px] text-iz-head-muted">
                {rich(t(left > 0 ? "live.freeWaitDesc" : "live.paidWaitDesc"), { price: <span className="font-bold text-iz-head-text">{price}</span> })}
              </span>
            </div>
          </div>
        )}
        {driver && <DriverRow driver={driver} phone={order.driverPhone} tone="light" sub={driver.plate} onCall={callDriver} />}
        <ActionTiles actions={actions} compact />
      </>
    );
  } else {
    // view === "trip"
    const p = order.tripProgress;
    const minutes = p ? Math.max(0, Math.round((p.arrivalAt - now) / 60_000)) : null;
    const total = p ? p.doneKm + p.leftKm : 0;
    const doneShare = total > 0 && p ? p.doneKm / total : 0;
    const sub = driver ? [[driver.carModel, driver.carColor].filter(Boolean).join(", "), driver.plate].filter(Boolean).join(" · ") : "";
    panel = (
      <>
        <LiveHeading
          label={t("live.tripLabel")}
          title={minutes != null ? t("live.tripTitle", { city: order.toCity.name, duration: formatDuration(minutes, t) }) : t("track.inProgress")}
          sub={p ? t("live.tripArrive", { time: formatTime(p.arrivalAt) }) : undefined}
        />
        <PhaseBar current={2} />
        {p && (
          <div className="flex flex-col gap-2.5 rounded-[22px] bg-iz-field px-4 py-3.5">
            <div className="flex justify-between gap-3 text-[13px] font-extrabold text-iz-ink">
              <span className="truncate">{order.fromCity.name}</span>
              <span className="truncate">{order.toCity.name}</span>
            </div>
            <div
              className="relative h-2 rounded-full bg-iz-divider-in-field"
              role="progressbar"
              aria-label={t("live.tripLabel")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(doneShare * 100)}
            >
              <div className="absolute inset-y-0 left-0 rounded-full bg-iz-green transition-[width] duration-1000" style={{ width: `${doneShare * 100}%` }} />
              <div aria-hidden className="absolute -top-1.5 -ml-2.5 h-5 w-5 rounded-full border-[3px] border-iz-green bg-iz-ink transition-[left] duration-1000" style={{ left: `${doneShare * 100}%` }} />
            </div>
            <span className="text-[12px] font-semibold text-iz-muted">{t("live.tripKm", { done: formatNumber(p.doneKm, intlTag), left: formatNumber(p.leftKm, intlTag) })}</span>
          </div>
        )}
        {driver && <DriverRow driver={driver} phone={order.driverPhone} tone="dark" sub={sub} onCall={callDriver} />}
        {api.capabilities.safety ? (
          <PrimaryButton icon="share" onClick={share}>
            {t("live.shareRoute")}
          </PrimaryButton>
        ) : (
          <p className="text-center text-[13px] font-bold tabular-nums text-iz-muted">
            {payLabel(order, t)} · {formatSom(order.price, intlTag)}
          </p>
        )}
      </>
    );
  }

  const phase = view === "search" ? "search" : view === "toPickup" ? "toPickup" : view === "arrived" ? "arrived" : view === "trip" ? "trip" : "none";
  const showSos = api.capabilities.safety && (view === "toPickup" || view === "arrived" || view === "trip");
  const leaveLabel = view === "search" || view === "noDriver" || view === "cancelled" ? t("common.close") : t("live.home");

  return (
    <div className="relative h-full overflow-hidden bg-iz-map">
      <TrackMap
        order={order}
        fullScreen
        padding={{ top: 80, bottom: panelH }}
        fallback={(progress) => <DrawnLiveMap phase={phase} progress={progress} etaLabel={etaLabel} bottomInset={panelH} />}
      />

      <MapButton label={leaveLabel} onClick={() => navigate("/home")} style={{ top: "calc(var(--safe-top) + 12px)" }}>
        <Icon name={view === "search" || view === "noDriver" || view === "cancelled" ? "close" : "back"} size={view === "search" || view === "noDriver" || view === "cancelled" ? 18 : 20} />
      </MapButton>
      {showSos && (
        <MapButton sos label={t("live.sos")} onClick={() => setSheet("safety")} style={{ top: view === "trip" ? "calc(var(--safe-top) + 92px)" : "calc(var(--safe-top) + 12px)" }}>
          SOS
        </MapButton>
      )}

      <div
        ref={panelRef}
        className={cn(
          "no-scrollbar absolute inset-x-0 bottom-0 z-10 flex max-h-[82%] flex-col gap-3.5 overflow-y-auto overscroll-contain rounded-t-iz-sheet bg-iz-sheet px-5 pb-[max(var(--safe-bottom),24px)] pt-3 shadow-[0_-10px_40px_var(--iz-shadow)]",
          view === "search" || view === "noDriver" ? "gap-4" : "gap-3.5"
        )}
      >
        <span aria-hidden className="h-[5px] w-10 shrink-0 self-center rounded-full bg-iz-chip-border" />
        {panel}
      </div>

      {sheet === "cancel" && canCancel && (
        <CancelSheet
          loading={cancelling}
          error={cancelError}
          onClose={() => {
            setCancelError(null);
            setSheet(null);
          }}
          onConfirm={confirmCancel}
        />
      )}
      {sheet === "safety" && <SafetySheet orderId={orderId} onClose={() => setSheet(null)} onToast={setToast} />}
      {sheet === "time" && view === "noDriver" && (
        scheduling.status === "success" && scheduling.data ? (
          <TimeScreen
            value={timing}
            rules={scheduling.data}
            onBack={() => setSheet(null)}
            onDone={(next) => {
              setRetryTiming(next);
              setRetryError(null);
              setSheet(null);
            }}
          />
        ) : (
          <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("time.title")}>
            <Screen title={t("time.title")} onBack={() => setSheet(null)}>
              {scheduling.status === "error" ? <StateError onRetry={scheduling.refetch} /> : <StateLoading rows={2} />}
            </Screen>
          </div>
        )
      )}
      {sheet?.startsWith("edit") && live && (
        <EditOrderScreen
          order={order}
          sub={sheet === "edit" ? null : (sheet.slice(5) as EditSub)}
          onSub={(s) => setSheet(s ? (`edit:${s}` as Sheet) : null)}
          onClose={() => setSheet(null)}
          onSaved={(updated) => {
            setOrder(updated);
            setToast(t("live.saved"));
            setSheet(null);
          }}
          onCancel={canCancel ? () => setParams(new URLSearchParams({ sheet: "cancel" }), { replace: true, state: location.state }) : undefined}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  );
}
