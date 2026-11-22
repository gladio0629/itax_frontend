import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import type { OrderWithDetails, TipOptions } from "@/api/types";
import { formatKm, formatLongDate, formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { Icon, PrimaryButton, Screen, SectionLabel, StateError, StateLoading } from "@/ui";
import { MapCanvas } from "@/components/MapCanvas";
import { TrackMap } from "@/features/order/TrackMap";
import { DriverAvatar, payLabel, shortName } from "@/features/live/LiveParts";

const LIVE = new Set(["searching", "accepted", "in_progress"]);
const STATUS_KEY: Record<string, TranslationKey> = {
  completed: "history.status.completed",
  cancelled: "history.status.cancelled",
  no_driver: "history.status.noDriver",
  in_progress: "history.status.inProgress",
  accepted: "history.status.accepted",
  searching: "history.status.searching",
};

const hhmm = (ts: number) => new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[14px]">
      <span className="text-iz-muted">{label}</span>
      <span className="text-right font-bold text-iz-ink">{value}</span>
    </div>
  );
}

/** Small plate, as on the detail card (design HistoryDetail). */
function SmallPlate({ plate }: { plate: string }) {
  const m = /^\s*(\d{2})\s*(.+?)\s*$/.exec(plate);
  return (
    <span className="flex h-[34px] shrink-0 items-center rounded-[9px] border-2 border-iz-plate-ink bg-iz-plate text-[13px] font-extrabold tracking-[0.5px] text-iz-plate-ink">
      {m ? (
        <>
          <span className="flex h-full items-center border-r-2 border-iz-plate-ink px-[7px]">{m[1]}</span>
          <span className="whitespace-nowrap px-2">{m[2]}</span>
        </>
      ) : (
        <span className="whitespace-nowrap px-2">{plate}</span>
      )}
    </span>
  );
}

/**
 * One past order (design v2: HistoryDetail): the trip's times and places,
 * the driver, your rating (changed on the Rate screen), the route on the
 * map, the server's price lines and total, the tip, and help.
 */
