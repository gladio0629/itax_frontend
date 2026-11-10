import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Star, Lock, RotateCcw, HelpCircle } from "lucide-react";
import { api } from "@/api/client";
import type { OrderWithDetails } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { MapView } from "@/components/MapView";
import { SkeletonList } from "@/components/Skeleton";
import { formatSom, formatKm, formatRelativeDay, formatTime } from "@/lib/format";
import { useOrderStore } from "@/stores/orderStore";
import { defaultAddressesForCity } from "@/clientData/addresses";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { RatingReasonsSheet } from "./RatingReasonsSheet";

const STATUS_LABEL_KEY: Record<string, TranslationKey> = {
  completed: "history.status.completed",
  cancelled: "history.status.cancelled",
  no_driver: "history.status.noDriver",
  in_progress: "history.status.inProgress",
  accepted: "history.status.accepted",
  searching: "history.status.searching",
};

export function HistoryDetailScreen() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const { t, intlTag } = useT();
  const { setField } = useOrderStore();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [pendingFive, setPendingFive] = useState(false);
  const [ratingError, setRatingError] = useState(false);

  function load() {
    api.getOrder(orderId).then(setOrder);
  }

  useEffect(load, [orderId]);

  async function rate(value: number, reasons?: string[], note?: string) {
    if (!order) return;
    setRatingError(false);
    try {
      const updated = await api.rateOrder(orderId, value, reasons, note);
      setOrder(updated);
    } catch {
      setRatingError(true);
    }
  }

  function onStarClick(value: number) {
    if (!order?.ratingEditable) return;
    if (value === 5) setPendingFive(true);
    else rate(value);
  }

  function reorder() {
    if (!order) return;
    const fromAddr = defaultAddressesForCity(order.fromCityId)[0];
    const toAddr = defaultAddressesForCity(order.toCityId)[0];
    if (fromAddr) setField("fromAddressId", fromAddr.id);
    if (toAddr) setField("toAddressId", toAddr.id);
    navigate("/home");
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title={t("history.detailTitle")} />
        <div className="px-4 pt-4">
          <SkeletonList count={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <ScreenHeader title={t("history.detailTitle")} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="relative mb-4 h-40 overflow-hidden rounded-2xl">
          <MapView />
        </div>

        <Card className="mb-4 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              {order.fromCity.name} &rarr; {order.toCity.name}
            </p>
            <Badge tone={order.status === "completed" ? "accent" : order.status === "cancelled" ? "danger" : "neutral"}>
              {t(STATUS_LABEL_KEY[order.status] ?? "history.status.searching")}
            </Badge>
          </div>
          <p className="text-xs text-ink/60">
            {formatRelativeDay(order.createdAt, intlTag)} &middot; {formatTime(order.createdAt)} &middot;{" "}
            {formatKm(order.distanceKm, intlTag)}
          </p>
        </Card>

        {order.driver && (
          <Card className="mb-4 flex items-center gap-3 p-4">
            <Avatar seed={order.driver.avatarSeed} name={order.driver.name} size={44} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{order.driver.name}</p>
              <p className="text-xs text-ink/60">
                {order.driver.carModel} &middot; {order.driver.plate}
              </p>
            </div>
          </Card>
        )}

        <Card className="space-y-3 p-5">
          <p className="text-xs font-semibold text-ink/60">{t("history.paymentTitle")}</p>
          <Row label={t("history.serviceType")} value={order.mode === "car" ? t("order.wholeCar") : t("order.perSeat")} />
          <Row label={t("history.paymentMethod")} value={order.paymentMethod === "cash" ? t("order.cash") : t("order.card")} />
          {order.cancelReason && <Row label={t("history.cancelReason")} value={order.cancelReason} />}
          <div className="h-px bg-border" />
          <Row label={t("order.total")} value={formatSom(order.price, intlTag)} bold />
        </Card>

        {order.status === "completed" && order.driver && (
          <Card className="mt-4 p-5">
            <p className="mb-3 text-center text-sm font-semibold text-ink">{t("history.rateTitle")}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  disabled={!order.ratingEditable}
                  onClick={() => onStarClick(v)}
                  aria-label={`${v} ★`}
                  className="p-1 disabled:opacity-40"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      order.rating && v <= order.rating ? "fill-warning text-warning" : "text-ink/20"
                    }`}
                  />
                </button>
              ))}
            </div>
            {!order.ratingEditable && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-ink/60">
                <Lock className="h-3.5 w-3.5" /> {t("history.rating.lockedReason")}
              </p>
            )}
            {ratingError && <p className="mt-3 text-center text-xs font-medium text-danger">{t("order.submitError")}</p>}
          </Card>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={reorder}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent-5 py-3.5 text-sm font-semibold text-accent"
          >
            <RotateCcw className="h-4 w-4" /> {t("history.reorder")}
          </button>
          <button
            onClick={() => navigate("/help")}
            className="flex items-center justify-center gap-2 rounded-xl bg-ink/5 py-3.5 text-sm font-semibold text-ink/80"
          >
            <HelpCircle className="h-4 w-4" /> {t("history.help")}
          </button>
        </div>
      </div>

      {pendingFive && (
        <RatingReasonsSheet
          onClose={() => setPendingFive(false)}
          onSubmit={(reasons, note) => {
            setPendingFive(false);
            rate(5, reasons, note);
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink/60">{label}</span>
      <span className={`text-sm tabular ${bold ? "font-semibold text-ink" : "text-ink/80"}`}>{value}</span>
    </div>
  );
}
