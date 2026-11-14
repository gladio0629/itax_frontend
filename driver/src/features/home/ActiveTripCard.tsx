import type { ActiveTrip } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { Link } from "react-router-dom";
import { Banknote, CreditCard, MessageCircle, Navigation, Route } from "@/lib/icons";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/Stars";
import { Money } from "@/components/Money";
import { formatDuration } from "@/lib/format";
import { TripSteps } from "./TripSteps";
import { PlaceDetails } from "./RouteLine";
import { CallButton, CommentNote, ContactList, FreightGrid, FreightTags, OptionChips, OrderTags } from "./OrderDetails";
import { cn } from "@/lib/cn";

type Props = {
  trip: ActiveTrip;
  confirming: boolean;
  onAction: () => void;
  onCancel: () => void;
  className?: string;
};

export function ActiveTripCard({ trip, confirming, onAction, onCancel, className }: Props) {
  const { t } = useT();
  const toPickup = trip.stage === "to_pickup";
  const target = toPickup ? trip.pickup : trip.dropoff;
  const PayIcon = trip.payment === "cash" ? Banknote : CreditCard;
  const points = trip.freight ? [...trip.stops, trip.dropoff] : trip.stops;

  return (
    <section aria-label={t("trip.active")} className={cn("animate-sheet-up rounded-sheet bg-surface p-4 shadow-2", className)}>
      <div className="flex items-center gap-3">
        <Avatar seed={trip.passenger.avatarSeed} name={trip.passenger.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{trip.passenger.name}</p>
          <Stars value={trip.passenger.rating} size={14} />
        </div>
        {trip.contactMode === "text" ? (
          // Text-only passenger: the call button becomes "Yozish" (chat).
          <Link
            to="/trip/chat"
            aria-label={t("trip.writeTo", { name: trip.passenger.name })}
            className="press flex h-12 shrink-0 items-center gap-2 rounded-full bg-accent/15 px-4 text-base font-bold text-accent"
          >
            <MessageCircle className="h-5 w-5" />
            {t("trip.write")}
          </Link>
        ) : (
          <CallButton name={trip.passenger.name} phoneMasked={trip.passenger.phoneMasked} />
        )}
      </div>

      <div className="mt-3">
        <OrderTags carClass={trip.carClass} forOther={trip.forOther}>
          {trip.freight && <FreightTags freight={trip.freight} />}
        </OrderTags>
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <Route className="h-4 w-4 shrink-0" />
        <span className="truncate">
          <span className="font-bold text-ink">{trip.pickup.city.name}</span>
          <span aria-hidden="true"> → </span>
          <span className="sr-only"> – </span>
          <span className="font-bold text-ink">{trip.dropoff.city.name}</span>
        </span>
      </p>

      <div className="mt-4">
        <TripSteps steps={trip.steps} />
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-card bg-raised p-3">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow text-on-yellow">
          <Navigation className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{toPickup ? t("trip.toPickup") : t("trip.toDropoff")}</p>
          <p className="truncate text-base font-bold text-ink">{target.city.name}</p>
          <p className="truncate text-sm text-muted">{target.address}</p>
          <PlaceDetails place={target} />
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-lg font-bold text-ink">
            {trip.remainingKm} <span className="text-xs font-medium text-muted">{t("common.km")}</span>
          </p>
          <p className="tabular text-xs text-muted">{formatDuration(trip.remainingMin, t)}</p>
        </div>
      </div>

      {/* Cargo: every drop-off in order. Passenger: the stops on the way. */}
      {points.length > 0 && (
        <section aria-labelledby={`${trip.id}-stops`} className="mt-3 px-1">
          <h3 id={`${trip.id}-stops`} className="text-xs text-muted">
            {trip.freight ? t("order.dropoffs") : t("order.stops")}
          </h3>
          <ol className="mt-1 space-y-1.5">
            {points.map((st, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="tabular w-4 shrink-0 font-bold text-muted">{i + 1}.</span>
                <span className="min-w-0">
                  <span className="block truncate">
                    {st.address}, {st.city.name}
                  </span>
                  <PlaceDetails place={st} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {trip.freight && (
        <>
          <div className="mt-3">
            <FreightGrid freight={trip.freight} showDims />
          </div>
          <div className="mt-3">
            <ContactList freight={trip.freight} callable />
          </div>
        </>
      )}

      {(trip.options.length > 0 || trip.luggageCount > 0) && (
        <div className="mt-3">
          <OptionChips options={trip.options} luggageCount={trip.luggageCount} />
        </div>
      )}
      {trip.comment && (
        <div className="mt-3">
          <CommentNote text={trip.comment} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between px-1 text-sm">
        <span className="inline-flex items-center gap-2 text-muted">
          <PayIcon className="h-4 w-4" />
          {trip.payment === "cash" ? t("pay.cash") : t("pay.card")}
        </span>
        <Money value={trip.price} className="text-lg font-bold text-gold" />
      </div>

      {/* Sticky: the step button stays in reach while a long order scrolls. */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 rounded-b-sheet bg-surface px-4 pb-4 pt-3">
        <StepButton action={trip.nextAction} confirming={confirming} onClick={onAction} />

        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="press mt-1 flex h-12 w-full items-center justify-center rounded-button text-sm font-medium text-muted disabled:opacity-40"
        >
          {t("trip.cancel")}
        </button>
      </div>
    </section>
  );
}

/** Big step button. While the adapter confirms, a darker band sweeps across (scaleX). */
function StepButton({ action, confirming, onClick }: { action: ActiveTrip["nextAction"]; confirming: boolean; onClick: () => void }) {
  const { t } = useT();
  if (!action) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={confirming}
      aria-busy={confirming || undefined}
      className="press relative flex h-14 w-full items-center justify-center overflow-hidden rounded-button bg-yellow text-base font-bold text-on-yellow shadow-1 disabled:cursor-wait"
    >
      {confirming && (
        <span aria-hidden="true" className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-on-yellow/20 to-transparent" />
      )}
      <span key={action} className="relative animate-fade-up">
        {confirming ? t("trip.confirming") : t(`trip.action.${action}`)}
      </span>
    </button>
  );
}
