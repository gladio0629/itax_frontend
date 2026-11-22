// /trip/:id — one accepted booking, the screen chosen by the server's stage:
// to_pickup → ToPickup, waiting → Waiting, in_progress → OnTrip. The step
// button is the server's next action; finishing opens /trip/:id/done.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import type { Booking } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { waitReview } from "@/lib/waitReview";
import { formatAmount, formatDuration, formatTime } from "@/lib/format";
import { Armchair, CalendarDays, Check, ChevronLeft, Navigation, Navigation2, Phone, Siren, User } from "@/lib/icons";
import { dayText, timeText } from "@/features/home/whenText";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { ErrorState } from "@/components/ErrorState";
import { RouteFallback } from "@/components/RouteFallback";
import { CancelSheet } from "@/features/home/CancelSheet";
import { CommentNote } from "@/features/home/OrderDetails";
import { PlaceDetails } from "@/features/home/RouteLine";
import { cn } from "@/lib/cn";
import { TripMap } from "./TripMap";
import { Tag } from "@/components/Chip";
import { PassengerRow, Ring, RouteTimeline, clock, joinDots, navigatorHref, useNow, type RoutePoint } from "./parts";

export default function TripScreen() {
  const { id = "" } = useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const q = useQuery(() => api.getBooking(id), [id], { pollMs: 4000 });
  // The car's other passengers: re-read when this booking's stage changes, not on a second
  // poll (in http mode getBooking already reads GET /trips on every poll).
  const accepted = useQuery(() => api.getAccepted(), [id, q.data?.stage]);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const finishing = useRef(false);

  const code = (q.error as { code?: string } | null)?.code;
  useEffect(() => {
    if (code === "TRIP_NOT_FOUND" && !finishing.current) {
      toast(t("trip.gone"));
      navigate("/", { replace: true });
    }
  }, [code, navigate, t]);

  const b = q.data;
  // Everyone in this car on this trip (same day and direction), in the server's order.
  const mates =
    (b &&
      accepted.data?.days
        .flatMap((d) => d.trips)
        .find((tr) => tr.bookings.some((x) => x.id === b.id))
        ?.bookings.filter((x) => x.id !== b.id)) ||
    [];

  async function step() {
    if (!b) return;
    setBusy(true);
    const isFinish = b.nextAction === "finish";
    finishing.current = isFinish;
    try {
      const done = await waitReview(await api.advanceBooking(b.id));
      if (isFinish && done.status === "approved") {
        // "Keyingi yo'lovchi" on Finished only offers this car trip's other passengers.
        navigate(`/trip/${b.id}/done`, { replace: true, state: { mates: mates.map((m) => m.id) } });
        return;
      }
      finishing.current = false;
      await q.reload(true);
    } catch (e) {
      finishing.current = false;
      toast(errorMessage(e, t), "danger");
      q.reload(true);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(reasonKey: string) {
    if (!b) return;
    setCancelBusy(true);
    try {
      await api.cancelBooking(b.id, reasonKey);
      setCancelOpen(false);
      toast(t("trip.cancelled"));
      finishing.current = true;
      navigate("/", { replace: true });
    } catch (e) {
      toast(errorMessage(e, t), "danger");
      const c = (e as { code?: string } | null)?.code;
      if (c === "TRIP_STARTED" || c === "FORBIDDEN" || c === "ORDER_NOT_FOUND" || c === "TRIP_NOT_FOUND") setCancelOpen(false);
      q.reload(true);
    } finally {
      setCancelBusy(false);
    }
  }

  if (!b) {
    if (q.error && code !== "TRIP_NOT_FOUND") {
      return (
        <div className="flex h-full items-center bg-bg px-6">
          <ErrorState error={q.error} onRetry={() => q.reload()} />
        </div>
      );
    }
    return <RouteFallback />;
  }

  const canCancel = api.capabilities.cancelBooking && b.canCancel !== false && b.stage !== "in_progress";
  const stepButton = b.nextAction && (
    <Button size="lg" fullWidth loading={busy} onClick={step}>
      {busy ? t("trip.confirming") : t(`trip.action.${b.nextAction}`)}
    </Button>
  );

  return (
    <>
      {b.stage === "in_progress" ? (
        <OnTrip b={b} mates={mates} step={stepButton} onSos={() => setSosOpen(true)} />
      ) : b.stage === "waiting" ? (
        <Waiting b={b} mates={mates} step={stepButton} onCancel={canCancel ? () => setCancelOpen(true) : undefined} />
      ) : (
        <ToPickup b={b} mates={mates} step={stepButton} onCancel={canCancel ? () => setCancelOpen(true) : undefined} />
      )}
      <CancelSheet open={cancelOpen} busy={cancelBusy} onClose={() => setCancelOpen(false)} onConfirm={cancel} />
      <SosSheet open={sosOpen} bookingId={b.id} onClose={() => setSosOpen(false)} />
    </>
  );
}

// ------------------------------------------------------------ layout

/**
 * Full-screen light map, a floating top bar (back + dark pill) and a white
 * bottom sheet. The map keeps its camera above the sheet.
 */
function TripLayout({ b, pill, chip, footer, children }: { b: Booking; pill: ReactNode; chip?: ReactNode; footer: ReactNode; children: ReactNode }) {
  const { t } = useT();
  const navigate = useNavigate();
  const sheet = useRef<HTMLDivElement>(null);
  const [covered, setCovered] = useState(0);
  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCovered(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="relative h-full overflow-hidden bg-[var(--map-ground)]">
      <TripMap booking={b} label={t("home.mapRouteLabel")} padding={{ top: 120, bottom: covered + 16 }} />
      <div className="pointer-events-none absolute inset-x-5 flex flex-col gap-3" style={{ top: "max(calc(var(--safe-top) + 12px), 56px)" }}>
        <div className="on-night flex items-center gap-2.5 [&>*]:pointer-events-auto">
          <button
            type="button"
            onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/", { replace: true }))}
            aria-label={t("common.back")}
            className="press flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-night text-white shadow-float"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-[28px] bg-night py-2 pl-2 pr-4 text-white shadow-float">{pill}</div>
        </div>
        {chip}
      </div>
      <div ref={sheet} className="absolute inset-x-0 bottom-0 flex max-h-[70%] flex-col rounded-t-sheet bg-bg shadow-[0_-10px_40px_rgba(11,21,36,0.12)]">
        <span className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line" aria-hidden="true" />
        <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-3 pt-4 [&>*]:shrink-0">{children}</div>
        {/* The step button stays visible however long the sheet gets. */}
        <div className="flex shrink-0 flex-col px-5 pt-1" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

function PillIcon({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" }) {
  return <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone === "brand" && "bg-brand text-on-brand")}>{children}</span>;
}

/** Other passengers of the same car trip: one tap opens theirs. */
function Mates({ mates }: { mates: Booking[] }) {
  const { t } = useT();
  if (!mates.length) return null;
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label={t("trip.passengers")}>
      {mates.map((m, i) => (
        <Link key={m.id} to={`/trip/${m.id}`} replace className="press flex h-10 shrink-0 items-center gap-2 rounded-full bg-raised px-3.5 text-13 font-bold text-ink">
          {m.passenger?.name ?? t("home.passengerN", { n: i + 2 })}
          <span className="text-xs font-semibold text-muted">{t(`trip.state.${m.stage === "completed" ? "in_progress" : m.stage}`)}</span>
        </Link>
      ))}
    </div>
  );
}

function peopleLine(b: Booking, t: ReturnType<typeof useT>["t"]) {
  return joinDots([
    b.kind === "delivery" ? (b.freight ? t("feed.bodyShort", { size: b.freight.body.sizeLabel }) : t("feed.kind.delivery")) : b.wholeCar ? t("feed.wholeCar") : t("trip.peopleN", { n: b.seats }),
    b.payment ? (b.payment === "cash" ? t("pay.cash").toLowerCase() : t("pay.card").toLowerCase()) : null,
    `${formatAmount(b.price)}`,
  ]);
}

/** What the passenger booked, after acceptance: time, seats (by name when the server lists them), luggage, class, someone else. */
function TripInfo({ b }: { b: Booking }) {
  const { t } = useT();
  const seats = b.seatIds?.length ? b.seatIds.map((x) => t(`seat.${x}`)).join(", ") : null;
  const tags = [
    b.when && (
      <Tag key="when">
        <CalendarDays className="h-3.5 w-3.5" />
        {dayText(b.when, t)}, {timeText(b.when, t)}
      </Tag>
    ),
    b.kind === "passengers" && (b.wholeCar || seats) && (
      <Tag key="seats">
        <Armchair className="h-3.5 w-3.5" />
        {b.wholeCar ? t("feed.wholeCar") : seats}
      </Tag>
    ),
    b.luggageCount > 0 && <Tag key="lug">{t("order.luggage", { n: b.luggageCount })}</Tag>,
    b.carClass && <Tag key="cls">{t(`carClass.${b.carClass}`)}</Tag>,
    b.forOther && (
      <Tag key="other">
        <User className="h-3.5 w-3.5" />
        {t("order.forOtherName", { name: b.forOther.name })}
      </Tag>
    ),
  ].filter(Boolean);
  return (
    <>
      {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags}</div>}
      {b.comment && <CommentNote text={b.comment} />}
    </>
  );
}

/** Cargo after acceptance: body, loaders, billing, the contacts (call when the server gives a number) and every drop-off. */
function CargoDetails({ b, showDrops }: { b: Booking; showDrops: boolean }) {
  const { t } = useT();
  const f = b.freight;
  if (!f) return null;
  const drops = [...b.stops, b.dropoff];
  const points: RoutePoint[] = drops.map((p, i) => ({
    kind: i === drops.length - 1 ? "dropoff" : "stop",
    label: drops.length > 1 ? t("cargoReq.dropN", { n: i + 1 }) : t("cargoReq.drop"),
    place: p,
    details: true,
  }));
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Tag tone="night">{t("feed.bodyShort", { size: f.body.sizeLabel })}</Tag>
        <Tag tone={f.loaders > 0 ? "brand" : "soft"}>{f.loaders > 0 ? t("feed.loadersN", { n: f.loaders }) : t("cargoReq.noLoaders")}</Tag>
        <Tag>{f.billing.mode === "hourly" ? t("cargoReq.hourly", { n: f.billing.hours }) : t("cargoReq.byRoute")}</Tag>
        {f.rideAlong && <Tag>{t("cargoReq.rideAlong")}</Tag>}
      </div>
      <div className="flex flex-col rounded-field bg-raised px-4">
        {(
          [
            ["freight.sender", f.sender],
            ["freight.receiver", f.receiver],
          ] as const
        ).map(([k, c]) => (
          <div key={k} className="flex min-h-[60px] items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="label-caps text-muted">{t(k)}</span>
              <span className="truncate text-15 font-bold text-ink">{joinDots([c.name, c.phoneMasked || null])}</span>
            </span>
            {c.callNumber && (
              <a
                href={`tel:${c.callNumber.replace(/[^\d+]/g, "")}`}
                aria-label={t("trip.callName", { name: c.name })}
                className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
              >
                <Phone className="h-[18px] w-[18px]" />
              </a>
            )}
          </div>
        ))}
      </div>
      {showDrops && <RouteTimeline points={points} compact />}
    </>
  );
}

