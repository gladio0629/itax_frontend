import { useEffect, useState } from "react";
import type { Offer } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { Banknote, CreditCard, Package, Users } from "@/lib/icons";
import { Button } from "@/components/Button";
import { formatAmount } from "@/lib/format";
import { CountdownRing } from "./CountdownRing";
import { RouteLine } from "./RouteLine";
import { CommentNote, OptionChips, OrderTags } from "./OrderDetails";
import { cn } from "@/lib/cn";

type Props = {
  offer: Offer;
  accepting: boolean;
  blocked: boolean;
  onAccept: () => void;
  onSkip: () => void;
  onExpire: () => void;
};

export function OfferCard({ offer, accepting, blocked, onAccept, onSkip, onExpire }: Props) {
  const { t } = useT();
  const calc = () => Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(calc);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setRemaining(calc()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.id]);

  useEffect(() => {
    if (remaining > 0 || leaving) return;
    setLeaving(true);
    const timer = setTimeout(onExpire, 280);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const PayIcon = offer.payment === "cash" ? Banknote : CreditCard;

  return (
    <section
      aria-label={t("offer.new")}
      aria-live="assertive"
      className={cn(
        "relative overflow-hidden rounded-sheet bg-surface shadow-2 transition-[opacity,transform] duration-[280ms]",
        leaving ? "translate-y-6 opacity-0" : "animate-sheet-up"
      )}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-yellow" />
      <div className="p-4 pl-5">
        <div className="mb-3 flex items-center gap-3">
          <CountdownRing total={offer.countdownSec} remaining={remaining} label={t("offer.secondsLeft", { n: remaining })} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted">{t("offer.new")}</p>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-button bg-raised px-2.5 text-xs font-medium text-ink">
                <PayIcon className="h-4 w-4 text-muted" />
                {offer.payment === "cash" ? t("pay.cash") : t("pay.card")}
              </span>
            </div>
            <p className="tabular whitespace-nowrap text-xl font-bold text-gold max-[370px]:text-lg">
              {formatAmount(offer.priceMin)}–{formatAmount(offer.priceMax)}
              <span className="ml-1 text-sm font-medium text-muted">{t("common.som")}</span>
            </p>
          </div>
        </div>

        <div className="mb-3">
          <OrderTags carClass={offer.carClass} forOther={offer.forOther} />
        </div>

        <RouteLine
          pickup={offer.pickup}
          dropoff={offer.dropoff}
          stops={offer.stops}
          pickupLabel={t("offer.pickup")}
          dropoffLabel={t("offer.dropoff")}
          stopLabel={(n) => t("order.stop", { n })}
        />

        <dl className="mt-3 grid grid-cols-3 gap-2">
          <Meta label={t("offer.distance")} value={`${offer.distanceKm}\u00a0${t("common.km")}`} />
          <Meta label={t("offer.toPickup")} value={`${offer.pickupEtaMin}\u00a0${t("common.min")}`} />
          {offer.kind === "delivery" ? (
            <Meta label={t("offer.delivery")} value={<span className="inline-flex items-center gap-1.5"><Package className="h-4 w-4 text-muted" />{offer.cargo?.weightKg ?? 0} kg</span>} />
          ) : (
            <Meta label={t("trip.passenger")} value={<span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-muted" />{offer.passengers ?? 1}</span>} />
          )}
        </dl>
        {offer.kind === "delivery" && offer.cargo && isKey(offer.cargo.labelKey) && (
          <p className="mt-2 truncate text-sm text-muted">{t("offer.cargo", { label: t(offer.cargo.labelKey), kg: offer.cargo.weightKg })}</p>
        )}

        {(offer.options.length > 0 || offer.luggageCount > 0) && (
          <div className="mt-3">
            <OptionChips options={offer.options} luggageCount={offer.luggageCount} />
          </div>
        )}
        {offer.comment && (
          <div className="mt-3">
            <CommentNote text={offer.comment} />
          </div>
        )}

        <Button size="lg" fullWidth className="mt-4" loading={accepting} disabled={blocked || leaving} onClick={onAccept}>
          {t("offer.accept")}
        </Button>
        <button
          type="button"
          onClick={onSkip}
          disabled={accepting || leaving}
          className="press mt-1 flex h-12 w-full items-center justify-center rounded-button text-sm font-medium text-muted disabled:opacity-40"
        >
          {t("offer.skip")}
        </button>
      </div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-button bg-raised px-2.5 py-2">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className="tabular truncate text-base font-bold text-ink">{value}</dd>
    </div>
  );
}

