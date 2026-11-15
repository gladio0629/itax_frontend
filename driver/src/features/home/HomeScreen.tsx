import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { FeedType, TripSummary } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { useFeedSignal } from "@/stores/feedSignal";
import { Armchair, Bell } from "@/lib/icons";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Skeleton";
import { Chip } from "@/components/Chip";
import { SwipeTabs } from "@/components/SwipeTabs";
import { cn } from "@/lib/cn";
import { DriverMap } from "./DriverMap";
import { NewRequestsTab } from "./NewRequestsTab";
import { AcceptedTab } from "./AcceptedTab";
import { TripSummaryCard } from "./TripSummaryCard";
import { NotificationsSheet } from "./NotificationsSheet";
import { dayText } from "./whenText";

const TYPES: FeedType[] = ["all", "passengers", "delivery"];

/**
 * Asosiy: the request feed. Map as a small header, seat summary and
 * direction chips on top, then "Yangi so'rovlar" / "Qabul qilinganlar".
 * Tab and filters live in the URL (?tab=&dir=&date=&type=&request=).
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
    <div className="flex h-full flex-col">
      <h1 className="sr-only">{t("home.title")}</h1>
      <header className="relative shrink-0 overflow-hidden" style={{ height: "calc(var(--safe-top) + 156px)" }}>
        <DriverMap label={t("home.mapLabel")} />
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent" />
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
