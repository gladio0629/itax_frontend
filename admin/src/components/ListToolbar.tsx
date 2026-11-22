import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { SearchInput } from "./Input";

/** Shared search + filters bar for every list/table screen. Search text is
 * debounced inside useAdapterList, not here — this component just reflects
 * whatever the caller's state holds. Grows to fill its row so filters sit
 * inline with the search field instead of wrapping underneath it. */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Qidirish…",
  children,
  resultCount,
  hasActiveFilters,
  onClear,
  searchEnabled = true,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  resultCount?: number;
  hasActiveFilters: boolean;
  onClear: () => void;
  /** false when the backend can't search this list (the field is hidden). */
  searchEnabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {searchEnabled && (
          <SearchInput
            className="w-[300px] max-w-full"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            label={searchPlaceholder.replace(/\.{3}|…/g, "")}
            icon={<Search className="h-4 w-4" aria-hidden />}
          />
        )}
        {children}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="flex h-11 items-center gap-2 rounded-full px-3.5 text-13 font-bold text-muted hover:bg-white hover:text-ink"
          >
            <X className="h-4 w-4" /> Filtrlarni tozalash
          </button>
        )}
      </div>
      {resultCount !== undefined && (
        <p className="tabular text-xs font-semibold text-muted" aria-live="polite">
          {resultCount} ta natija
        </p>
      )}
    </div>
  );
}
