import type { ActiveTrip } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { Banknote, CreditCard, Navigation, Phone, Route } from "@/lib/icons";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/Stars";
import { Money } from "@/components/Money";
import { toast } from "@/lib/toast";
import { formatDuration } from "@/lib/format";
import { TripSteps } from "./TripSteps";
import { PlaceDetails } from "./RouteLine";
import { CommentNote, OptionChips, OrderTags } from "./OrderDetails";
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

  return (
    <section aria-label={t("trip.active")} className={cn("animate-sheet-up rounded-sheet bg-surface p-4 shadow-2", className)}>
      <div className="flex items-center gap-3">
        <Avatar seed={trip.passenger.avatarSeed} name={trip.passenger.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{trip.passenger.name}</p>
          <Stars value={trip.passenger.rating} size={14} />
        </div>
        <a
          href={`tel:${trip.passenger.phoneMasked.replace(/[^\d+]/g, "")}`}
          onClick={(e) => {
            // Demo: the number is masked by the adapter; show it instead of dialling.
            e.preventDefault();
            toast(t("trip.callMasked", { phone: trip.passenger.phoneMasked }));
          }}
          aria-label={t("trip.call", { name: trip.passenger.name })}
          className="press flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success"
        >
          <Phone className="h-5 w-5" />
        </a>
      </div>

      <div className="mt-3">
        <OrderTags carClass={trip.carClass} forOther={trip.forOther} />
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

      {trip.stops.length > 0 && (
        <section aria-labelledby={`${trip.id}-stops`} className="mt-3 px-1">
          <h3 id={`${trip.id}-stops`} className="text-xs text-muted">
            {t("order.stops")}
          </h3>
          <ol className="mt-1 space-y-1">
            {trip.stops.map((st, i) => (
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

      <StepButton action={trip.nextAction} confirming={confirming} onClick={onAction} />

      <button
        type="button"
        onClick={onCancel}
        disabled={confirming}
        className="press mt-1 flex h-12 w-full items-center justify-center rounded-button text-sm font-medium text-muted disabled:opacity-40"
      >
        {t("trip.cancel")}
      </button>
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
      className="press relative mt-4 flex h-14 w-full items-center justify-center overflow-hidden rounded-button bg-yellow text-base font-bold text-on-yellow shadow-1 disabled:cursor-wait"
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
