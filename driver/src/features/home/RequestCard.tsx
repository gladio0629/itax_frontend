import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { RideRequest } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { formatAmount } from "@/lib/format";
import { sinceTime } from "@/lib/relative";
import { AlertTriangle, Armchair, ArrowRight, Car, Package, User } from "@/lib/icons";
import { Button } from "@/components/Button";
import { Tag } from "@/components/Chip";
import { cn } from "@/lib/cn";
import { RouteTimeline, joinDots } from "@/features/trip/parts";
import { timeText } from "./whenText";

type Props = {
  request: RideRequest;
  accepting: boolean;
  /** "taken": another driver got it; "out": accepted/rejected here — both slide away. */
  leaving: "taken" | "out" | null;
  highlight?: boolean;
  onAccept: () => void;
  /** Absent when the backend can't hide a request for one driver. */
  onReject?: () => void;
  onGone: () => void;
};

/**
 * One request in the Home list (design v2). Everything shown is the
 * server's: price, seats, payment, block reason. Tapping the card opens the
 * Request / OrderDetail screen; "Qabul qilish" accepts right here.
 */
export function RequestCard({ request: r, accepting, leaving, highlight, onAccept, onReject, onGone }: Props) {
  const { t } = useT();
  const taken = leaving === "taken" || r.status === "taken";
  const [sliding, setSliding] = useState(false);

  // "Boshqa haydovchi oldi" stays readable for a moment, then the card slides away.
  useEffect(() => {
    if (!taken && leaving !== "out") return;
    const a = setTimeout(() => setSliding(true), taken ? 2200 : 0);
    const b = setTimeout(onGone, taken ? 2500 : 300);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken, leaving]);

  const cargo = r.kind === "delivery";
  const block = r.acceptBlock;
  const pay = r.payment ? (r.payment === "cash" ? t("pay.cash").toLowerCase() : t("pay.card").toLowerCase()) : null;
  const sub = cargo
    ? joinDots([r.freight && t("feed.bodyShort", { size: r.freight.body.sizeLabel }), pay])
    : joinDots([r.wholeCar ? t("feed.wholeCar") : t("feed.seatsShort", { n: r.seats }), pay]);
  // Which seats the passenger booked, as the server lists them ("Old o'rindiq, Orqa chap").
  const seatNames = !cargo && r.seatIds?.length ? r.seatIds.map((x) => t(`seat.${x}`)).join(", ") : null;
  const points = [
    { kind: "pickup" as const, label: cargo ? t("cargoReq.load") : t("request.pickup"), place: r.pickup },
    { kind: "dropoff" as const, label: cargo ? t("cargoReq.drop") : t("request.dropoff"), place: r.dropoff },
  ];

  return (
    <article
      id={`req-${r.id}`}
      aria-label={t("feed.cardLabel", { route: `${r.pickup.city.name} – ${r.dropoff.city.name}` })}
      className={cn(
        "relative flex flex-col gap-3.5 overflow-clip rounded-card bg-surface p-4 transition-[opacity,transform] duration-300",
        highlight ? "border-2 border-ink" : "border border-line",
        sliding ? "translate-x-[110%] opacity-0" : "animate-fade-up"
      )}
    >
      <Link to={`/request/${r.id}`} aria-label={t("feed.openRequest")} className="focus-inset absolute inset-0 z-0 rounded-card" />

      <div className="pointer-events-none relative flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {cargo ? (
            <Tag tone="night">
              <Package className="h-3.5 w-3.5" />
              {t("feed.kind.delivery")}
            </Tag>
          ) : (
            <Tag tone="brand">
              {r.wholeCar ? <Car className="h-3.5 w-3.5" /> : <Armchair className="h-3.5 w-3.5" />}
              {t("feed.kind.passengers")}
            </Tag>
          )}
          {r.when && <span className="tabular truncate text-13 font-bold text-muted">{timeText(r.when, t)}</span>}
        </span>
        <span className="tabular shrink-0 text-13 font-bold text-muted">
          {r.distanceKm}&nbsp;{t("common.km")}
          {r.postedAt != null && !r.when && <> · {sinceTime(r.postedAt, t)}</>}
        </span>
      </div>

      <div className="pointer-events-none relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <RouteTimeline points={points} compact />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="tabular whitespace-nowrap text-[22px] font-extrabold leading-7 text-ink">
            {formatAmount(r.price)} <span className="text-13 font-bold text-muted">{t("common.som")}</span>
          </span>
          <span className="text-xs font-semibold text-muted">{sub}</span>
        </div>
      </div>

      {(seatNames || r.luggageCount > 0 || r.forOther || (cargo && r.freight) || r.stops.length > 0 || (cargo && r.cargo && isKey(r.cargo.labelKey))) && (
        <div className="pointer-events-none relative flex flex-wrap gap-1.5">
          {seatNames && (
            <Tag>
              <Armchair className="h-3.5 w-3.5" />
              <span className="sr-only">{t("feed.seatIds", { seats: seatNames })}</span>
              <span aria-hidden="true">{seatNames}</span>
            </Tag>
          )}
          {r.stops.length > 0 && <Tag>{t("order.stops")}: {r.stops.length}</Tag>}
          {r.luggageCount > 0 && <Tag>{t("order.luggage", { n: r.luggageCount })}</Tag>}
          {r.forOther && (
            <Tag>
              <User className="h-3.5 w-3.5" />
              {r.forOther.name}
            </Tag>
          )}
          {cargo && r.freight && r.freight.loaders > 0 && <Tag>{t("feed.loadersN", { n: r.freight.loaders })}</Tag>}
          {cargo && r.cargo && isKey(r.cargo.labelKey) && <Tag>{t(r.cargo.labelKey)}</Tag>}
        </div>
      )}

      {block && (
        <p role="note" className="relative flex items-start gap-2 rounded-field bg-warning-soft px-3 py-2.5 text-13 font-semibold text-ink">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-warning" />
          <span>
            {isKey(block.reasonKey) ? t(block.reasonKey, block.params) : block.reasonKey}
            {block.action === "wallet" && (
              <>
                {" "}
                <Link to="/wallet/topup" className="font-bold text-brand-ink underline underline-offset-2">
                  {t("feed.toWallet")}
                </Link>
              </>
            )}
          </span>
        </p>
      )}

      <div className={cn("relative grid gap-2.5", onReject ? "grid-cols-2" : "grid-cols-1")}>
        {onReject && (
          <Button variant="secondary" disabled={accepting || taken || !!leaving} onClick={onReject}>
            {t("feed.reject")}
          </Button>
        )}
        <Button loading={accepting} disabled={!!block || taken || !!leaving} onClick={onAccept} className="font-extrabold">
          {t("feed.accept")}
          {!accepting && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      {taken && (
        <div role="status" className="absolute inset-0 z-10 flex animate-fade-in items-center justify-center bg-bg/80 backdrop-blur-[2px]">
          <span className="flex items-center gap-2 rounded-full bg-night px-4 py-2.5 text-sm font-bold text-white shadow-2">
            <Car className="h-5 w-5 text-warning-icon" />
            {t("feed.taken")}
          </span>
        </div>
      )}
    </article>
  );
}
