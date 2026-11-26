import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { HistoryFilter, HistoryItem, HistoryRange, HistorySummary, OrderKind } from "@/api/types";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { formatAmount, formatDate, formatShort } from "@/lib/format";
import { dayLabel } from "@/lib/relative";
import { Armchair, Package, Search, SearchX, X } from "@/lib/icons";
import { Screen, HeaderButton } from "@/components/Screen";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Sheet } from "@/components/Sheet";
import { SectionLabel } from "@/components/Card";
import { cn } from "@/lib/cn";
import { HistoryCard } from "./HistoryCard";

const DEFAULT_FILTER: HistoryFilter = { range: "all", minEarnings: 0, city: "" };
const RANGES: HistoryRange[] = ["all", "today", "week", "month"];
const KINDS: OrderKind[] = ["passengers", "delivery"];
/** Filters only when the backend can filter (capabilities.historyFilters). */
const FILTERS = api.capabilities.historyFilters;

/** Filters live in the URL (?range=&min=&city=&kind=) so they survive reloads and deep links. */
function useHistoryFilter(): [HistoryFilter, (next: HistoryFilter | ((f: HistoryFilter) => HistoryFilter)) => void] {
  const [params, setParams] = useSearchParams();
  const rangeParam = params.get("range") as HistoryRange | null;
  const kindParam = params.get("kind") as OrderKind | null;
  const filter: HistoryFilter = {
    range: rangeParam && RANGES.includes(rangeParam) ? rangeParam : "all",
    minEarnings: Number(params.get("min")) || 0,
    city: params.get("city") ?? "",
    kind: kindParam && KINDS.includes(kindParam) ? kindParam : undefined,
  };
  const set = (next: HistoryFilter | ((f: HistoryFilter) => HistoryFilter)) => {
    const f = typeof next === "function" ? next(filter) : next;
    const p: Record<string, string> = {};
    if (f.range !== "all") p.range = f.range;
    if (f.minEarnings) p.min = String(f.minEarnings);
    if (f.city) p.city = f.city;
    if (f.kind) p.kind = f.kind;
    setParams(p, { replace: true });
  };
  return [filter, set];
}

/**
 * Tarix (design v2): the period's total, trips and a bar per day on the Ink
 * top (when the server sums them), period and kind chips, then the trips
 * grouped by day. City search and minimum earnings sit behind the search button.
 */