// ------------------------------------------------------------ ToPickup

function StepFooter({ step, onCancel }: { step: ReactNode; onCancel?: () => void }) {
  const { t } = useT();
  return (
    <>
      {step}
      {onCancel && (
        <button type="button" onClick={onCancel} className="press mt-1 flex h-11 items-center justify-center text-sm font-bold text-muted">
          {t("trip.cancel")}
        </button>
      )}
    </>
  );
}

function ToPickup({ b, mates, step, onCancel }: { b: Booking; mates: Booking[]; step: ReactNode; onCancel?: () => void }) {
  const { t } = useT();
  return (
    <TripLayout
      b={b}
      footer={<StepFooter step={step} onCancel={onCancel} />}
      pill={
        <>
          <PillIcon>
            <Navigation2 className="h-5 w-5" />
          </PillIcon>
          <span className="flex min-w-0 flex-col">
            {b.eta && (
              <span className="tabular truncate text-15 font-extrabold">
                {b.eta.distanceKm != null ? t("trip.etaKm", { min: b.eta.minutes, km: b.eta.distanceKm }) : t("trip.etaMin", { min: b.eta.minutes })}
              </span>
            )}
            <span className={cn("truncate", b.eta ? "text-xs font-semibold text-night-muted" : "text-15 font-extrabold")}>{t("trip.toPassenger")}</span>
          </span>
        </>
      }
    >
      <Mates mates={mates} />
      {b.passenger && <PassengerRow passenger={b.passenger} bookingId={b.id} subtitle={peopleLine(b, t)} />}
      <TripInfo b={b} />
      <div className="flex flex-col gap-1 rounded-field bg-raised p-4">
        <span className="label-caps text-muted">{t("trip.pickupAddress")}</span>
        <span className="text-base font-extrabold text-ink">
          {b.pickup.address}, {b.pickup.city.name}
        </span>
        <PlaceDetails place={b.pickup} />
      </div>
      <CargoDetails b={b} showDrops />
      <a href={navigatorHref(b.pickup)} className="press flex h-12 items-center justify-center gap-2 rounded-full bg-raised text-sm font-bold text-ink">
        <Navigation className="h-4 w-4" />
        {t("trip.openNavigator")}
      </a>
    </TripLayout>
  );
}

