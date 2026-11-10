import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, SearchX, Check, Clock3, Navigation } from "lucide-react";
import { api } from "@/api/client";
import type { OrderWithDetails } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BottomBar } from "@/components/BottomBar";
import { Button } from "@/components/Button";
import { MapView } from "@/components/MapView";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { Toast } from "@/components/Toast";
import { formatClock, formatSom } from "@/lib/format";
import { useOrderStore } from "@/stores/orderStore";
import { defaultAddressesForCity } from "@/clientData/addresses";
import { useT } from "@/lib/i18n/provider";
import { DriverCard } from "./DriverCard";
import { CancelSheet } from "./CancelSheet";
import { TafsilotlarSheet } from "./TafsilotlarSheet";

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
    const interval = setInterval(poll, 1500);
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function retrySearch() {
    setRetrying(true);
    try {
      const fromAddressId =
        draft.fromAddressId || defaultAddressesForCity(order?.fromCityId ?? "")[0]?.id || "";
      const toAddressId =
        draft.toAddressId || defaultAddressesForCity(order?.toCityId ?? "")[0]?.id || "";
      const res = await api.createOrder({
        serviceType: draft.serviceType,
        fromAddressId,
        toAddressId,
        mode: order?.mode ?? draft.mode,
        seatIds: order?.seatIds ?? draft.seatIds,
        cargo: draft.cargo,
        paymentMethod: order?.paymentMethod ?? draft.paymentMethod,
        timing: draft.timing,
      });
      navigate(`/order/track/${res.id}`, { replace: true });
    } catch {
      setToast(t("track.retryError"));
    } finally {
      setRetrying(false);
    }
  }

  async function confirmCancel(reason: string) {
    setCancelling(true);
    try {
      await api.cancelOrder(orderId, reason);
      navigate("/home", { replace: true });
    } catch {
      setToast(t("track.cancelError"));
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

  const timedOut = order.status === "searching" && elapsed >= SEARCH_TIMEOUT_S;
  const showNoDriver = order.status === "no_driver" || timedOut;

  let tripProgress = 0.5;
  if (order.timeline?.tripStartsAt && order.timeline?.tripEndsAt) {
    const { tripStartsAt, tripEndsAt } = order.timeline;
    tripProgress = Math.min(1, Math.max(0, (Date.now() - tripStartsAt) / (tripEndsAt - tripStartsAt)));
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <ScreenHeader title={showNoDriver ? t("track.notFound") : t("track.title")} />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="relative mb-4 h-48 overflow-hidden rounded-2xl">
          <MapView showCar={order.status === "in_progress" || order.status === "accepted"} carProgress={order.status === "in_progress" ? tripProgress : 0.08} dim={order.status === "searching"} />
        </div>

        {order.status === "searching" && !showNoDriver && (
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
            <Button fullWidth variant="secondary" onClick={() => setDetailsOpen(true)}>
              {t("track.details")}
            </Button>
            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold text-ink/60">{t("track.statusTitle")}</p>
              <div className="flex items-center justify-between">
                {STATUS_STEPS.map((step, i) => {
                  const activeIdx = order.status === "accepted" ? 0 : 2;
                  const done = i <= activeIdx;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex w-full items-center">
                        {i > 0 && <span className={`h-0.5 flex-1 ${done ? "bg-accent" : "bg-border"}`} />}
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            done ? "bg-accent text-bg" : "bg-ink/5 text-ink/60"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        {i === 0 && <span className="h-0.5 flex-1" />}
                      </div>
                      <span className="text-[10px] text-ink/60 text-center">{t(step.labelKey)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </div>

      <BottomBar>
        {showNoDriver ? (
          <Button fullWidth loading={retrying} onClick={retrySearch}>
            {t("common.retry")}
          </Button>
        ) : order.status === "searching" ? (
          <Button fullWidth variant="secondary" onClick={() => setCancelOpen(true)}>
            {t("cancel.confirmAction")}
          </Button>
        ) : order.status === "accepted" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold tabular text-ink">{formatSom(order.price, intlTag)}</span>
            <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>
              {t("cancel.confirmAction")}
            </Button>
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
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
