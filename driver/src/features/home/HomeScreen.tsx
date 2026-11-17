import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { FeedType, TripSummary } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { useFeedSignal } from "@/stores/feedSignal";
import { Armchair, Bell, ChevronDown, ChevronUp, LocateFixed } from "@/lib/icons";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Skeleton";
import { Chip } from "@/components/Chip";
import { SwipeTabs } from "@/components/SwipeTabs";
import { cn } from "@/lib/cn";
import { HomeMap } from "./HomeMap";
import { NewRequestsTab } from "./NewRequestsTab";
import { AcceptedTab } from "./AcceptedTab";
import { TripSummaryCard } from "./TripSummaryCard";
import { NotificationsSheet } from "./NotificationsSheet";
import { dayText } from "./whenText";

const TYPES: FeedType[] = ["all", "passengers", "delivery"];

/** Map visible above the feed, without the safe-area inset. */
const MAP_STRIP_PX = 156;
/** The seat summary card at the bottom of the map, with its margin. */
const SEAT_CARD_PX = 64;
/** What stays of the feed while the map is open: its handle, chips and tabs. */
const FEED_PEEK_PX = 136;

/**
 * Asosiy: a full-screen map with the request feed as a sheet over it. By
 * default the sheet leaves a strip of the map on top; its handle opens the
 * whole map (the driver's position, and the route of the accepted trip).
 * The feed: seat summary and direction chips, then "Yangi so'rovlar" /
 * "Qabul qilinganlar". Tab and filters live in the URL
 * (?tab=&dir=&date=&type=&request=).
 */
