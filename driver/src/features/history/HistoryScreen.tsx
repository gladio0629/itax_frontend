import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { HistoryFilter, HistoryRange } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { formatShort } from "@/lib/format";
import { Search, SearchX, SlidersHorizontal, X } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Sheet } from "@/components/Sheet";
import { HistoryCard } from "./HistoryCard";

const DEFAULT_FILTER: HistoryFilter = { range: "all", minEarnings: 0, city: "" };

export default function HistoryScreen() {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("orders.title")} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <HistoryPanel />
      </div>
    </div>
  );
}

const RANGES: HistoryRange[] = ["all", "today", "week", "month"];

/** Filters live in the URL (?range=&min=&city=) so they survive reloads and deep links. */
function useHistoryFilter(): [HistoryFilter, (next: HistoryFilter | ((f: HistoryFilter) => HistoryFilter)) => void] {
  const [params, setParams] = useSearchParams();
  const rangeParam = params.get("range") as HistoryRange | null;
  const filter: HistoryFilter = {
    range: rangeParam && RANGES.includes(rangeParam) ? rangeParam : "all",
    minEarnings: Number(params.get("min")) || 0,
    city: params.get("city") ?? "",
  };
  const set = (next: HistoryFilter | ((f: HistoryFilter) => HistoryFilter)) => {
    const f = typeof next === "function" ? next(filter) : next;
    const p: Record<string, string> = {};
    if (f.range !== "all") p.range = f.range;
    if (f.minEarnings) p.min = String(f.minEarnings);
    if (f.city) p.city = f.city;
    setParams(p, { replace: true });
  };
  return [filter, set];
}

/** Filters only when the backend can filter (capabilities.historyFilters). */
const FILTERS = api.capabilities.historyFilters;

function HistoryPanel() {
  const { t } = useT();
  const [filter, setFilterRaw] = useHistoryFilter();
  const [cityInput, setCityInput] = useState(filter.city);
  const [sheetOpen, setSheetOpen] = useState(false);
  // "Load more" page; any filter change starts again from page 1.
  const [page, setPage] = useState(1);
  const setFilter: typeof setFilterRaw = (next) => {
    setPage(1);
    setFilterRaw(next);
  };
  const debounce = useRef<number>();
  useEffect(() => () => window.clearTimeout(debounce.current), []);
  const history = useQuery(() => api.getHistory({ ...filter, page }), [filter.range, filter.minEarnings, filter.city, page]);
  const activeFilters = (filter.range !== "all" ? 1 : 0) + (filter.minEarnings > 0 ? 1 : 0);
  const dirty = activeFilters > 0 || filter.city !== "";

  return (
    <div className="px-4 pb-6 pt-2">
      {FILTERS && (
      <>
      <div className="flex gap-2">
        <form
          role="search"
          className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-button bg-raised px-3 focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand"
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
              // Live filter after a short pause.
              const v = e.target.value;
              window.clearTimeout(debounce.current);
              debounce.current = window.setTimeout(() => setFilter((f) => ({ ...f, city: v })), 300);
            }}
            placeholder={t("orders.searchCity")}
            aria-label={t("orders.searchCity")}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
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
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={activeFilters ? `${t("orders.filters")}: ${activeFilters}` : t("orders.filters")}
          className="press relative flex h-12 w-12 shrink-0 items-center justify-center rounded-button bg-raised text-ink"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {activeFilters > 0 && (
            <span className="tabular absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand">{activeFilters}</span>
          )}
        </button>
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t("wallet.rangeFilter")}>
        {(history.data?.filterOptions.ranges ?? (["all", "today", "week", "month"] as HistoryRange[])).map((r) => (
          <Chip key={r} selected={filter.range === r} onClick={() => setFilter((f) => ({ ...f, range: r }))}>
            {t(`orders.range.${r}`)}
          </Chip>
        ))}
      </div>
      </>
      )}

      <div className={FILTERS ? "mt-4" : "mt-2"} aria-live="polite" aria-busy={history.loading}>
        {history.error && (page === 1 || !history.data) ? (
          <ErrorState error={history.error} onRetry={() => history.reload()} />
        ) : !history.data ? (
          <SkeletonList rows={5} label={t("common.loading")} />
        ) : history.data.items.length === 0 ? (
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
            {history.data.total != null && <p className="tabular mb-2 px-1 text-sm text-muted">{t("orders.found", { n: history.data.total })}</p>}
            <ul className="space-y-3">
              {history.data.items.map((item) => (
                <li key={item.id}>
                  <HistoryCard item={item} />
                </li>
              ))}
            </ul>
            {history.data.hasMore && (
              <Button variant="secondary" fullWidth className="mt-3" loading={history.loading} onClick={() => setPage((p) => p + 1)}>
                {t("common.loadMore")}
              </Button>
            )}
            {history.error != null && page > 1 && <ErrorState error={history.error} onRetry={() => history.reload()} />}
          </>
        )}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t("orders.filters")}>
        <p className="mb-2 text-sm text-muted">{t("wallet.rangeFilter")}</p>
        <div className="flex flex-wrap gap-2">
          {(history.data?.filterOptions.ranges ?? []).map((r) => (
            <Chip key={r} selected={filter.range === r} onClick={() => setFilter((f) => ({ ...f, range: r }))}>
              {t(`orders.range.${r}`)}
            </Chip>
          ))}
        </div>
        <p className="mb-2 mt-5 text-sm text-muted">{t("orders.minEarnings")}</p>
        <div className="flex flex-wrap gap-2">
          {(history.data?.filterOptions.minEarnings ?? []).map((m) => (
            <Chip key={m} selected={filter.minEarnings === m} onClick={() => setFilter((f) => ({ ...f, minEarnings: m }))}>
              {m === 0 ? t("orders.minAny") : t("orders.minFrom", { amount: formatShort(m) })}
            </Chip>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 pb-1">
          <Button
            variant="secondary"
            onClick={() => {
              setFilter((f) => ({ ...DEFAULT_FILTER, city: f.city }));
            }}
          >
            {t("orders.resetFilters")}
          </Button>
          <Button onClick={() => setSheetOpen(false)}>{t("common.done")}</Button>
        </div>
      </Sheet>
    </div>
  );
}