export function HistoryDetailScreen() {
  const { orderId = "" } = useParams();
  const { t, intlTag } = useT();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tips, setTips] = useState<TipOptions | null>(null);

  function load() {
    setLoadError(false);
    api.getOrder(orderId).then(setOrder).catch(() => setLoadError(true));
    if (api.capabilities.tips) api.getTipOptions(orderId).then(setTips).catch(() => setTips(null));
  }
  useEffect(load, [orderId]);

  if (!order) {
    return (
      <Screen title={t("history.detailTitle")}>
        {loadError ? <StateError onRetry={load} /> : <StateLoading rows={3} />}
      </Screen>
    );
  }

  const d = new Date(order.createdAt);
  const title = `${formatLongDate(d, intlTag)}, ${d.getFullYear()}`;
  const delivery = order.extras?.serviceType === "delivery";
  const fromLabel = order.extras?.fromAddressId ? api.addressById(order.extras.fromAddressId)?.label : undefined;
  const toLabel = order.extras?.toAddressId ? api.addressById(order.extras.toAddressId)?.label : undefined;
  // "Toshkent — Avtovokzal" → the place part under the city.
  const place = (label: string | undefined, city: string) => (label?.startsWith(city) ? label.slice(city.length).replace(/^\s*[—-]\s*/, "") : label ?? "");
  const driver = order.driver;
  const rated = !!order.rating;
  const canRate = order.status === "completed" && !!driver && order.ratingEditable;
  const canTip = !!tips?.allowed && !tips.sent;
  const live = LIVE.has(order.status);

  const end = (side: "from" | "to") => {
    const ts = side === "from" ? order.startedAt : order.finishedAt;
    const city = side === "from" ? order.fromCity.name : order.toCity.name;
    const sub = place(side === "from" ? fromLabel : toLabel, city);
    return (
      <span className={cn("flex min-w-0 flex-col gap-[3px]", side === "to" && "items-end text-right")}>
        <span className="text-[26px] font-extrabold leading-[30px] tabular-nums text-iz-head-text">{ts ? hhmm(ts) : "—"}</span>
        <span className="max-w-full truncate text-[15px] font-extrabold text-iz-head-text">{city}</span>
        {sub && <span className="max-w-full truncate text-[12px] text-iz-head-muted">{sub}</span>}
      </span>
    );
  };

  return (
    <Screen
      title={title}
      top={
        <div className="flex items-center gap-3 rounded-iz-card bg-iz-head-card p-[18px]">
          {end("from")}
          <span aria-hidden className="flex min-w-9 flex-1 items-center gap-1.5">
            <span className="h-0 flex-1 border-t-2 border-dashed border-iz-head-border-strong" />
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-iz-green text-iz-on-green">
              <Icon name={delivery ? "box" : "car"} size={16} />
            </span>
            <span className="h-0 flex-1 border-t-2 border-dashed border-iz-head-border-strong" />
          </span>
          {end("to")}
        </div>
      }
      bodyClassName="gap-3.5 pt-6"
    >
      {order.status !== "completed" && (
        <div className={cn("flex flex-col gap-1 rounded-[22px] px-4 py-3.5", order.status === "cancelled" ? "bg-iz-danger-soft" : "bg-iz-field")}>
          <span className={cn("text-[15px] font-extrabold", order.status === "cancelled" ? "text-iz-danger" : "text-iz-ink")}>{t(STATUS_KEY[order.status] ?? "history.status.searching")}</span>
          {order.cancelReason && <span className="text-[13px] text-iz-ink">{t(order.cancelReason as TranslationKey)}</span>}
        </div>
      )}
      {live && (
        <PrimaryButton icon="map" onClick={() => navigate(`/order/track/${order.id}`)}>
          {t("history.track")}
        </PrimaryButton>
      )}

      {driver && (
        <div className="flex items-center gap-3.5 rounded-[22px] bg-iz-field p-3.5">
          <DriverAvatar name={driver.name || t("driver.unnamed")} size={52} tone="dark" />
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="truncate text-[16px] font-extrabold text-iz-ink">{driver.name ? shortName(driver.name) : t("driver.unnamed")}</span>
            {(driver.carModel || driver.carColor) && (
              <span className="truncate text-[13px] font-semibold text-iz-muted">{[driver.carModel, driver.carColor].filter(Boolean).join(", ")}</span>
            )}
          </div>
          {driver.plate && <SmallPlate plate={driver.plate} />}
        </div>
      )}

      {order.status === "completed" && driver && (
        <div className="flex items-center justify-between gap-3 rounded-[22px] border border-iz-border py-3.5 pl-4 pr-3.5">
          <span className="flex min-w-0 flex-col gap-1.5">
            <SectionLabel>{t("history.yourRating")}</SectionLabel>
            {rated ? (
              <span className="flex min-w-0 items-center gap-2">
                <span role="img" aria-label={t("rate.star", { n: order.rating ?? 0 })} className="flex shrink-0 gap-0.5">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <Icon key={v} name="star" size={16} filled className={v <= (order.rating ?? 0) ? "text-iz-ink" : "text-iz-chip-border"} />
                  ))}
                </span>
                {order.ratingReasons?.[0] && <span className="truncate text-[13px] font-bold text-iz-ink">{t(order.ratingReasons[0] as TranslationKey)}</span>}
              </span>
            ) : (
              <span className="text-[13px] font-semibold text-iz-muted">{canRate ? t("history.notRated") : "—"}</span>
            )}
            {order.ratingComment && <span className="line-clamp-2 text-[13px] text-iz-muted">{order.ratingComment}</span>}
            {!order.ratingEditable && (
              <span className="flex items-center gap-1.5 text-[12px] text-iz-muted">
                <Icon name="lock" size={14} />
                {t("history.rating.lockedReason")}
              </span>
            )}
          </span>
          {/* The rating has its own time limit; a tip is the server's call
              (tips.allowed), on the same screen, at any age. */}
          {(canRate || canTip) && (
            <Link
              to={`/order/finished/${order.id}?from=history`}
              className="flex h-11 shrink-0 items-center rounded-full bg-iz-selected px-4 text-[13px] font-extrabold text-iz-on-selected active:opacity-80"
            >
              {canRate ? (rated ? t("live.edit") : t("history.rate")) : t("history.tip")}
            </Link>
          )}
        </div>
      )}

      {/* The route on the map (current app); the drawn map without Mapbox. */}
      <div className="relative h-[140px] shrink-0 overflow-hidden rounded-[22px] bg-iz-map">
        <TrackMap order={order} interactive={false} fallback={<MapCanvas route className="absolute inset-0" />} />
      </div>

      <div className="flex flex-col gap-3 rounded-[22px] bg-iz-field p-4">
        {delivery ? (
          <Row label={t("history.body")} value={order.cargoSize ?? "—"} />
        ) : (
          <Row label={t("history.seat")} value={order.mode === "car" ? t("live.wholeCar") : t("live.people", { n: Math.max(1, order.seatIds.length) })} />
        )}
        {order.distanceKm > 0 && <Row label={t("history.distance")} value={formatKm(order.distanceKm, intlTag)} />}
        <Row label={t("history.paymentMethod")} value={payLabel(order, t)} />
        {tips?.sent && <Row label={t("tip.title")} value={`${formatSom(tips.sent.amount, intlTag)} · ${t(`tip.status.${tips.sent.status}` as TranslationKey)}`} />}
        {order.priceLines && order.priceLines.length > 0 && (
          <>
            <span aria-hidden className="h-0 border-t-2 border-dashed border-iz-divider-in-field" />
            {order.priceLines.map((line, i) => (
              <Row key={i} label={t(line.key as TranslationKey, line.params)} value={formatSom(line.amount, intlTag)} />
            ))}
          </>
        )}
        <span aria-hidden className="h-0 border-t-2 border-dashed border-iz-divider-in-field" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-extrabold text-iz-ink">{t("pay.total")}</span>
          <span className="text-[24px] font-extrabold tabular-nums text-iz-ink">{formatSom(order.price, intlTag)}</span>
        </div>
      </div>

      {api.capabilities.help && (
        <Link
          to="/help?topic=trip"
          className="mt-auto flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-full border border-iz-chip-border text-[15px] font-extrabold text-iz-ink active:bg-iz-field"
        >
          <Icon name="support" size={18} />
          {t("history.helpTrip")}
        </Link>
      )}
    </Screen>
  );
}