export default function HistoryScreen() {
  const { t } = useT();
  const [filter, setFilterRaw] = useHistoryFilter();
  const [cityInput, setCityInput] = useState(filter.city);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState(1);
  const setFilter: typeof setFilterRaw = (next) => {
    setPage(1);
    setFilterRaw(next);
  };
  const debounce = useRef<number>();
  useEffect(() => () => window.clearTimeout(debounce.current), []);
  const history = useQuery(() => api.getHistory({ ...filter, page }), [filter.range, filter.minEarnings, filter.city, filter.kind, page]);
  const data = history.data;
  const dirty = filter.range !== "all" || filter.minEarnings > 0 || filter.city !== "" || !!filter.kind;
  const sheetActive = filter.minEarnings > 0 || filter.city !== "";
  const toggleRange = (r: HistoryRange) => setFilter((f) => ({ ...f, range: f.range === r ? "all" : r }));

  // Grouped by day, in the server's order.
  const groups: { label: string; items: HistoryItem[] }[] = [];
  for (const it of data?.items ?? []) {
    const label = dayLabel(it.createdAt, t);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }

  return (
    <Screen
      title={t("orders.title")}
      right={
        FILTERS && (
          <HeaderButton label={t("history.searchFilters")} onClick={() => setSheetOpen(true)}>
            <Search className="h-5 w-5" />
            {sheetActive && <span className="absolute right-[9px] top-[9px] h-[9px] w-[9px] rounded-full border-2 border-night bg-brand" />}
          </HeaderButton>
        )
      }
      top={data?.summary ? <SummaryTop s={data.summary} /> : undefined}
    >
      <div className="flex flex-col gap-4">
        {FILTERS && (
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label={t("orders.filters")}>
            <Chip selected={filter.range === "week"} onClick={() => toggleRange("week")}>
              {t("history.week")}
            </Chip>
            <Chip selected={filter.range === "month"} onClick={() => toggleRange("month")}>
              {t("history.month")}
            </Chip>
            {KINDS.map((k) => (
              <Chip key={k} selected={filter.kind === k} onClick={() => setFilter((f) => ({ ...f, kind: f.kind === k ? undefined : k }))}>
                {k === "passengers" ? <Armchair className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                {k === "passengers" ? t("feed.kind.passengers") : t("feed.kind.delivery")}
              </Chip>
            ))}
          </div>
        )}

        <div aria-live="polite" aria-busy={history.loading}>
          {history.error && (page === 1 || !data) ? (
            <ErrorState error={history.error} onRetry={() => history.reload()} />
          ) : !data ? (
            <SkeletonList rows={4} label={t("common.loading")} />
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={dirty ? t("orders.emptyHistoryTitle") : t("orders.noTripsTitle")}
              description={dirty ? t("orders.emptyHistoryDesc") : t("orders.noTripsDesc")}
              action={
                dirty ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      setCityInput("");
                      setFilter(DEFAULT_FILTER);
                    }}
                  >
                    {t("orders.resetFilters")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {groups.map((g) => (
                <section key={g.label} aria-label={g.label} className="mb-2">
                  <SectionLabel className="mb-0 pt-1">{g.label}</SectionLabel>
                  <ul className="flex flex-col">
                    {g.items.map((item) => (
                      <li key={item.id} className="border-b border-line last:border-b-0">
                        <HistoryCard item={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {data.hasMore && (
                <Button variant="secondary" fullWidth className="mt-3" loading={history.loading} onClick={() => setPage((p) => p + 1)}>
                  {t("common.loadMore")}
                </Button>
              )}
              {history.error != null && page > 1 && <ErrorState error={history.error} onRetry={() => history.reload()} />}
            </>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t("history.searchFilters")}>
        <form
          role="search"
          className="mb-5 flex h-12 items-center gap-2 rounded-field bg-raised px-4"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter((f) => ({ ...f, city: cityInput }));
          }}
        >
          <Search className="h-5 w-5 shrink-0 text-muted" />
          <input
            type="search"
            name="city"
            enterKeyHint="search"
            autoComplete="off"
            value={cityInput}
            onChange={(e) => {
              setCityInput(e.target.value);
              const v = e.target.value;
              window.clearTimeout(debounce.current);
              debounce.current = window.setTimeout(() => setFilter((f) => ({ ...f, city: v })), 300);
            }}
            placeholder={t("orders.searchCity")}
            aria-label={t("orders.searchCity")}
            className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-ink outline-none placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {cityInput && (
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={() => {
                setCityInput("");
                setFilter((f) => ({ ...f, city: "" }));
              }}
              className="-mr-3 flex h-12 w-12 items-center justify-center text-muted"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </form>
        <SectionLabel>{t("wallet.rangeFilter")}</SectionLabel>
        <div className="mb-5 flex flex-wrap gap-2">
          {(data?.filterOptions.ranges ?? RANGES).map((r) => (
            <Chip key={r} selected={filter.range === r} onClick={() => setFilter((f) => ({ ...f, range: r }))}>
              {t(`orders.range.${r}`)}
            </Chip>
          ))}
        </div>
        <SectionLabel>{t("orders.minEarnings")}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {(data?.filterOptions.minEarnings ?? []).map((m) => (
            <Chip key={m} selected={filter.minEarnings === m} onClick={() => setFilter((f) => ({ ...f, minEarnings: m }))}>
              {m === 0 ? t("orders.minAny") : t("orders.minFrom", { amount: formatShort(m) })}
            </Chip>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 pb-1">
          <Button
            variant="secondary"
            onClick={() => {
              setCityInput("");
              setFilter(DEFAULT_FILTER);
            }}
          >
            {t("orders.resetFilters")}
          </Button>
          <Button onClick={() => setSheetOpen(false)}>{t("common.done")}</Button>
        </div>
      </Sheet>
    </Screen>
  );
}

/** Ink top: the period, its total and trips, and the server's bar per day (today green). */
function SummaryTop({ s }: { s: HistorySummary }) {
  const { t } = useT();
  const max = Math.max(1, ...(s.days ?? []).map((d) => d.amount));
  const weekday = (date: string) => t(`weekday.${new Date(`${date}T12:00:00`).getDay()}` as TranslationKey);
  const sameDay = new Date(s.from).toDateString() === new Date(s.to).toDateString();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="label-caps text-night-muted">{sameDay ? formatDate(s.to, t) : `${formatDate(s.from, t)} – ${formatDate(s.to, t)}`}</span>
          <span className="tabular whitespace-nowrap text-[30px] font-extrabold leading-[1.1] tracking-[-0.5px] text-white">
            {formatAmount(s.total)} <span className="text-15 font-bold tracking-normal text-night-muted">{t("common.som")}</span>
          </span>
        </span>
        <span className="shrink-0 pb-1 text-13 font-semibold text-night-muted">{t("history.tripsN", { n: s.trips })}</span>
      </div>
      {s.days && s.days.length > 0 && (
        <div className="flex h-[124px] items-end gap-2" aria-hidden="true">
          {s.days.map((d, i) => {
            const today = i === s.days!.length - 1;
            return (
              <span key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className={cn("w-full rounded-[10px]", today ? "bg-brand" : "bg-night-bar")} style={{ height: `${Math.max(8, Math.round((d.amount / max) * 100))}%` }} />
                <span className={cn("text-xs font-bold capitalize", today ? "text-white" : "text-night-muted")}>{weekday(d.date)}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