// ------------------------------------------------------------ Waiting

function Waiting({ b, mates, step, onCancel }: { b: Booking; mates: Booking[]; step: ReactNode; onCancel?: () => void }) {
  const { t } = useT();
  const w = b.waiting;
  const now = useNow(!!w);
  const elapsed = w ? Math.max(0, (now - w.arrivedAt) / 1000) : 0;
  const free = w ? w.freeMinutes * 60 : 0;
  const inFree = elapsed < free;
  return (
    <TripLayout
      b={b}
      footer={<StepFooter step={step} onCancel={onCancel} />}
      pill={
        <>
          <PillIcon>
            <Check className="h-5 w-5" />
          </PillIcon>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-15 font-extrabold">{t("trip.arrivedTitle")}</span>
            <span className="truncate text-xs font-semibold text-night-muted">{b.pickup.address}</span>
          </span>
        </>
      }
    >
      <Mates mates={mates} />
      {w && (
        <div className="flex items-center gap-4 border-b border-line pb-4">
          <Ring ratio={inFree ? 1 - elapsed / Math.max(1, free) : 1} size={104} tone={inFree ? "brand" : "warning"} track="rgb(var(--color-line-rgb))">
            <span role="timer" className="tabular text-2xl font-extrabold leading-none text-ink">
              {clock(inFree ? free - elapsed : elapsed - free)}
            </span>
            <span className={cn("text-xs font-bold", inFree ? "text-brand-ink" : "text-warning")}>{inFree ? t("trip.waitFree") : t("trip.waitPaid")}</span>
          </Ring>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-17 font-extrabold text-ink">{t("trip.waitingTitle")}</span>
            <span className="text-13 leading-[19px] text-muted">{t("trip.waitRule", { free: w.freeMinutes, price: formatAmount(w.pricePerMinute) })}</span>
            {w.charge != null && w.charge > 0 && <span className="tabular text-13 font-bold text-warning">{t("trip.waitCharge", { amount: formatAmount(w.charge) })}</span>}
          </span>
        </div>
      )}
      {!w && <span className="text-17 font-extrabold text-ink">{t("trip.waitingTitle")}</span>}
      {b.passenger && <PassengerRow passenger={b.passenger} bookingId={b.id} subtitle={w?.passengerNotified ? t("trip.notified") : peopleLine(b, t)} />}
      <TripInfo b={b} />
    </TripLayout>
  );
}

