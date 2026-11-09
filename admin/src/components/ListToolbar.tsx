import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "./Input";

/** Shared search + filters bar for every list/table screen. Search text is
 * debounced inside useAdapterList, not here — this component just reflects
 * whatever the caller's state holds. */
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
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} leftIcon={<Search className="h-4 w-4" />} />
        </div>
        {children}
        {hasActiveFilters && (
          <button onClick={onClear} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-ink/60 hover:bg-ink/5">
            <X className="h-3.5 w-3.5" /> Filtrlarni tozalash
          </button>
        )}
      </div>
      {resultCount !== undefined && (
        <p className="text-xs text-ink/50">
          {resultCount} ta natija
        </p>
      )}
    </div>
  );
}
