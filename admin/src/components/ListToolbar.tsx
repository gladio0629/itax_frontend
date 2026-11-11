import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "./Input";

/** Shared search + filters bar for every list/table screen. Search text is
 * debounced inside useAdapterList, not here — this component just reflects
 * whatever the caller's state holds. Grows to fill its row so filters sit
 * inline with the search field instead of wrapping underneath it. */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Qidirish...",
  children,
  resultCount,
  hasActiveFilters,
  onClear,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  resultCount?: number;
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-72 max-w-full">
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder.replace(/\.{3}|…/g, "")}
            leftIcon={<Search className="h-4 w-4" />}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {children}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="flex h-10 items-center gap-2 rounded-button px-3 text-sm font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" /> Filtrlarni tozalash
          </button>
        )}
      </div>
      {resultCount !== undefined && (
        <p className="tabular text-xs text-ink/50" aria-live="polite">
          {resultCount} ta natija
        </p>
      )}
    </div>
  );
}
