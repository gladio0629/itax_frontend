import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, SearchX, Check, Clock3, Navigation, ShieldCheck, X } from "@/lib/icons";
import { api } from "@/api/client";
import type { OrderWithDetails } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BottomBar } from "@/components/BottomBar";
import { Button } from "@/components/Button";
import { StaticMap } from "@/components/StaticMap";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { Toast } from "@/components/Toast";
import { formatClock, formatSom } from "@/lib/format";
import { useOrderStore } from "@/stores/orderStore";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { serverErrorKey } from "@/lib/apiError";
import { DEMO_MODE } from "@/config";
import { DriverCard } from "./DriverCard";
import { TrackMap } from "./TrackMap";
import { CancelSheet } from "./CancelSheet";
import { SafetySheet } from "./SafetySheet";

// "Tafsilotlar" (edit a live order): shown where the adapter supports it
// and the order's own verdicts allow it.
const TafsilotlarSheet = lazy(() => import("./TafsilotlarSheet").then((m) => ({ default: m.TafsilotlarSheet })));

const SEARCH_TIMEOUT_S = 300; // 5 minutes, per spec — server usually resolves far sooner

const STATUS_STEPS = [
  { key: "accepted", labelKey: "track.step.accepted" as const, icon: Check },
  { key: "pickup", labelKey: "track.step.pickup" as const, icon: Navigation },
  { key: "in_progress", labelKey: "track.step.inProgress" as const, icon: Clock3 },
];

