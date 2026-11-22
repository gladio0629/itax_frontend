// /request/:id — one request before accepting it: "Yangi so'rov" (passengers,
// with the server's countdown) or "Dostavka so'rovi" (cargo). Accept goes
// through the same review as on Home; first accept wins.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import type { RideRequest } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { waitReview } from "@/lib/waitReview";
import { formatAmount, formatDuration } from "@/lib/format";
import { AlertTriangle, Banknote, Bell, CalendarDays, Car, Clock, CreditCard, Luggage, Package, Phone, Route, Truck, User, X } from "@/lib/icons";
import { Screen, HeaderButton } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Tag } from "@/components/Chip";
import { ErrorState } from "@/components/ErrorState";
import { RouteFallback } from "@/components/RouteFallback";
import { RejectSheet } from "@/features/home/RejectSheet";
import { CommentNote } from "@/features/home/OrderDetails";
import { timeText, dayText } from "@/features/home/whenText";
import { cn } from "@/lib/cn";
import { NightChip, PriceLines, Ring, RouteTimeline, joinDots, useNow, type RoutePoint } from "@/features/trip/parts";

export default function RequestScreen() {
  const { id = "" } = useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const q = useQuery(() => api.getRequest(id), [id], { pollMs: 5000 });
  const [accepting, setAccepting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  const leave = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/", { replace: true }));

  // While accepting (and after), a poll may already miss the offer: that is our own accept, not "gone".
  const acceptingRef = useRef(false);

  // Gone (taken, rejected elsewhere, expired by the server): back to the list.
  const code = (q.error as { code?: string } | null)?.code;
  useEffect(() => {
    if (acceptingRef.current) return;
    if (code === "REQUEST_NOT_FOUND") {
      toast(t("request.gone"));
      navigate("/", { replace: true });
    }
  }, [code, navigate, t]);

  const r = q.data;
  const taken = r?.status === "taken";
  useEffect(() => {
    if (!taken || acceptingRef.current) return;
    toast(t("feed.taken"), "danger");
    const id2 = setTimeout(() => navigate("/", { replace: true }), 1500);
    return () => clearTimeout(id2);
  }, [taken, navigate, t]);

  async function accept() {
    if (!r) return;
    acceptingRef.current = true;
    setAccepting(true);
    try {
      const done = await waitReview(await api.acceptRequest(r.id));
      if (done.status === "approved") {
        toast(t("feed.accepted"), "success");
        navigate("/", { replace: true });
        return;
      }
      acceptingRef.current = false;
      toast(done.resultKey && isKey(done.resultKey) ? t(done.resultKey) : t("error.generic"), "danger");
      q.reload(true);
    } catch (e) {
      acceptingRef.current = false;
      toast(errorMessage(e, t), "danger");
      q.reload(true);
    } finally {
      setAccepting(false);
    }
  }

  async function reject(reasonKey?: string) {
    if (!r) return;
    setRejectBusy(true);
    try {
      await api.rejectRequest(r.id, reasonKey);
      toast(t("feed.rejected"));
      navigate("/", { replace: true });
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setRejectBusy(false);
    }
  }

  if (!r) {
    if (q.error && code !== "REQUEST_NOT_FOUND") {
      return (
        <div className="flex h-full items-center bg-bg px-6">
          <ErrorState error={q.error} onRetry={() => q.reload()} />
        </div>
      );
    }
    return <RouteFallback />;
  }

  const footer = (
    <div className="flex flex-col gap-3">
      {r.acceptBlock && (
        <p role="note" className="flex items-start gap-2 rounded-field bg-warning-soft px-3 py-2.5 text-13 font-semibold text-ink">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-warning" />
          {isKey(r.acceptBlock.reasonKey) ? t(r.acceptBlock.reasonKey, r.acceptBlock.params) : r.acceptBlock.reasonKey}
        </p>
      )}
      <div className="flex gap-3">
        {api.capabilities.rejectRequest && (
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            disabled={accepting}
            aria-label={t("feed.reject")}
            className="press flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-raised text-ink disabled:opacity-40"
          >
            <X className="h-6 w-6" />
          </button>
        )}
        <Button size="lg" fullWidth loading={accepting} disabled={!!r.acceptBlock || taken} onClick={accept}>
          {t("feed.accept")}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {r.kind === "delivery" ? <CargoView r={r} footer={footer} onClose={leave} /> : <PassengerView r={r} footer={footer} onClose={leave} onExpired={() => q.reload(true)} />}
      <RejectSheet open={rejectOpen} busy={rejectBusy} onClose={() => setRejectOpen(false)} onConfirm={reject} />
    </>
  );
}

type ViewProps = { r: RideRequest; footer: React.ReactNode; onClose: () => void };

/** The server's offer window, as seconds left; null without one. */
function useCountdown(expiresAt: number | undefined, onZero: () => void) {
  const now = useNow(expiresAt != null);
  const firstLeft = useRef<number | null>(null);
  const left = expiresAt != null ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null;
  if (left != null && firstLeft.current == null) firstLeft.current = Math.max(1, left);
  const fired = useRef(false);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onZero();
    }
  }, [left, onZero]);
  return { left, ratio: left != null && firstLeft.current ? left / firstLeft.current : 0 };
}

