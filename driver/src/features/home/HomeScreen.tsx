import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { AcceptedPage, Booking, FeedType, RideRequest } from "@/api/types";
import { isKey, useT, type TranslationKey } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { useOnline } from "@/lib/useOnline";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { waitReview } from "@/lib/waitReview";
import { formatAmount, formatDate, formatDuration } from "@/lib/format";
import { useFeedSignal } from "@/stores/feedSignal";
import { Armchair, ArrowRight, ArrowUpDown, Bell, CalendarDays, ChevronDown, Inbox, Package, RefreshCw, SlidersHorizontal } from "@/lib/icons";
import { Screen, HeaderButton } from "@/components/Screen";
import { Chip } from "@/components/Chip";
import { Sheet } from "@/components/Sheet";
import { PullList } from "@/components/PullList";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList, Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { DebtBanner } from "@/features/wallet/DebtBanner";
import { Monogram } from "@/features/trip/parts";
import { cn } from "@/lib/cn";
import { HomeMap } from "./HomeMap";
import { RequestCard } from "./RequestCard";
import { RejectSheet } from "./RejectSheet";
import { NotifyPrompt } from "./NotifyPrompt";
import { dayText, timeText } from "./whenText";

const TYPES: FeedType[] = ["all", "passengers", "delivery"];

function greetingKey(): TranslationKey {
  const h = new Date().getHours();
  return h >= 5 && h < 11 ? "home.greeting.morning" : h >= 11 && h < 17 ? "home.greeting.day" : h >= 17 && h < 23 ? "home.greeting.evening" : "home.greeting.night";
}

/**
 * Asosiy (design v2): Ink top with the greeting and today's earnings, then
 * the accepted trips, "Mening yo'nalishim" and the live request list. Filters
 * live in the URL (?dir=&date=&type=&request=).
 */