export default function HomeScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "accepted" ? 1 : 0;
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
  const [notifOpen, setNotifOpen] = useState(false);
  const [done, setDone] = useState<TripSummary | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [refit, setRefit] = useState(0);
  // How much of the map the feed sheet covers: the camera stays above it.
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [covered, setCovered] = useState(0);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const header = headerRef.current;
    if (!root || !header) return;
    const read = () => setCovered(Math.max(0, root.clientHeight - header.clientHeight));
    read();
    let timer: ReturnType<typeof setTimeout>;
    // After the open/close transition settles, not on each of its frames.
    const measure = () => {
      clearTimeout(timer);
      timer = setTimeout(read, 120);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(header);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  const update = useCallback(
    (next: Record<string, string | null>) => {
      const p = new URLSearchParams(params);
      for (const [k, v] of Object.entries(next)) {
        if (v == null || (k === "dir" && v === "all") || (k === "date" && v === "today") || (k === "type" && v === "all") || (k === "tab" && v === "new")) p.delete(k);
        else p.set(k, v);
      }
      setParams(p, { replace: true });
    },
    [params, setParams]
  );

  // Looking at "Yangi so'rovlar" clears the Asosiy badge.
  const feedVersion = feed.data;
  useEffect(() => {
    if (tab !== 0 || !feedVersion || document.visibilityState !== "visible") return;
    api.markFeedSeen().then(() => summary.reload(true)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, feedVersion]);

  // A highlighted card (from a banner) stays marked for a moment, then the param clears.
  useEffect(() => {
    if (!highlightId) return;
    const id = setTimeout(() => update({ request: null }), 2500);
    return () => clearTimeout(id);
  }, [highlightId, update]);

  const page = feed.data;
  const seats = page?.seats;
  const acceptedCount = accepted.data?.count ?? 0;
  const s = summary.data;

  return (
    <div ref={rootRef} className="relative flex h-full flex-col overflow-hidden">
      <h1 className="sr-only">{t("home.title")}</h1>
      {/* The map fills the screen; the header and the feed sheet lie over it. */}
      <HomeMap
        label={t("home.mapLabel")}
        routeLabel={t("home.mapRouteLabel")}
        accepted={accepted.data}
        // Clear of the feed sheet and the seat card; of the top buttons too
        // once the map is open (the strip is too low for that).
        padding={{ top: mapOpen ? 72 : 0, bottom: covered + (api.capabilities.seatSummary ? SEAT_CARD_PX : 0) }}
        refit={refit}
      />
      {/* Transparent: map gestures pass through, its own buttons don't. */}
      <header
        ref={headerRef}
        className="pointer-events-none relative shrink-0 transition-[height] duration-300 ease-out motion-reduce:transition-none [&_button]:pointer-events-auto"
        style={{ height: mapOpen ? `calc(100% - ${FEED_PEEK_PX}px)` : `calc(var(--safe-top) + ${MAP_STRIP_PX}px)` }}
      >
        {!mapOpen && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent" />}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4" style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}>
          <button
            type="button"
            onClick={() => navigate("/profile")}
            aria-label={t("home.openProfile")}
            className="press flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-2"
          >
            {profile.data ? <Avatar seed={profile.data.avatarSeed} name={profile.data.name} size={44} /> : <Skeleton className="h-11 w-11 rounded-full" />}
          </button>
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            aria-label={s?.unreadNotifications ? t("home.notificationsUnread", { n: s.unreadNotifications }) : t("home.notifications")}
            className="press relative flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink shadow-2"
          >
            <Bell className="h-6 w-6" />
            {!!s?.unreadNotifications && (
              <span className="tabular absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-fill px-1 text-xs font-bold text-white ring-2 ring-surface">
                {s.unreadNotifications}
              </span>
            )}
          </button>
        </div>

        {mapOpen && (
          <button
            type="button"
            onClick={() => setRefit((n) => n + 1)}
            aria-label={t("home.mapRecenter")}
            className={cn("press absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink shadow-2", api.capabilities.seatSummary ? "bottom-[76px]" : "bottom-4")}
          >
            <LocateFixed className="h-6 w-6" />
          </button>
        )}

        {/* Seat summary: computed by the adapter for the trip in focus (hidden when the backend has none). */}
        {api.capabilities.seatSummary && (
        <div className="absolute inset-x-4 bottom-2 flex items-center gap-3 rounded-card bg-surface/95 px-3 py-2 shadow-2 backdrop-blur">
          {seats ? (
            <>
              <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                {Array.from({ length: seats.total }, (_, i) => (
                  <Armchair key={i} className={cn("h-5 w-5", i < seats.total - seats.free ? "text-muted/50" : "text-gold")} />
                ))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="tabular whitespace-nowrap text-base font-bold leading-tight text-ink">{t("home.freeSeats", { free: seats.free, total: seats.total })}</p>
                <p className="truncate text-xs text-muted">
                  {dayText(seats.when, t)}
                  {seats.direction && ` · ${seats.direction.from.name} → ${seats.direction.to.name}`}
                </p>
              </div>
            </>
          ) : (
            <Skeleton className="h-7 w-full" />
          )}
        </div>
        )}
      </header>

      {/* The feed sheet. */}
      <div className="relative flex min-h-0 flex-1 flex-col bg-bg">
      <button
        type="button"
        onClick={() => setMapOpen((v) => !v)}
        aria-expanded={mapOpen}
        aria-label={mapOpen ? t("home.mapClose") : t("home.mapOpen")}
        className="press flex h-7 w-full shrink-0 items-center justify-center text-muted"
      >
        {mapOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {/* Direction chips: the driver's own Yo'nalishlarim. */}
      {api.capabilities.feedFilters && (
      <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 pb-1 pt-2" role="group" aria-label={t("feed.directions")}>
        <Chip selected={direction === "all"} onClick={() => update({ dir: "all" })} className="h-10">
          {t("common.all")}
        </Chip>
        {page?.directions.map((d) => (
          <Chip key={d.id} selected={direction === d.id} onClick={() => update({ dir: d.id })} className="h-10 whitespace-nowrap">
            {d.from.name} → {d.to.name}
          </Chip>
        ))}
      </div>
      )}

      <SwipeTabs
        label={t("feed.tabs")}
        index={tab}
        onIndexChange={(i) => update({ tab: i === 1 ? "accepted" : "new" })}
        tabs={[
          {
            id: "new",
            label: (
              <>
                {t("feed.tabNew")}
                {!!s?.newRequests && tab !== 0 && <CountBadge n={s.newRequests} />}
              </>
            ),
            content: (
              <NewRequestsTab
                feed={feed}
                date={date}
                type={type}
                highlightId={highlightId}
                summary={s}
                onFilter={(p) => update({ date: p.date ?? date, type: p.type ?? type })}
                onAccepted={() => {
                  accepted.reload(true);
                  bump();
                }}
              />
            ),
          },
          {
            id: "accepted",
            label: (
              <>
                {t("feed.tabAccepted")}
                {acceptedCount > 0 && <CountBadge n={acceptedCount} muted />}
              </>
            ),
            content: (
              <AcceptedTab
                accepted={accepted}
                onChanged={() => feed.reload(true)}
                onSummary={setDone}
                onShowNew={() => update({ tab: "new" })}
              />
            ),
          },
        ]}
      />
      </div>

      {done && (
        <div className="absolute inset-x-4 bottom-4 z-30">
          <TripSummaryCard summary={done} onDismiss={() => setDone(null)} />
        </div>
      )}

      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} onRead={() => summary.reload(true)} />
    </div>
  );
}

function CountBadge({ n, muted }: { n: number; muted?: boolean }) {
  return (
    <span className={cn("tabular flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold", muted ? "bg-raised text-ink" : "bg-yellow text-on-yellow")}>
      {n}
    </span>
  );
}