function PassengerView({ r, footer, onClose, onExpired }: ViewProps & { onExpired: () => void }) {
  const { t } = useT();
  const navigate = useNavigate();
  const onZero = useRef(() => {
    toast(t("request.expired"));
    onExpired();
    navigate("/", { replace: true });
  }).current;
  const { left, ratio } = useCountdown(r.expiresAt, onZero);
  const points: RoutePoint[] = [
    { kind: "pickup", label: r.pickupDistanceKm != null ? t("request.pickupAway", { km: r.pickupDistanceKm }) : t("request.pickup"), place: r.pickup, details: true },
    ...r.stops.map((st) => ({ kind: "stop" as const, label: t("request.stop"), place: st, details: true })),
    { kind: "dropoff", label: t("request.dropoff"), place: r.dropoff, details: true },
  ];
  const PayIcon = r.payment === "cash" ? Banknote : CreditCard;
  const seatsTotal = r.carSeats ?? 0;

  return (
    <Screen
      header={
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 items-center gap-2 rounded-full bg-brand px-3.5 text-xs font-extrabold uppercase tracking-[0.8px] text-on-brand">
              <Bell className="h-4 w-4" />
              {t("request.new")}
            </span>
            <HeaderButton label={t("request.close")} onClick={onClose}>
              <X className="h-5 w-5" />
            </HeaderButton>
          </div>
          <div className="flex items-center gap-5">
            {left != null && (
              <Ring ratio={ratio} size={96} stroke={8} track="var(--color-night-line)">
                <span role="timer" aria-label={t("request.secondsLeft", { n: left })} className="tabular text-[32px] font-extrabold leading-none text-white">
                  {left}
                </span>
                <span className="text-xs font-semibold text-night-muted">{t("request.seconds")}</span>
              </Ring>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="label-caps text-night-muted">{t("request.offer")}</span>
              <span className="tabular whitespace-nowrap text-[40px] font-extrabold leading-[1.05] tracking-[-0.5px] text-white">
                {formatAmount(r.price)} <span className="text-15 font-bold tracking-normal text-night-muted">{t("common.som")}</span>
              </span>
              {r.earnings && <span className="tabular text-13 font-semibold text-night-muted">{t("request.afterCommission", { amount: formatAmount(r.earnings.net) })}</span>}
            </div>
          </div>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {r.when && (
              <NightChip icon={CalendarDays}>
                {dayText(r.when, t)}, {timeText(r.when, t)}
              </NightChip>
            )}
            <NightChip icon={Route}>
              {r.distanceKm} {t("common.km")}
            </NightChip>
            {r.durationMin > 0 && <NightChip icon={Clock}>~{formatDuration(r.durationMin, t)}</NightChip>}
            {r.payment && <NightChip icon={PayIcon}>{r.payment === "cash" ? t("pay.cash") : t("pay.card")}</NightChip>}
          </div>
        </div>
      }
      footer={footer}
    >
      <div className="flex flex-col gap-4 pb-2">
        <RouteTimeline points={points} />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-2.5 rounded-field bg-raised p-3.5">
            <span className="label-caps text-muted">{r.wholeCar ? t("feed.wholeCar") : t("request.seatsN", { n: r.seats })}</span>
            <span className="flex flex-wrap gap-1" aria-hidden="true">
              {Array.from({ length: Math.max(seatsTotal, r.seats) }, (_, i) => (
                <span
                  key={i}
                  className={cn("flex h-7 w-7 items-center justify-center rounded-lg", i < r.seats ? "bg-night text-brand dark:bg-night-line" : "text-muted")}
                >
                  <User className="h-4 w-4" />
                </span>
              ))}
            </span>
            {r.seatIds?.length ? <span className="text-xs font-semibold text-ink">{r.seatIds.map((x) => t(`seat.${x}`)).join(", ")}</span> : null}
          </div>
          <div className="flex flex-col gap-2.5 rounded-field bg-raised p-3.5">
            <span className="label-caps text-muted">{t("request.luggage")}</span>
            <span className="flex items-center gap-2 text-15 font-bold text-ink">
              <Luggage className="h-4 w-4 text-muted" />
              {r.luggageCount > 0 ? t("request.luggageN", { n: r.luggageCount }) : t("request.noLuggage")}
            </span>
          </div>
        </div>
        {(r.carClass || r.forOther) && (
          <div className="flex flex-wrap gap-1.5">
            {r.carClass && (
              <Tag>
                <Car className="h-3.5 w-3.5" />
                {t(`carClass.${r.carClass}`)}
              </Tag>
            )}
            {r.forOther && <Tag>{t("order.forOtherName", { name: r.forOther.name })}</Tag>}
          </div>
        )}
        {r.comment && <CommentNote text={r.comment} />}
        {r.requester && (
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tile bg-raised text-ink" aria-hidden="true">
              <User className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-15 font-extrabold text-ink">{r.requester.name}</span>
              <span className="text-13 font-semibold text-muted">
                {r.requester.tripsCount != null && r.requester.rating != null
                  ? t("request.tripsRating", { trips: r.requester.tripsCount, rating: r.requester.rating.toFixed(1) })
                  : r.requester.rating != null
                    ? t("request.rating", { rating: r.requester.rating.toFixed(1) })
                    : null}
              </span>
            </span>
          </div>
        )}
      </div>
    </Screen>
  );
}

function CargoView({ r, footer, onClose }: ViewProps) {
  const { t } = useT();
  const f = r.freight;
  const PayIcon = r.payment === "cash" ? Banknote : CreditCard;
  const drops = [...r.stops, r.dropoff];
  const points: RoutePoint[] = [
    { kind: "pickup", label: t("cargoReq.load"), place: r.pickup, details: true },
    ...drops.map((p, i) => ({ kind: i === drops.length - 1 ? ("dropoff" as const) : ("stop" as const), label: drops.length > 1 ? t("cargoReq.dropN", { n: i + 1 }) : t("cargoReq.drop"), place: p, details: true })),
  ];
  return (
    <Screen
      back
      title={t("cargoReq.title")}
      subtitle={r.when ? `${dayText(r.when, t)}, ${timeText(r.when, t)}` : undefined}
      right={
        <HeaderButton label={t("request.close")} onClick={onClose}>
          <X className="h-5 w-5" />
        </HeaderButton>
      }
      top={
        <div className="flex items-end justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="label-caps text-night-muted">{r.earnings ? t("cargoReq.youGet") : t("request.offer")}</span>
            <span className="tabular whitespace-nowrap text-4xl font-extrabold leading-[1.1] text-white">
              {formatAmount(r.earnings?.net ?? r.price)} <span className="text-15 font-bold text-night-muted">{t("common.som")}</span>
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-2">
            <NightChip icon={Route}>
              {r.distanceKm} {t("common.km")}
            </NightChip>
            {r.payment && <NightChip icon={PayIcon}>{r.payment === "cash" ? t("pay.cash") : t("pay.card")}</NightChip>}
          </span>
        </div>
      }
      footer={footer}
    >
      <div className="flex flex-col gap-4 pb-2">
        {f && (
          <div className="flex items-center gap-4 rounded-card bg-raised p-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-field bg-brand-soft text-brand-ink" aria-hidden="true">
              <Truck className="h-8 w-8" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-15 font-extrabold text-ink">{t("cargoReq.body", { size: f.body.sizeLabel, kg: f.body.maxWeightKg })}</span>
              <span className="tabular text-13 font-semibold text-muted">
                {t("cargoReq.dims", { w: f.body.dimensionsCm.width, d: f.body.dimensionsCm.depth, h: f.body.dimensionsCm.height })}
              </span>
              {r.cargo && isKey(r.cargo.labelKey) && (
                <span className="flex items-center gap-1.5 text-13 font-semibold text-muted">
                  <Package className="h-3.5 w-3.5" />
                  {t("offer.cargo", { label: t(r.cargo.labelKey), kg: r.cargo.weightKg })}
                </span>
              )}
            </span>
          </div>
        )}
        <RouteTimeline points={points} />
        {f && (
          <div className="flex flex-col rounded-card bg-raised px-4">
            {(
              [
                ["freight.sender", f.sender],
                ["freight.receiver", f.receiver],
              ] as const
            ).map(([k, c]) => (
              <div key={k} className="flex min-h-[64px] items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="label-caps text-muted">{t(k)}</span>
                  <span className="truncate text-15 font-bold text-ink">{joinDots([c.name, c.phoneMasked || null])}</span>
                </span>
                {c.phoneMasked ? <Phone className="h-[18px] w-[18px] shrink-0 text-muted" /> : <span className="shrink-0 text-xs font-semibold text-muted">{t("cargoReq.afterAccept")}</span>}
              </div>
            ))}
          </div>
        )}
        {f && (
          <div className="flex flex-wrap gap-1.5">
            <Tag tone={f.loaders > 0 ? "brand" : "soft"}>{f.loaders > 0 ? t("feed.loadersN", { n: f.loaders }) : t("cargoReq.noLoaders")}</Tag>
            <Tag>{f.billing.mode === "hourly" ? t("cargoReq.hourly", { n: f.billing.hours }) : t("cargoReq.byRoute")}</Tag>
            <Tag>{f.rideAlong ? t("cargoReq.rideAlong") : t("cargoReq.noRideAlong")}</Tag>
            {f.insured != null && <Tag>{f.insured ? t("cargoReq.insured") : t("cargoReq.notInsured")}</Tag>}
          </div>
        )}
        {r.comment && <CommentNote text={r.comment} />}
        {r.priceLines ? (
          <PriceLines lines={r.priceLines} net={r.earnings?.net} />
        ) : (
          <PriceLines lines={[{ key: "trip", amount: r.price }]} net={r.earnings?.net} />
        )}
      </div>
    </Screen>
  );
}