export default function HomeScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const online = useOnline();
  const [params, setParams] = useSearchParams();
  const direction = params.get("dir") ?? "all";
  const date = params.get("date") ?? "today";
  const typeParam = params.get("type") as FeedType | null;
  const type: FeedType = typeParam && TYPES.includes(typeParam) ? typeParam : "all";
  const highlightId = params.get("request");

  const bump = useFeedSignal((s) => s.bump);
  const signal = useFeedSignal((s) => s.version);
  const profile = useQuery(() => api.getProfile(), []);
  const summary = useQuery(() => api.getHomeSummary(), [signal], { pollMs: 10000 });
  const feed = useQuery(() => api.getFeed({ direction, date, type }), [direction, date, type, signal], { pollMs: 5000 });
  const accepted = useQuery(() => api.getAccepted(), [signal], { pollMs: 5000 });
  const [dirOpen, setDirOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Record<string, "taken" | "out">>({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<RideRequest | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);

  const update = useCallback(
    (next: Record<string, string | null>) => {
      const p = new URLSearchParams(params);
      for (const [k, v] of Object.entries(next)) {
        if (v == null || (k === "dir" && v === "all") || (k === "date" && v === "today") || (k === "type" && v === "all")) p.delete(k);
        else p.set(k, v);
      }
      setParams(p, { replace: true });
    },
    [params, setParams]
  );

  // Looking at the list clears the Asosiy badge.
  const feedVersion = feed.data;
  useEffect(() => {
    if (!feedVersion || document.visibilityState !== "visible") return;
    api.markFeedSeen().then(() => summary.reload(true)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedVersion]);

  // A highlighted card (from a banner) stays marked for a moment, then the param clears.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`req-${highlightId}`);
    el?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const id = setTimeout(() => update({ request: null }), 2500);
    return () => clearTimeout(id);
  }, [highlightId, update, feed.data]);

  async function accept(r: RideRequest) {
    setAccepting(r.id);
    try {
      const done = await waitReview(await api.acceptRequest(r.id));
      if (done.status === "approved") {
        setLeaving((m) => ({ ...m, [r.id]: "out" }));
        toast(t("feed.accepted"), "success");
        accepted.reload(true);
        bump();
      } else if (done.resultKey === "request.taken") {
        setLeaving((m) => ({ ...m, [r.id]: "taken" }));
      } else {
        toast(done.resultKey && isKey(done.resultKey) ? t(done.resultKey) : t("error.generic"), "danger");
        feed.reload(true);
      }
    } catch (e) {
      toast(errorMessage(e, t), "danger");
      feed.reload(true);
    } finally {
      setAccepting(null);
    }
  }

  async function reject(reasonKey?: string) {
    if (!rejecting) return;
    const id = rejecting.id;
    setRejectBusy(true);
    try {
      await api.rejectRequest(id, reasonKey);
      setRejecting(null);
      setLeaving((m) => ({ ...m, [id]: "out" }));
      toast(t("feed.rejected"));
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setRejectBusy(false);
    }
  }

  const s = summary.data;
  const page = feed.data;
  const p = profile.data;
  const items = page?.items.filter((r) => !gone.has(r.id)) ?? [];
  const dirs = page?.directions ?? [];
  // The chosen direction, else the server's seat summary, else the driver's only direction.
  const current = dirs.find((d) => d.id === direction) ?? page?.seats?.direction ?? (dirs.length === 1 ? dirs[0] : null);
  // Swapping only changes the feed filter, so not without one.
  const reverse = current && api.capabilities.feedFilters ? dirs.find((d) => d.from.id === current.to.id && d.to.id === current.from.id) : undefined;
  const dateChoice = date === "today" || date === "tomorrow" ? null : page?.dates.find((d) => d.date === date) ?? null;
  const dateLabel = date === "today" ? t("common.today") : date === "tomorrow" ? t("common.tomorrow") : dateChoice ? formatDate(dateChoice.dayStart, t) : t("feed.pickDate");
  const week = s?.week;
  const weekMax = week ? Math.max(1, ...week.map((d) => d.amount)) : 1;

  return (
    <Screen
      scroll={false}
      header={
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <Link to="/profile" className="press flex min-w-0 items-center gap-3" aria-label={t("home.openProfile")}>
              {p ? <Monogram name={p.name} size={44} tone="brand" /> : <Skeleton className="h-11 w-11 rounded-full bg-night-2" />}
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold text-night-muted">{t(greetingKey())}</span>
                <span className="truncate text-17 font-extrabold text-white">{p?.name.split(" ")[0] ?? " "}</span>
              </span>
            </Link>
            <HeaderButton
              label={s?.unreadNotifications ? t("home.notificationsUnread", { n: s.unreadNotifications }) : t("home.notifications")}
              onClick={() => navigate("/notifications")}
            >
              <Bell className="h-5 w-5" />
              {!!s?.unreadNotifications && <span className="absolute right-[9px] top-[9px] h-[9px] w-[9px] rounded-full border-2 border-night bg-brand" />}
            </HeaderButton>
          </div>
          <Link to="/history" aria-label={t("home.openHistory")} className="press flex items-end justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="label-caps text-night-muted">{t("home.todayEarnings")}</span>
              {s ? (
                <span className="tabular whitespace-nowrap text-4xl font-extrabold leading-[1.1] tracking-[-0.5px] text-white">
                  {formatAmount(s.todayEarnings)} <span className="text-15 font-bold tracking-normal text-night-muted">{t("common.som")}</span>
                </span>
              ) : (
                <Skeleton className="h-10 w-48 bg-night-2" />
              )}
              {s && (
                <span className="text-13 font-semibold text-night-muted">
                  {t("home.todayTrips", { n: s.todayTrips })}
                  {s.todayWorkMin != null && s.todayWorkMin > 0 && ` · ${formatDuration(s.todayWorkMin, t)}`}
                </span>
              )}
            </span>
            {week && week.length > 0 && (
              <span className="flex h-[50px] w-24 shrink-0 items-end gap-[5px]" aria-hidden="true">
                {week.map((d, i) => (
                  <span
                    key={d.date}
                    className={cn("flex-1 rounded", i === week.length - 1 ? "bg-brand" : "bg-night-bar")}
                    style={{ height: `${Math.max(12, Math.round((d.amount / weekMax) * 100))}%` }}
                  />
                ))}
              </span>
            )}
          </Link>
        </div>
      }
    >
      <PullList onRefresh={() => Promise.all([feed.reload(true), accepted.reload(true)])} pullLabel={t("feed.pull")} releaseLabel={t("feed.release")} className="h-full">
        <div className="flex flex-col gap-4 px-5 pb-tabbar pt-6">
          {s && s.debt.level !== "ok" && <DebtBanner level={s.debt.level} onTopup={() => navigate("/wallet/debt")} />}
          <NotifyPrompt />

          {accepted.error && !accepted.data ? (
            <AcceptedError error={accepted.error} onRetry={() => accepted.reload()} />
          ) : (
            <AcceptedTrips page={accepted.data} />
          )}

          <HomeMap accepted={accepted.data} />

          {/* Mening yo'nalishim: the direction in focus, its day and free seats. */}
          <section aria-labelledby="my-route" className="flex items-center gap-2 rounded-card bg-raised p-4 pr-3">
            <button
              type="button"
              onClick={() => api.capabilities.feedFilters && setDirOpen(true)}
              disabled={!api.capabilities.feedFilters}
              className="press focus-inset flex min-w-0 flex-1 flex-col gap-1 text-left disabled:active:scale-100"
              aria-haspopup={api.capabilities.feedFilters ? "dialog" : undefined}
            >
              <span id="my-route" className="label-caps text-muted">
                {t("home.myRoute")}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-lg font-extrabold text-ink">
                {current ? (
                  <>
                    <span className="truncate">{current.from.name}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-brand-ink" />
                    <span className="truncate">{current.to.name}</span>
                  </>
                ) : dirs.length > 1 ? (
                  t("home.allDirections")
                ) : (
                  t("home.noRoute")
                )}
                {api.capabilities.feedFilters && <ChevronDown className="h-4 w-4 shrink-0 text-muted" />}
              </span>
              {page?.seats && (
                <span className="flex items-center gap-1.5 text-13 font-semibold text-muted">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {dayText(page.seats.when, t)} · {t("home.freeSeatsShort", { n: page.seats.free })}
                </span>
              )}
            </button>
            {reverse && (
              <button
                type="button"
                onClick={() => update({ dir: reverse.id })}
                aria-label={t("home.swapDirection")}
                className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink"
              >
                <ArrowUpDown className="h-5 w-5" />
              </button>
            )}
            {api.capabilities.routes && (
              <Link to="/profile/routes" aria-label={t("home.editRoutes")} className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-night text-white dark:bg-night-line">
                <SlidersHorizontal className="h-5 w-5" />
              </Link>
            )}
          </section>

          <div className="flex items-center justify-between gap-3 pt-1">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-ink">
              {t("home.requests")}
              {page && <span className="tabular text-brand-ink">{items.length}</span>}
            </h2>
            <span className="flex items-center gap-2">
              {online && page && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-ink">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
                  {t("home.live")}
                </span>
              )}
              <button
                type="button"
                onClick={() => feed.reload()}
                aria-label={t("feed.refresh")}
                className="press flex h-11 w-11 items-center justify-center rounded-full bg-raised text-ink"
              >
                <RefreshCw className={cn("h-4 w-4", feed.loading && "animate-spin")} />
              </button>
            </span>
          </div>

          {api.capabilities.feedFilters && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label={t("feed.filters")}>
              {TYPES.map((k) => (
                <Chip key={k} selected={type === k} onClick={() => update({ type: k })}>
                  {k === "passengers" && <Armchair className="h-4 w-4" />}
                  {k === "delivery" && <Package className="h-4 w-4" />}
                  {k === "all" ? t("common.all") : k === "passengers" ? t("feed.kind.passengers") : t("feed.kind.delivery")}
                </Chip>
              ))}
              <Chip selected={date !== "today"} onClick={() => setDateOpen(true)} aria-haspopup="dialog">
                <CalendarDays className="h-4 w-4" />
                {dateLabel}
                <ChevronDown className="h-4 w-4" />
              </Chip>
            </div>
          )}

          <div aria-busy={feed.loading} className="flex flex-col gap-3">
            {feed.error && !page ? (
              <ErrorState error={feed.error} onRetry={() => feed.reload()} />
            ) : !page ? (
              <SkeletonList label={t("common.loading")} rows={2} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={t("feed.empty")}
                description={page.seats ? t("feed.emptyDesc", { day: dayText(page.seats.when, t) }) : undefined}
                action={
                  <Button variant="secondary" fullWidth onClick={() => feed.reload()}>
                    <RefreshCw className="h-4 w-4" />
                    {t("feed.refresh")}
                  </Button>
                }
              />
            ) : (
              items.map((r, i) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  accepting={accepting === r.id}
                  leaving={leaving[r.id] ?? null}
                  highlight={highlightId ? highlightId === r.id : i === 0}
                  onAccept={() => accept(r)}
                  onReject={api.capabilities.rejectRequest ? () => setRejecting(r) : undefined}
                  onGone={() => {
                    setGone((x) => new Set(x).add(r.id));
                    feed.reload(true);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </PullList>

      <RejectSheet open={!!rejecting} busy={rejectBusy} onClose={() => setRejecting(null)} onConfirm={reject} />

      <Sheet open={dirOpen} onClose={() => setDirOpen(false)} title={t("home.pickDirection")}>
        <div className="flex flex-col pb-2" role="radiogroup" aria-label={t("home.pickDirection")}>
          {[{ id: "all", label: t("home.allDirections") }, ...dirs.map((d) => ({ id: d.id, label: `${d.from.name} → ${d.to.name}` }))].map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={direction === o.id}
              onClick={() => {
                update({ dir: o.id });
                setDirOpen(false);
              }}
              className="press focus-inset flex min-h-[56px] items-center justify-between border-b border-line text-left text-15 font-bold text-ink last:border-b-0"
            >
              {o.label}
              {direction === o.id && <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={dateOpen} onClose={() => setDateOpen(false)} title={t("feed.pickDate")}>
        <div className="grid grid-cols-2 gap-2 pb-1">
          {page?.dates.map((d) => (
            <Chip
              key={d.date}
              selected={date === d.date || (d.dayOffset === 0 && date === "today") || (d.dayOffset === 1 && date === "tomorrow")}
              onClick={() => {
                update({ date: d.dayOffset === 0 ? "today" : d.dayOffset === 1 ? "tomorrow" : d.date });
                setDateOpen(false);
              }}
            >
              {d.dayOffset <= 1 ? `${dayText(d, t)}, ${formatDate(d.dayStart, t)}` : formatDate(d.dayStart, t)}
            </Chip>
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}

/** Accepted trips, grouped as the server sends them; the one with the next booking is the "Faol safar". */
function AcceptedTrips({ page }: { page: AcceptedPage | undefined }) {
  const { t } = useT();
  if (!page || page.count === 0) return null;
  const all = page.days.flatMap((d) => d.trips.flatMap((tr) => tr.bookings));
  const activeId = page.activeBookingId ?? all[0]?.id;
  return (
    <section aria-label={t("home.acceptedTrips")} className="flex flex-col gap-3">
      {page.days.flatMap((day) =>
        day.trips.map((trip) => {
          const active = trip.bookings.some((b) => b.id === activeId);
          const first = trip.bookings[0];
          const when = first?.when;
          return (
            <article
              key={`${day.date}-${trip.direction.id}`}
              className={cn("flex flex-col gap-3 rounded-card p-4", active ? "on-night bg-night text-white" : "border border-line bg-surface text-ink")}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={cn("label-caps", active ? "text-brand" : "text-muted")}>
                    {active ? t("home.activeTrip") : day.undated ? t("home.acceptedTrips") : dayText(day, t)}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-17 font-extrabold">
                    <span className="truncate">{trip.direction.from.name}</span>
                    <ArrowRight className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-brand-ink")} />
                    <span className="truncate">{trip.direction.to.name}</span>
                  </span>
                </span>
                <span className={cn("shrink-0 text-right text-13 font-semibold", active ? "text-night-muted" : "text-muted")}>
                  {when && !day.undated && (
                    <span className="tabular block">
                      {active ? `${dayText(day, t)}, ` : ""}
                      {timeText(when, t)}
                    </span>
                  )}
                  {trip.seats.total > 0 && <span className="tabular block">{t("accepted.seatsUsed", { used: trip.seats.used, total: trip.seats.total })}</span>}
                </span>
              </div>
              <ul className="flex flex-col">
                {trip.bookings.map((b, i) => (
                  <li key={b.id}>
                    <Link
                      to={`/trip/${b.id}`}
                      className={cn("press focus-inset flex min-h-[48px] items-center gap-3 border-t py-1.5", active ? "border-night-line" : "border-line")}
                    >
                      <span className="min-w-0 flex-1 truncate text-15 font-bold">{passengerLabel(b, i, t)}</span>
                      <span className={cn("shrink-0 text-xs font-bold", b.id === activeId ? (active ? "text-brand" : "text-brand-ink") : active ? "text-night-muted" : "text-muted")}>
                        {t(`trip.state.${b.stage === "completed" ? "in_progress" : b.stage}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {active && activeId && (
                <Link to={`/trip/${activeId}`} className="press flex h-12 items-center justify-center gap-2 rounded-full bg-brand text-sm font-extrabold text-on-brand">
                  {t("home.openTrip")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}

/** The accepted trips didn't load: say so (an accepted trip never just vanishes), with retry. */
function AcceptedError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useT();
  const offline = (error as { code?: string } | null)?.code === "NETWORK_ERROR";
  return (
    <section role="alert" className="flex items-center gap-3 rounded-card bg-danger-soft p-4">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-15 font-extrabold text-ink">{t("home.acceptedError")}</span>
        <span className="text-13 font-semibold text-muted">{offline ? t("state.offlineDesc") : errorMessage(error, t)}</span>
      </span>
      <Button variant="secondary" size="sm" onClick={onRetry} className="shrink-0">
        <RefreshCw className="h-4 w-4" />
        {t("common.retry")}
      </Button>
    </section>
  );
}

function passengerLabel(b: Booking, i: number, t: (k: TranslationKey, p?: Record<string, string | number>) => string) {
  const who = b.passenger?.name ?? (b.kind === "delivery" ? t("feed.kind.delivery") : t("home.passengerN", { n: i + 1 }));
  const size = b.kind === "delivery" ? (b.freight ? t("feed.bodyShort", { size: b.freight.body.sizeLabel }) : "") : b.wholeCar ? t("feed.wholeCar") : t("feed.seatsShort", { n: b.seats });
  return size ? `${who} · ${size}` : who;
}
