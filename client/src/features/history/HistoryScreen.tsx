import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { History as HistoryIcon, Star } from "@/lib/icons";
import { api } from "@/api/client";
import type { OrderStatus, OrderWithDetails } from "@/api/types";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { PageTitle } from "@/components/PageTitle";
import { formatRelativeDay, formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { useIsIOS } from "@/lib/platform";
import { Segmented } from "@/components/ios/Segmented";

const STATUS_TONE: Record<string, { tone: "accent" | "danger" | "neutral" | "warning"; labelKey: TranslationKey }> = {
  completed: { tone: "accent", labelKey: "history.status.completed" },
  cancelled: { tone: "danger", labelKey: "history.status.cancelled" },
  no_driver: { tone: "warning", labelKey: "history.status.noDriver" },
  in_progress: { tone: "warning", labelKey: "history.status.inProgress" },
  accepted: { tone: "warning", labelKey: "history.status.accepted" },
  searching: { tone: "neutral", labelKey: "history.status.searching" },
};

const ALL_FILTERS = ["all", "completed", "cancelled"] as const;
type Filter = (typeof ALL_FILTERS)[number];
// The status tabs need a server-side filter; without one there's a single list.
const FILTERS: readonly Filter[] = api.capabilities.historyStatusFilter ? ALL_FILTERS : ["all"];
const SHOW_TABS = FILTERS.length > 1;
const FILTER_KEY: Record<Filter, TranslationKey> = {
  all: "history.filter.all",
  completed: "history.filter.completed",
  cancelled: "history.filter.cancelled",
};

type LoadState = "loading" | "error" | "ready";
type TabData = { orders: OrderWithDetails[]; cursor: number | null; state: LoadState };
const EMPTY_TAB: TabData = { orders: [], cursor: 0, state: "loading" };

function OrderRow({ o, intlTag }: { o: OrderWithDetails; intlTag: string }) {
  const { t } = useT();
  const status = STATUS_TONE[o.status] ?? STATUS_TONE.searching;
  return (
    <Link to={`/history/${o.id}`} className="flex w-full flex-col gap-2 rounded-xl bg-card p-4 text-left shadow-softer hover:bg-ink/[0.02] ios:transition-colors ios:duration-100 ios:active:bg-[var(--ios-row-pressed)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          {o.fromCity.name} &rarr; {o.toCity.name}
        </p>
        <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-ink/60">
        <span>{formatRelativeDay(o.createdAt, intlTag)}</span>
        <span className="flex items-center gap-2">
          {o.rating && (
            <span className="flex items-center gap-0.5 font-normal text-ink">
              <Star className="h-3 w-3 fill-brand-yellow text-brand-yellow" /> {o.rating}
            </span>
          )}
          <span className="font-semibold tabular text-ink/80">{formatSom(o.price, intlTag)}</span>
        </span>
      </div>
    </Link>
  );
}

function TabPane({
  data,
  onRetry,
  onLoadMore,
}: {
  data: TabData;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  const { t } = useT();
  const navigate = useNavigate();
  return (
    <div className="scroll-pb h-full w-full shrink-0 overflow-y-auto overscroll-contain px-4 pt-4">
      {data.state === "loading" && data.orders.length === 0 && <SkeletonList count={5} />}
      {data.state === "error" && <ErrorState onRetry={onRetry} />}
      {data.state === "ready" && data.orders.length === 0 && (
        <EmptyState
          icon={<HistoryIcon className="h-7 w-7" />}
          title={t("history.emptyTitle")}
          description={t("history.emptyDesc")}
          actionLabel={t("history.emptyAction")}
          onAction={() => navigate("/home")}
        />
      )}
      {data.orders.length > 0 && (
        <div className="space-y-2">
          {/* useT() inside OrderRow needs intlTag — passed explicitly since
              this pane doesn't otherwise depend on locale */}
          {data.orders.map((o) => (
            <OrderRowConnected key={o.id} order={o} />
          ))}
        </div>
      )}
      {data.cursor !== null && data.orders.length > 0 && (
        <button onClick={onLoadMore} className="mt-3 min-h-[44px] w-full rounded-xl border border-border py-3 text-xs font-semibold text-ink/70 hover:bg-ink/5">
          {t("history.loadMore")}
        </button>
      )}
    </div>
  );
}

function OrderRowConnected({ order }: { order: OrderWithDetails }) {
  const { intlTag } = useT();
  return <OrderRow o={order} intlTag={intlTag} />;
}

export function HistoryScreen() {
  const { t } = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = FILTERS.includes(searchParams.get("tab") as Filter) ? (searchParams.get("tab") as Filter) : "all";
  const [activeIndex, setActiveIndex] = useState(FILTERS.indexOf(initialTab));
  const [tabs, setTabs] = useState<Record<Filter, TabData>>({
    all: { ...EMPTY_TAB },
    completed: { ...EMPTY_TAB },
    cancelled: { ...EMPTY_TAB },
  });
  const loaded = useRef(new Set<Filter>());
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const [dragDX, setDragDX] = useState(0);
  const ios = useIsIOS();

  function loadTab(filter: Filter, reset: boolean) {
    setTabs((prev) => ({ ...prev, [filter]: { ...prev[filter], state: "loading" } }));
    const status: OrderStatus | undefined = filter === "all" ? undefined : (filter as OrderStatus);
    const cursor = reset ? 0 : tabs[filter].cursor ?? 0;
    api
      .getOrderHistory({ status, cursor })
      .then((page) => {
        setTabs((prev) => ({
          ...prev,
          [filter]: {
            orders: reset ? page.orders : [...prev[filter].orders, ...page.orders],
            cursor: page.nextCursor,
            state: "ready",
          },
        }));
      })
      .catch(() => setTabs((prev) => ({ ...prev, [filter]: { ...prev[filter], state: "error" } })));
  }

  useEffect(() => {
    const f = FILTERS[activeIndex];
    if (!loaded.current.has(f)) {
      loaded.current.add(f);
      loadTab(f, true);
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", f);
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, axis: null };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (!drag.current.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      drag.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (drag.current.axis === "x") setDragDX(dx);
  }
  function onPointerUp() {
    if (!drag.current) return;
    const threshold = 60;
    if (drag.current.axis === "x") {
      if (dragDX < -threshold && activeIndex < FILTERS.length - 1) setActiveIndex(activeIndex + 1);
      else if (dragDX > threshold && activeIndex > 0) setActiveIndex(activeIndex - 1);
    }
    drag.current = null;
    setDragDX(0);
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <PageTitle
        scrollKey={activeIndex}
        accessory={
          ios && SHOW_TABS ? (
            <Segmented
              ariaLabel={t("history.tabsLabel")}
              value={FILTERS[activeIndex]}
              onChange={(f) => setActiveIndex(FILTERS.indexOf(f))}
              tabs={{ id: (f) => `history-tab-${f}`, controls: (f) => `history-panel-${f}` }}
              options={FILTERS.map((f) => ({ id: f, label: t(FILTER_KEY[f]) }))}
            />
          ) : undefined
        }
      >
        {/* iOS: the short screen name, as in the drawer — it fits as a Large
            Title on every iPhone and reads as "‹ Tarix" on the detail page. */}
        {ios ? t("drawer.tarix") : t("history.title")}
      </PageTitle>

      {!ios && SHOW_TABS && (
      <div
        role="tablist"
        aria-label={t("history.tabsLabel")}
        className="flex border-b border-border px-4"
        onKeyDown={(e) => {
          const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (e.key === "Home" || e.key === "End" || delta) {
            e.preventDefault();
            const next = e.key === "Home" ? 0 : e.key === "End" ? FILTERS.length - 1 : (activeIndex + delta + FILTERS.length) % FILTERS.length;
            setActiveIndex(next);
            (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
          }
        }}
      >
        {FILTERS.map((f, i) => (
          <button
            key={f}
            id={`history-tab-${f}`}
            role="tab"
            aria-selected={activeIndex === i}
            aria-controls={`history-panel-${f}`}
            tabIndex={activeIndex === i ? 0 : -1}
            onClick={() => setActiveIndex(i)}
            className={cn(
              "relative min-h-[44px] flex-1 py-3 text-center text-sm font-semibold transition-colors",
              activeIndex === i ? "text-ink" : "text-ink/60"
            )}
          >
            {t(FILTER_KEY[f])}
            {activeIndex === i && <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-brand-yellow" />}
          </button>
        ))}
      </div>
      )}

      <div
        className="relative flex-1 overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: "pan-y" }}
      >
        <div
          ref={trackRef}
          className="flex h-full"
          style={{
            width: `${FILTERS.length * 100}%`,
            transform: `translateX(calc(${-activeIndex * (100 / FILTERS.length)}% + ${dragDX}px))`,
            transition: drag.current ? "none" : "transform 280ms cubic-bezier(0.2,0.8,0.2,1)",
          }}
        >
          {FILTERS.map((f, i) => (
            <div
              key={f}
              id={`history-panel-${f}`}
              role={SHOW_TABS ? "tabpanel" : undefined}
              aria-labelledby={SHOW_TABS ? `history-tab-${f}` : undefined}
              // Off-screen panes stay out of the tab order (React 18 types lack `inert`).
              {...((i !== activeIndex ? { inert: "" } : {}) as Record<string, string>)}
              style={{ width: `${100 / FILTERS.length}%` }}
              className="h-full shrink-0"
            >
              <TabPane data={tabs[f]} onRetry={() => loadTab(f, true)} onLoadMore={() => loadTab(f, false)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
