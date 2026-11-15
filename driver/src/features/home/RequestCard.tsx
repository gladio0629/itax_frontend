import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { RideRequest } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { formatAmount } from "@/lib/format";
import { sinceTime } from "@/lib/relative";
import { AlertTriangle, Banknote, CalendarDays, Car, CreditCard, MapPin, Route, Truck, Users } from "@/lib/icons";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { RouteLine } from "./RouteLine";
import { CommentNote, FreightGrid, FreightTags, OptionChips, OrderTags, Tag } from "./OrderDetails";
import { dayText, timeText } from "./whenText";

type Props = {
  request: RideRequest;
  accepting: boolean;
  /** "taken": another driver got it; "out": accepted/rejected here — both slide away. */
  leaving: "taken" | "out" | null;
  highlight?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onGone: () => void;
};

/** One request in the feed. Everything shown is the adapter's: price, net, block reason. */
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
  const PayIcon = r.payment === "cash" ? Banknote : CreditCard;
  const route = `${r.pickup.city.name} – ${r.dropoff.city.name}`;
  const block = r.acceptBlock;

  return (
    <article
      id={`req-${r.id}`}
      aria-label={t("feed.cardLabel", { route })}
      className={cn(
        "relative overflow-clip rounded-card bg-surface p-4 shadow-1 transition-[opacity,transform] duration-300",
        sliding ? "translate-x-[110%] opacity-0" : "animate-fade-up",
        highlight && "ring-2 ring-yellow"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Tag icon={cargo ? Truck : r.wholeCar ? Car : Users} tone="yellow">
          {cargo ? t("feed.kind.cargo") : r.wholeCar ? t("feed.wholeCar") : t("feed.seats", { n: r.seats })}
        </Tag>
        <span className="tabular shrink-0 text-xs text-muted">{sinceTime(r.postedAt, t)}</span>
      </div>

      <RouteLine
        pickup={r.pickup}
        dropoff={r.dropoff}
        stops={r.stops}
        size="md"
        pickupLabel={cargo ? t("order.loadAt") : t("offer.pickup")}
        dropoffLabel={cargo ? (r.stops.length ? t("order.dropN", { n: r.stops.length + 1 }) : t("order.unload")) : t("offer.dropoff")}
        stopLabel={(n) => (cargo ? t("order.dropN", { n }) : t("order.stop", { n }))}
      />

      <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t("feed.when")}</dt>
          <CalendarDays className="h-4 w-4 text-muted" />
          <dd className="tabular font-bold text-ink">
            {dayText(r.when, t)}, {timeText(r.when, t)}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t("feed.toPickup")}</dt>
          <MapPin className="h-4 w-4 text-muted" />
          <dd className="tabular text-ink">{t("feed.kmAway", { km: r.pickupDistanceKm })}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t("offer.distance")}</dt>
          <Route className="h-4 w-4 text-muted" />
          <dd className="tabular text-ink">{r.distanceKm}&nbsp;{t("common.km")}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t("feed.payment")}</dt>
          <PayIcon className="h-4 w-4 text-muted" />
          <dd className="text-ink">{r.payment === "cash" ? t("pay.cash") : t("pay.card")}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <OrderTags carClass={r.carClass} forOther={r.forOther}>
          {r.freight && <FreightTags freight={r.freight} />}
        </OrderTags>
      </div>
      {cargo && r.cargo && isKey(r.cargo.labelKey) && (
        <p className="mt-2 text-sm text-muted">{t("offer.cargo", { label: t(r.cargo.labelKey), kg: r.cargo.weightKg })}</p>
      )}
      {r.freight && (
        <div className="mt-3">
          <FreightGrid freight={r.freight} />
        </div>
      )}
      {(r.options.length > 0 || r.luggageCount > 0) && (
        <div className="mt-3">
          <OptionChips options={r.options} luggageCount={r.luggageCount} />
        </div>
      )}
      {r.comment && (
        <div className="mt-3">
          <CommentNote text={r.comment} clamp />
        </div>
      )}

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-3">
        <div className="min-w-0">
          <p className="tabular text-2xl font-bold text-gold">
            {formatAmount(r.price)}
            <span className="ml-1 text-sm font-medium text-muted">{t("common.som")}</span>
          </p>
          <p className="tabular text-sm text-muted">{t("feed.net", { amount: formatAmount(r.earnings.net), pct: r.earnings.commissionPct })}</p>
        </div>
      </div>

      {block && (
        <p role="note" className="mt-3 flex items-start gap-2 rounded-button bg-warning/10 px-3 py-2 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            {isKey(block.reasonKey) ? t(block.reasonKey, block.params) : block.reasonKey}
            {block.action === "wallet" && (
              <>
                {" "}
                <Link to="/wallet/topup" className="font-bold text-accent underline underline-offset-2">
                  {t("feed.toWallet")}
                </Link>
              </>
            )}
          </span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-[2fr_1fr] gap-2">
        <Button size="lg" loading={accepting} disabled={!!block || taken || !!leaving} onClick={onAccept}>
          {t("feed.accept")}
        </Button>
        <Button size="lg" variant="secondary" className="px-3" disabled={accepting || taken || !!leaving} onClick={onReject}>
          {t("feed.reject")}
        </Button>
      </div>

      {taken && (
        <div role="status" className="absolute inset-0 flex animate-fade-in items-start justify-center bg-bg/80 pt-16 backdrop-blur-[2px]">
          <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-base font-bold text-ink shadow-2">
            <Car className="h-5 w-5 text-warning" />
            {t("feed.taken")}
          </span>
        </div>
      )}
    </article>
  );
}
