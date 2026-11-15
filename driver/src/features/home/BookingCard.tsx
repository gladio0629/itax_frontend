import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { Booking } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { formatAmount } from "@/lib/format";
import { Banknote, CalendarDays, Car, CreditCard, MessageCircle, Navigation, Truck, Users } from "@/lib/icons";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/Stars";
import { cn } from "@/lib/cn";
import { TripSteps } from "./TripSteps";
import { PlaceDetails } from "./RouteLine";
import { CallButton, CommentNote, ContactList, FreightGrid, FreightTags, OptionChips, OrderTags, Tag } from "./OrderDetails";
import { dayText, timeText } from "./whenText";
import { SeatsTag } from "./SeatsTag";

type Props = { booking: Booking; confirming: boolean; onAction: () => void; onCancel: () => void };

/** An accepted request: passenger, call/write, its own trip steps. */
export function BookingCard({ booking: b, confirming, onAction, onCancel }: Props) {
  const { t } = useT();
  const toPickup = b.stage === "to_pickup";
  const target = toPickup ? b.pickup : b.dropoff;
  const PayIcon = b.payment === "cash" ? Banknote : CreditCard;
  const cargo = b.kind === "delivery";
  const points = b.freight ? [...b.stops, b.dropoff] : b.stops;
  const p = b.passenger;
  const route = `${b.pickup.city.name} – ${b.dropoff.city.name}`;

  return (
    <article aria-label={p ? t("booking.label", { name: p.name }) : route} className="rounded-card bg-surface p-4 shadow-1">
      {/* The real backend doesn't share the passenger yet: no identity row then. */}
      {p && (
        <div className="mb-3 flex items-center gap-3">
          <Avatar seed={p.avatarSeed} name={p.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-ink">{p.name}</p>
            <Stars value={p.rating} size={14} />
          </div>
          {b.contactMode === "text" && api.capabilities.tripChat ? (
            // Text-only passenger: the call button becomes "Yozish" (chat).
            <Link
              to={`/trip/chat/${b.id}`}
              aria-label={t("trip.writeTo", { name: p.name })}
              className="press flex h-12 shrink-0 items-center gap-2 rounded-full bg-accent/15 px-4 text-base font-bold text-accent"
            >
              <MessageCircle className="h-5 w-5" />
              {t("trip.write")}
            </Link>
          ) : (
            p.phoneMasked && <CallButton name={p.name} phoneMasked={p.phoneMasked} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Tag icon={cargo ? Truck : b.wholeCar ? Car : Users} tone="yellow">
          {cargo ? t("feed.kind.cargo") : b.wholeCar ? t("feed.wholeCar") : t("feed.seats", { n: b.seats })}
        </Tag>
        {b.seatIds && <SeatsTag seatIds={b.seatIds} />}
        {b.when && (
          <Tag icon={CalendarDays}>
            {dayText(b.when, t)}, {timeText(b.when, t)}
          </Tag>
        )}
      </div>
      <div className="mt-1.5">
        <OrderTags carClass={b.carClass} forOther={b.forOther}>
          {b.freight && <FreightTags freight={b.freight} />}
        </OrderTags>
      </div>

      <div className="mt-4">
        <TripSteps steps={b.steps} />
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
      </div>

      {/* Cargo: every drop-off in order. Passenger: the stops on the way. */}
      {points.length > 0 && (
        <section aria-labelledby={`${b.id}-stops`} className="mt-3 px-1">
          <h4 id={`${b.id}-stops`} className="text-xs text-muted">
            {b.freight ? t("order.dropoffs") : t("order.stops")}
          </h4>
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

      {cargo && b.cargo && isKey(b.cargo.labelKey) && (
        <p className="mt-3 px-1 text-sm text-muted">{t("offer.cargo", { label: t(b.cargo.labelKey), kg: b.cargo.weightKg })}</p>
      )}
      {b.freight && (
        <>
          <div className="mt-3">
            <FreightGrid freight={b.freight} showDims />
          </div>
          <div className="mt-3">
            <ContactList freight={b.freight} callable />
          </div>
        </>
      )}
      {(b.options.length > 0 || b.luggageCount > 0) && (
        <div className="mt-3">
          <OptionChips options={b.options} luggageCount={b.luggageCount} />
        </div>
      )}
      {b.comment && (
        <div className="mt-3">
          <CommentNote text={b.comment} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 px-1 text-sm">
        {b.payment ? (
          <span className="inline-flex items-center gap-2 text-muted">
            <PayIcon className="h-4 w-4" />
            {b.payment === "cash" ? t("pay.cash") : t("pay.card")}
          </span>
        ) : (
          <span />
        )}
        <span className="text-right">
          <span className="tabular block text-lg font-bold text-gold">
            {formatAmount(b.price)} <span className="text-xs font-medium text-muted">{t("common.som")}</span>
          </span>
          {/* Hidden until the server gives the commission (real backend: on completion). */}
          {b.earnings && (
            <span className="tabular block text-xs text-muted">
              {b.earnings.commissionPct == null
                ? t("feed.netOnly", { amount: formatAmount(b.earnings.net) })
                : t("feed.net", { amount: formatAmount(b.earnings.net), pct: b.earnings.commissionPct })}
            </span>
          )}
        </span>
      </div>

      <StepButton action={b.nextAction} confirming={confirming} onClick={onAction} />
      {/* Cancel only while the server allows it (canCancel undefined: sample data, always). */}
      {api.capabilities.cancelBooking && b.canCancel !== false && (
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="press mt-1 flex h-12 w-full items-center justify-center rounded-button text-sm font-medium text-muted disabled:opacity-40"
        >
          {t("trip.cancel")}
        </button>
      )}
    </article>
  );
}

/** Big step button. While the adapter confirms, a darker band sweeps across. */
function StepButton({ action, confirming, onClick }: { action: Booking["nextAction"]; confirming: boolean; onClick: () => void }) {
  const { t } = useT();
  if (!action) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={confirming}
      aria-busy={confirming || undefined}
      className={cn("press relative mt-4 flex h-14 w-full items-center justify-center overflow-hidden rounded-button bg-yellow text-base font-bold text-on-yellow shadow-1 disabled:cursor-wait")}
    >
      {confirming && <span aria-hidden="true" className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-on-yellow/20 to-transparent" />}
      <span key={action} className="relative animate-fade-up">
        {confirming ? t("trip.confirming") : t(`trip.action.${action}`)}
      </span>
    </button>
  );
}
