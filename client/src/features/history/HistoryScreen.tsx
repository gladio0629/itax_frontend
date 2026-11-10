import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History as HistoryIcon, Star } from "lucide-react";
import { api } from "@/api/client";
import type { OrderStatus, OrderWithDetails } from "@/api/types";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { formatRelativeDay, formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

const STATUS_TONE: Record<string, { tone: "accent" | "danger" | "neutral" | "warning"; labelKey: TranslationKey }> = {
  completed: { tone: "accent", labelKey: "history.status.completed" },
  cancelled: { tone: "danger", labelKey: "history.status.cancelled" },
  no_driver: { tone: "warning", labelKey: "history.status.noDriver" },
  in_progress: { tone: "warning", labelKey: "history.status.inProgress" },
  accepted: { tone: "warning", labelKey: "history.status.accepted" },
  searching: { tone: "neutral", labelKey: "history.status.searching" },
};

const FILTERS = ["all", "completed", "cancelled"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_KEY: Record<Filter, TranslationKey> = {
  all: "history.filter.all",
  completed: "history.filter.completed",
  cancelled: "history.filter.cancelled",
};

type LoadState = "loading" | "error" | "ready";

export function HistoryScreen() {
  const navigate = useNavigate();
  const { t, intlTag } = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [state, setState] = useState<LoadState>("loading");

  function load(reset: boolean) {
    setState("loading");
    const status: OrderStatus | undefined = filter === "all" ? undefined : (filter as OrderStatus);
    api
      .getOrderHistory({ status, cursor: reset ? 0 : cursor ?? 0 })
      .then((page) => {
        setOrders((prev) => (reset ? page.orders : [...prev, ...page.orders]));
        setCursor(page.nextCursor);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="pl-16 pr-5" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
        <h1 className="text-lg font-semibold text-ink">{t("history.title")}</h1>
      </div>

      <div className="flex gap-2 px-4 pt-4 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 rounded-full border-2 px-4 py-2 text-xs font-semibold transition-colors",
              filter === f ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
            )}
          >
            {t(FILTER_KEY[f])}
          </button>
        ))}
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 pt-4"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
      >
        {state === "loading" && orders.length === 0 && <SkeletonList count={5} />}
        {state === "error" && <ErrorState onRetry={() => load(true)} />}
        {state === "ready" && orders.length === 0 && (
          <EmptyState
            icon={<HistoryIcon className="h-7 w-7" />}
            title={t("history.emptyTitle")}
            description={t("history.emptyDesc")}
            actionLabel={t("history.emptyAction")}
            onAction={() => navigate("/home")}
          />
        )}
        {orders.length > 0 && (
          <div className="space-y-2">
            {orders.map((o) => {
              const status = STATUS_TONE[o.status] ?? STATUS_TONE.searching;
              return (
                <button
                  key={o.id}
                  onClick={() => navigate(`/history/${o.id}`)}
                  className="flex w-full flex-col gap-2 rounded-2xl bg-card p-4 text-left shadow-softer"
                >
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
                        <span className="flex items-center gap-0.5 font-medium text-ink">
                          <Star className="h-3 w-3 fill-brand-yellow text-brand-yellow" /> {o.rating}
                        </span>
                      )}
                      <span className="font-semibold tabular text-ink/80">{formatSom(o.price, intlTag)}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {cursor !== null && orders.length > 0 && (
          <button
            onClick={() => load(false)}
            className="mt-3 w-full rounded-xl border border-border py-3 text-xs font-semibold text-ink/70"
          >
            {t("history.loadMore")}
          </button>
        )}
      </div>
    </div>
  );
}