// ------------------------------------------------------------ OnTrip

function OnTrip({ b, mates, step, onSos }: { b: Booking; mates: Booking[]; step: ReactNode; onSos: () => void }) {
  const { t } = useT();
  const pr = b.progress;
  const now = useNow(!!pr?.startedAt);
  const next = pr?.nextStop ?? b.dropoff;
  const nodes = [b.pickup.city.name, ...b.stops.map((s) => s.city.name), b.dropoff.city.name];
  const ratio = pr?.ratio;
  return (
    <TripLayout
      b={b}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSos}
            aria-label={t("trip.sosLabel")}
            className="press flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-sos text-sm font-extrabold text-white"
          >
            {t("trip.sos")}
          </button>
          <div className="min-w-0 flex-1">{step}</div>
        </div>
      }
      pill={
        <a href={navigatorHref(next)} className="flex min-w-0 flex-1 items-center gap-3">
          <PillIcon>
            <Navigation className="h-5 w-5" />
          </PillIcon>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-15 font-extrabold">{t("trip.openNavigator")}</span>
            <span className="truncate text-xs font-semibold text-night-muted">
              {next.address}, {next.city.name}
            </span>
          </span>
        </a>
      }
      chip={
        pr?.startedAt != null && (
          <span className="flex h-9 w-max items-center gap-2 rounded-full bg-surface px-3.5 text-13 font-bold text-ink shadow-1">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            {t("trip.onTripFor", { time: formatDuration(Math.max(0, Math.floor((now - pr.startedAt) / 60_000)), t) })}
          </span>
        )
      }
    >
      <Mates mates={mates} />
      <div className="flex flex-col gap-2">
        <span className="label-caps text-muted">{t("trip.next", { place: `${next.city.name}, ${next.address}` })}</span>
        {(pr?.arriveAt != null || pr?.remainingKm != null) && (
          <span className="flex items-baseline justify-between gap-3">
            {pr?.arriveAt != null && <span className="tabular text-xl font-extrabold text-ink">{t("trip.arriveAt", { time: formatTime(pr.arriveAt) })}</span>}
            {pr?.remainingKm != null && <span className="tabular text-13 font-bold text-muted">{t("trip.kmLeft", { km: pr.remainingKm })}</span>}
          </span>
        )}
        <div className="mt-1 flex items-center" aria-hidden="true">
          {nodes.map((_, i) => (
            <span key={i} className={cn("flex items-center", i > 0 && "flex-1")}>
              {i > 0 && (
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  {ratio != null && (
                    <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, (ratio * (nodes.length - 1) - (i - 1)) * 100))}%` }} />
                  )}
                </span>
              )}
              <span className={cn("h-3.5 w-3.5 shrink-0", i === nodes.length - 1 ? "rounded-[3px] bg-ink" : "rounded-full border-[3px] border-muted bg-surface")} />
            </span>
          ))}
        </div>
        <div className="flex justify-between gap-2 text-xs font-semibold text-muted">
          {nodes.map((n, i) => (
            <span key={i} className={cn("truncate", i === 0 ? "text-left" : i === nodes.length - 1 ? "text-right" : "text-center")}>
              {n}
            </span>
          ))}
        </div>
      </div>
      {b.passenger && <PassengerRow passenger={b.passenger} bookingId={b.id} subtitle={peopleLine(b, t)} />}
      <TripInfo b={b} />
      <CargoDetails b={b} showDrops />
      {!b.freight && (
        <RouteTimeline
          compact
          points={[...b.stops.map((st) => ({ kind: "stop" as const, label: t("request.stop"), place: st, details: true })), { kind: "dropoff" as const, label: t("request.dropoff"), place: b.dropoff, details: true }]}
        />
      )}
    </TripLayout>
  );
}

// ------------------------------------------------------------ SOS

/** SOS: call 112 always; signal IZGO operators when the backend supports it (never faked). */
function SosSheet({ open, bookingId, onClose }: { open: boolean; bookingId: string; onClose: () => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  async function signal() {
    setBusy(true);
    try {
      await api.sendSos(bookingId);
      toast(t("trip.sosSent"), "success");
      onClose();
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={t("trip.sosTitle")}>
      <p className="mb-5 text-sm text-muted">{t("trip.sosDesc")}</p>
      <div className="flex flex-col gap-3 pb-1">
        <a href="tel:112" className="press flex h-[60px] items-center justify-center gap-2 rounded-full bg-sos text-base font-extrabold text-white">
          <Phone className="h-5 w-5" />
          {t("trip.call112")}
        </a>
        {api.capabilities.sos && (
          <Button size="lg" variant="dark" fullWidth loading={busy} onClick={signal} trailing={<Siren className="h-5 w-5" />}>
            {t("trip.sosSignal")}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
