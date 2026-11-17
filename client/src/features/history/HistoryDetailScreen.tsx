import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Star, Lock, HelpCircle } from "@/lib/icons";
import { api } from "@/api/client";
import type { OrderWithDetails } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { StaticMap } from "@/components/StaticMap";
import { TrackMap } from "@/features/order/TrackMap";
import { SkeletonList } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { formatSom, formatKm, formatRelativeDay, formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { serverErrorKey } from "@/lib/apiError";
import { RatingReasonsSheet } from "./RatingReasonsSheet";
import { TipCard } from "@/features/order/TipCard";

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
  const { t, intlTag } = useT();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [pendingFive, setPendingFive] = useState(false);
  const [ratingError, setRatingError] = useState<string | false>(false);

  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoadError(false);
    api.getOrder(orderId).then(setOrder).catch(() => setLoadError(true));
  }

  useEffect(load, [orderId]);

  async function rate(value: number, reasons?: string[], note?: string) {
    if (!order) return;
    setRatingError(false);
    try {
      const updated = await api.rateOrder(orderId, value, reasons, note);
      setOrder(updated);
    } catch (e) {
      setRatingError(serverErrorKey(e) ?? "order.submitError");
    }
  }

  function onStarClick(value: number) {
    if (!order?.ratingEditable) return;
    if (value === 5) setPendingFive(true);
    else rate(value);
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title={t("history.detailTitle")} />
        {loadError ? <ErrorState onRetry={load} /> : <div className="px-4 pt-4"><SkeletonList count={2} /></div>}
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <ScreenHeader title={t("history.detailTitle")} />
      <div className="scroll-pb flex-1 overflow-y-auto overscroll-contain px-4">
        <div className="relative mb-4 h-40 overflow-hidden rounded-2xl">
          <TrackMap order={order} interactive={false} fallback={<StaticMap />} />
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
            <Avatar seed={order.driver.avatarSeed} name={order.driver.name || t("driver.unnamed")} size={44} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{order.driver.name || t("driver.unnamed")}</p>
              {(order.driver.carModel || order.driver.plate) && (
                <p className="text-xs text-ink/60">
                  {[order.driver.carModel, order.driver.plate].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </Card>
        )}

        <Card className="space-y-3 p-5">
          <p className="text-xs font-semibold text-ink/60">{t("history.paymentTitle")}</p>
          <Row label={t("history.serviceType")} value={order.mode === "car" ? t("order.wholeCar") : t("order.perSeat")} />
          <Row label={t("history.paymentMethod")} value={order.paymentMethod === "cash" ? t("order.cash") : t("order.card")} />
          {order.cancelReason && (
            <Row label={t("history.cancelReason")} value={t(order.cancelReason as TranslationKey)} />
          )}
          <div className="h-px bg-border" />
          {/* The server's breakdown (sums to the total), when it sends one. */}
          {order.priceLines?.map((line, i) => (
            <Row key={i} label={t(line.key as TranslationKey, line.params)} value={formatSom(line.amount, intlTag)} />
          ))}
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
                  className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      order.rating && v <= order.rating ? "fill-brand-yellow text-brand-yellow" : "text-ink/20"
                    }`}
                  />
                </button>
              ))}
            </div>
            {!order.ratingEditable && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-normal text-ink/60">
                <Lock className="h-3.5 w-3.5" /> {t("history.rating.lockedReason")}
              </p>
            )}
            {ratingError && <p className="mt-3 text-center text-xs font-normal text-danger">{t(ratingError as TranslationKey)}</p>}
          </Card>
        )}

        {api.capabilities.tips && order.status === "completed" && order.driver && <TipCard orderId={orderId} className="mt-4" />}

        {api.capabilities.help && (
          <Link
            to="/help"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-ink/5 py-3.5 text-sm font-semibold text-ink/80"
          >
            <HelpCircle className="h-4 w-4" /> {t("history.help")}
          </Link>
        )}
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
