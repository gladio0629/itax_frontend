// /trip/:id/done — after "Safarni tugatish": what the driver keeps, the cash
// to collect, the commission (all from the server's trip summary) and the
// passenger rating. Without a summary endpoint it shows the booking's own
// price and, when the server gave it, the net.
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import type { Booking, TripSummary } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { formatAmount } from "@/lib/format";
import { Banknote, Check, Star } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";

export default function FinishedScreen() {
  const { id = "" } = useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const booking = (location.state as { booking?: Booking } | null)?.booking;
  const summary = useQuery<TripSummary | null>(() => (api.capabilities.tripSummary ? api.getTripSummary(id).catch(() => null) : Promise.resolve(null)), [id]);
  const accepted = useQuery(() => api.getAccepted(), []);
  const [stars, setStars] = useState<number | null>(null);
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(false);

  const s = summary.data ?? null;
  const loading = summary.loading && !summary.data;
  const gross = s?.gross ?? booking?.price;
  const net = s?.net ?? booking?.earnings?.net;
  const payment = s?.payment ?? booking?.payment;
  const name = s?.passengerName ?? booking?.passenger?.name.split(" ")[0];
  const city = s?.destination ?? booking?.dropoff.city.name;
  // Cash the passenger pays: the server's figure, else the booking's price for a cash trip.
  const cash = s?.cashToCollect ?? (payment === "cash" ? booking?.price : undefined);
  const nextId = accepted.data?.activeBookingId ?? accepted.data?.days[0]?.trips[0]?.bookings[0]?.id;
  const alreadyRated = s?.passengerRating != null;

  async function rate(n: number) {
    setStars(n);
    setRating(true);
    try {
      await api.ratePassenger(id, n);
      setRated(true);
      toast(t("done.rated"), "success");
    } catch (e) {
      toast(errorMessage(e, t), "danger");
      setStars(null);
    } finally {
      setRating(false);
    }
  }

  return (
    <Screen
      header={
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-brand/15" aria-hidden="true">
            <span className="flex h-16 w-16 animate-check-pop items-center justify-center rounded-full bg-brand text-on-brand">
              <Check className="h-8 w-8" />
            </span>
          </span>
          <h1 className="text-15 font-bold text-night-muted">{city ? t("done.titleCity", { city }) : t("done.title")}</h1>
          {net != null && (
            <span className="tabular whitespace-nowrap text-[44px] font-extrabold leading-[1.05] tracking-[-0.5px] text-brand">
              +{formatAmount(net)} <span className="text-17 font-bold tracking-normal text-night-brand-soft">{t("common.som")}</span>
            </span>
          )}
          {net != null && payment && <span className="text-13 font-semibold text-night-muted">{payment === "cash" ? t("done.cashSub") : t("done.toWallet")}</span>}
        </div>
      }
      footer={
        <Button size="lg" fullWidth onClick={() => navigate(nextId ? `/trip/${nextId}` : "/", { replace: true })}>
          {nextId ? t("done.nextPassenger") : t("done.next")}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        {cash != null && (
          <div className="flex items-center gap-3.5 rounded-field bg-warning-soft p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tile bg-warning-icon/20 text-warning" aria-hidden="true">
              <Banknote className="h-6 w-6" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-13 font-bold text-warning">{t("done.cashTitle")}</span>
              <span className="tabular text-17 font-extrabold text-ink">{t("done.cashTake", { amount: formatAmount(cash) })}</span>
            </span>
          </div>
        )}

        {!loading && gross != null && (
          <dl className="flex flex-col">
            <div className="flex min-h-[48px] items-center justify-between border-b border-line">
              <dt className="text-sm font-semibold text-muted">{t("done.fare")}</dt>
              <dd className="tabular text-15 font-bold text-ink">{formatAmount(gross)}</dd>
            </div>
            {s && (
              <div className="flex min-h-[48px] items-center justify-between border-b border-line">
                <dt className="text-sm font-semibold text-muted">{t("price.commission", { pct: s.commissionPct })}</dt>
                <dd className={cn("tabular text-15 font-bold", s.commissionWaived ? "text-muted line-through" : "text-danger")}>
                  {formatAmount(-(s.commissionWaived ? s.baseCommission : s.commission), { signed: true })}
                </dd>
              </div>
            )}
            {s?.commissionWaived && <p className="py-2 text-13 font-bold text-brand-ink">{t("done.waived")}</p>}
            {net != null && (
              <div className="flex min-h-[48px] items-center justify-between">
                <dt className="text-15 font-bold text-ink">{t("price.net")}</dt>
                <dd className="tabular text-17 font-extrabold text-brand-ink">
                  {formatAmount(net)} {t("common.som")}
                </dd>
              </div>
            )}
          </dl>
        )}

        {api.capabilities.ratePassenger && !alreadyRated && (
          <section aria-labelledby="rate-h" className="flex flex-col items-center gap-3 pt-1">
            <h2 id="rate-h" className="text-15 font-bold text-ink">
              {name ? t("done.rate", { name }) : t("done.rateGeneric")}
            </h2>
            <div className="flex gap-2.5" role="radiogroup" aria-labelledby="rate-h">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = stars != null && n <= stars;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={t("done.star", { n })}
                    disabled={rating || rated}
                    onClick={() => rate(n)}
                    className={cn("press flex h-[52px] w-[52px] items-center justify-center rounded-full disabled:cursor-default", on ? "bg-star-soft" : "bg-raised")}
                  >
                    <Star className={cn("h-6 w-6", on ? "fill-star text-star" : "text-muted")} />
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </Screen>
  );
}