export function OrderTrackScreen() {
  const { t, intlTag } = useT();
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const { draft } = useOrderStore();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [error, setError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const startRef = useRef(Date.now());

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

  async function retrySearch() {
    setRetrying(true);
    try {
      // The adapter re-sends exactly what was ordered; the draft only fills
      // what an old sample order doesn't record (it was reset on submit).
      const res = await api.repeatOrder(orderId, {
        serviceType: draft.serviceType,
        mode: draft.mode,
        seatIds: draft.seatIds,
        cargo: draft.cargo,
        paymentMethod: draft.paymentMethod,
        timing: draft.timing,
      });
      navigate(`/order/track/${res.id}`, { replace: true });
    } catch (e) {
      setToast(serverErrorKey(e) ? t(serverErrorKey(e) as TranslationKey) : t("track.retryError"));
    } finally {
      setRetrying(false);
    }
  }

  async function confirmCancel(reason: string) {
    setCancelling(true);
    try {
      await api.cancelOrder(orderId, reason);
      navigate("/home", { replace: true });
    } catch (e) {
      setToast(serverErrorKey(e) ? t(serverErrorKey(e) as TranslationKey) : t("track.cancelError"));
    } finally {
      setCancelling(false);
    }
  }

  if (error && !order) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title={t("track.title")} />
        <ErrorState onRetry={poll} />
      </div>
    );
  }
  if (!order) return null;

  // The real backend decides "no driver" itself (status expired); the local
  // 5-minute cut-off is for the sample data only.
  const timedOut = DEMO_MODE && order.status === "searching" && elapsed >= SEARCH_TIMEOUT_S;
  const showNoDriver = order.status === "no_driver" || timedOut;

  let tripProgress = 0.5;
  if (order.timeline?.tripStartsAt && order.timeline?.tripEndsAt) {
    const { tripStartsAt, tripEndsAt } = order.timeline;
    tripProgress = Math.min(1, Math.max(0, (Date.now() - tripStartsAt) / (tripEndsAt - tripStartsAt)));
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <ScreenHeader
        title={showNoDriver ? t("track.notFound") : t("track.title")}
        right={
          // Safety tools while a driver is assigned or the trip is on.
          api.capabilities.safety && (order.status === "accepted" || order.status === "in_progress") && (
            <button
              type="button"
              onClick={() => setSafetyOpen(true)}
              aria-label={t("safety.button")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-bg shadow-softer transition-opacity hover:opacity-90 ios:h-9 ios:w-9"
            >
              <ShieldCheck className="h-5 w-5" />
            </button>
          )
        }
      />

      <div className="scroll-pb-bar flex-1 overflow-y-auto overscroll-contain px-4">
        <div className="relative mb-4 h-48 overflow-hidden rounded-2xl">
          {/* Live map: the route and the driver's car as its position arrives. The drawn map is the fallback. */}
          <TrackMap
            order={order}
            fallback={<StaticMap showCar={order.status === "in_progress" || order.status === "accepted"} carProgress={order.status === "in_progress" ? tripProgress : 0.08} dim={order.status === "searching"} />}
          />
        </div>

        {order.status === "searching" && !showNoDriver && (
          <>
          <div className="flex flex-col items-center gap-4 py-6 text-center animate-fade-in">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-accent-10 animate-pulse-ring" />
              <span className="absolute inset-0 rounded-full bg-accent-10 animate-pulse-ring [animation-delay:0.7s]" />
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-10 text-accent">
                <Search className="h-7 w-7" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-ink">{t("track.searching")}</p>
              <p className="mt-1 text-sm text-ink/60 tabular">{formatClock(elapsed)}</p>
            </div>
          </div>
          {/* The real backend allows edits while the order is searching. */}
          {api.capabilities.orderDetails && order.editable && (
            <Button fullWidth variant="secondary" onClick={() => setDetailsOpen(true)}>
              {t("track.details")}
            </Button>
          )}
          </>
        )}

        {order.status === "cancelled" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
              <X className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold text-ink">{t("track.cancelledTitle")}</p>
              {order.cancelReason && <p className="mt-1 max-w-[260px] text-sm text-ink/60">{t(order.cancelReason as TranslationKey)}</p>}
            </div>
          </div>
        )}

        {showNoDriver && (
          <div className="flex flex-col items-center gap-4 py-6 text-center animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
              <SearchX className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold text-ink">{t("track.noDriverTitle")}</p>
              <p className="mt-1 max-w-[260px] text-sm text-ink/60">{t("track.noDriverDesc")}</p>
            </div>
          </div>
        )}

        {(order.status === "accepted" || order.status === "in_progress") && order.driver && (
          <div className="space-y-4 animate-slide-up">
            <DriverCard driver={order.driver} />
            {/* Unset verdicts (sample data) keep the button; a server that
                allows neither editing nor cancelling hides it. */}
            {api.capabilities.orderDetails && (order.editable || order.canCancel !== false) && (
              <Button fullWidth variant="secondary" onClick={() => setDetailsOpen(true)}>
                {t("track.details")}
              </Button>
            )}
            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold text-ink/60">{t("track.statusTitle")}</p>
              {order.driverArrived && (
                <p className="mb-3 text-sm font-semibold text-ink" role="status">
                  {t("track.arrived")}
                </p>
              )}
              <ol className="flex items-start">
                {STATUS_STEPS.map((step, i) => {
                  // "Arrived" completes the "on the way" step.
                  const activeIdx = order.status === "accepted" ? (order.driverArrived ? 1 : 0) : 2;
                  const done = i <= activeIdx;
                  const Icon = step.icon;
                  return (
                    <li key={step.key} className="relative flex flex-1 flex-col items-center gap-2 text-center">
                      {i > 0 && (
                        <span
                          aria-hidden="true"
                          className={`absolute top-3.5 h-0.5 -translate-y-1/2 ${done ? "bg-accent" : "bg-border"}`}
                          style={{ left: "calc(-50% + 18px)", right: "calc(50% + 18px)" }}
                        />
                      )}
                      <span
                        className={`relative flex h-7 w-7 items-center justify-center rounded-full ${
                          done ? "bg-accent text-bg" : "bg-ink/5 text-ink/60"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="px-1 text-xs text-ink/70">{t(step.labelKey)}</span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </div>
        )}
      </div>

      <BottomBar>
        {showNoDriver ? (
          api.capabilities.repeatOrder ? (
            <Button fullWidth loading={retrying} onClick={retrySearch}>
              {t("common.retry")}
            </Button>
          ) : (
            <Button fullWidth variant="secondary" onClick={() => navigate("/home", { replace: true })}>
              {t("common.back")}
            </Button>
          )
        ) : order.status === "cancelled" ? (
          <Button fullWidth variant="secondary" onClick={() => navigate("/home", { replace: true })}>
            {t("common.back")}
          </Button>
        ) : order.status === "searching" ? (
          order.canCancel !== false ? (
            <Button fullWidth variant="secondary" onClick={() => setCancelOpen(true)}>
              {t("cancel.confirmAction")}
            </Button>
          ) : (
            <span className="block text-center text-sm font-semibold tabular text-ink">{formatSom(order.price, intlTag)}</span>
          )
        ) : order.status === "accepted" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold tabular text-ink">{formatSom(order.price, intlTag)}</span>
            {/* The server's verdict; unset (sample data) = cancel allowed here. */}
            {order.canCancel !== false && (
              <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>
                {t("cancel.confirmAction")}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink/60">{t("track.inProgress")}</span>
            <span className="text-sm font-semibold tabular text-ink">{formatSom(order.price, intlTag)}</span>
          </div>
        )}
      </BottomBar>

      {cancelOpen && (
        <CancelSheet loading={cancelling} onClose={() => setCancelOpen(false)} onConfirm={confirmCancel} />
      )}
      {detailsOpen && (
        <Suspense fallback={null}>
          <TafsilotlarSheet
            order={order}
            onClose={() => setDetailsOpen(false)}
            onUpdated={(updated) => {
              setOrder(updated);
              setDetailsOpen(false);
            }}
            onCancel={() => {
              setDetailsOpen(false);
              setCancelOpen(true);
            }}
          />
        </Suspense>
      )}
      {safetyOpen && <SafetySheet orderId={orderId} onClose={() => setSafetyOpen(false)} onToast={setToast} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
