import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { HistoryFilter, HistoryRange } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { formatShort } from "@/lib/format";
import { Car, Search, SearchX, SlidersHorizontal, X } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Sheet } from "@/components/Sheet";
import { ActiveTripCard } from "@/features/home/ActiveTripCard";
import { TripSummaryCard } from "@/features/home/TripSummaryCard";
import { CancelSheet } from "@/features/home/CancelSheet";
import { useTripController } from "@/features/home/useTripController";
import { SwipeTabs } from "./SwipeTabs";
import { HistoryCard } from "./HistoryCard";

const DEFAULT_FILTER: HistoryFilter = { range: "all", minEarnings: 0, city: "" };

export default function OrdersScreen() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const index = params.get("tab") === "history" ? 1 : 0;
  const setIndex = (i: number) => setParams(i === 1 ? { tab: "history" } : {}, { replace: true });

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("orders.title")} />
      <SwipeTabs
        label={t("orders.tabsLabel")}
        index={index}
        onIndexChange={setIndex}
        tabs={[
          { id: "active", label: t("orders.tabActive"), content: <ActivePanel /> },
          { id: "history", label: t("orders.tabHistory"), content: <HistoryPanel /> },
        ]}
      />
    </div>
  );
}

function ActivePanel() {
  const { t } = useT();
  const navigate = useNavigate();
  const tc = useTripController();
  const [cancelOpen, setCancelOpen] = useState(false);

  return (
    <div className="px-4 pb-6 pt-4">
      {tc.summary ? (
        <TripSummaryCard summary={tc.summary} onDismiss={tc.dismissSummary} />
      ) : tc.error && !tc.trip ? (
        <ErrorState error={tc.error} onRetry={() => tc.reload()} />
      ) : tc.loading ? (
        <SkeletonList rows={2} label={t("common.loading")} />
      ) : tc.trip ? (
        <ActiveTripCard trip={tc.trip} confirming={tc.confirming} onAction={tc.advance} onCancel={() => setCancelOpen(true)} className="shadow-1" />
      ) : (
        <EmptyState
          icon={Car}
          title={t("orders.emptyActiveTitle")}
          description={t("orders.emptyActiveDesc")}
          action={
            <Button fullWidth onClick={() => navigate("/")}>
              {t("orders.goHome")}
            </Button>
          }
        />
      )}
      <CancelSheet
        open={cancelOpen}
        busy={tc.cancelBusy}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          if (await tc.cancel(reason)) setCancelOpen(false);
        }}
      />
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
    const p: Record<string, string> = { tab: "history" };
    if (f.range !== "all") p.range = f.range;
    if (f.minEarnings) p.min = String(f.minEarnings);
    if (f.city) p.city = f.city;
    setParams(p, { replace: true });
  };
  return [filter, set];
}

function HistoryPanel() {
  const { t } = useT();
  const [filter, setFilter] = useHistoryFilter();
  const [cityInput, setCityInput] = useState(filter.city);
  const [sheetOpen, setSheetOpen] = useState(false);
  const debounce = useRef<number>();
  useEffect(() => () => window.clearTimeout(debounce.current), []);
  const history = useQuery(() => api.getHistory(filter), [filter.range, filter.minEarnings, filter.city]);
  const activeFilters = (filter.range !== "all" ? 1 : 0) + (filter.minEarnings > 0 ? 1 : 0);
  const dirty = activeFilters > 0 || filter.city !== "";

  return (
    <div className="px-4 pb-6 pt-4">
      <div className="flex gap-2">
        <form
          role="search"
          className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-button bg-raised px-3 focus-within:ring-2 focus-within:ring-inset focus-within:ring-yellow"
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
            <span className="tabular absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow text-xs font-bold text-on-yellow">{activeFilters}</span>
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

      <div className="mt-4" aria-live="polite" aria-busy={history.loading}>
        {history.error ? (
          <ErrorState error={history.error} onRetry={() => history.reload()} />
        ) : !history.data ? (
          <SkeletonList rows={5} label={t("common.loading")} />
        ) : history.data.items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t("orders.emptyHistoryTitle")}
            description={t("orders.emptyHistoryDesc")}
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
            <p className="tabular mb-2 px-1 text-sm text-muted">{t("orders.found", { n: history.data.total })}</p>
            <ul className="space-y-3">
              {history.data.items.map((item) => (
                <li key={item.id}>
                  <HistoryCard item={item} />
                </li>
              ))}
            </ul>
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
