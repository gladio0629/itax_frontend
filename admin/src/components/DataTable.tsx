import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { SearchInput } from "./Input";
import { Pagination } from "./Pagination";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "./EmptyState";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  width?: string;
  /** Right-align (amounts, counts). */
  align?: "left" | "right";
  /** Cap width and ellipsize; the full text shows as a native tooltip. */
  truncate?: { maxWidth: number; title: (row: T) => string };
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchFields?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Render without the white card around it (when the caller already has one). */
  bare?: boolean;
  /** Total matching rows as the server counts them. Without it the footer
   * shows how many rows were loaded, never "jami" (lists may be cut off). */
  total?: number | null;
  /** Extra class per row (e.g. the selected one). */
  rowClassName?: (row: T) => string | undefined;
};

/** Generic client-side search/sort/pagination table shared by the drivers,
 * passengers, orders and wallet ledger screens. Filtering/sorting here is
 * presentation logic only — all pricing/status business rules live in the
 * mock adapter, never in this component. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchFields,
  searchPlaceholder = "Qidirish…",
  pageSize = 10,
  onRowClick,
  emptyIcon,
  emptyTitle = "Hech narsa topilmadi",
  emptyDescription = "Qidiruv shartlariga mos yozuv yo'q.",
  bare,
  total,
  rowClassName,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim() || !searchFields) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => searchFields(r).toLowerCase().includes(q));
  }, [rows, query, searchFields]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-4">
      {searchFields && (
        <SearchInput
          className="w-[300px] max-w-full"
          label={searchPlaceholder.replace(/\.{3}|…/g, "")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          icon={<Search className="h-4 w-4" aria-hidden />}
        />
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={emptyIcon ?? <Search />} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className={cn("flex min-w-0 flex-col gap-4", !bare && "rounded-card bg-white p-4 shadow-card")}>
          {/* The table scrolls inside its own box; the page never scrolls sideways. */}
          <div className="min-w-0 overflow-x-auto rounded-box shadow-hairline">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-surface">
                  {columns.map((col) => {
                    const active = sortKey === col.key;
                    const SortIcon = !active ? ChevronsUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        style={{ width: col.width }}
                        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                        className={cn("h-11 whitespace-nowrap px-3 text-2xs font-bold uppercase tracking-[0.6px] text-muted", col.align === "right" && "text-right")}
                      >
                        {col.sortValue ? (
                          <button
                            type="button"
                            className={cn("-mx-2 inline-flex h-8 items-center gap-1 rounded-full px-2 uppercase hover:bg-white hover:text-ink", active && "text-ink")}
                            onClick={() => toggleSort(col.key)}
                          >
                            {col.header}
                            <SortIcon className={cn("h-3 w-3", !active && "text-muted/50")} aria-hidden />
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={() => onRowClick?.(row)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "border-b border-line last:border-0 hover:bg-row-hover",
                      rowClassName?.(row),
                      onRowClick && "cursor-pointer focus-visible:bg-surface focus-visible:outline-offset-[-2px]"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        title={col.truncate?.title(row)}
                        style={col.truncate ? { maxWidth: col.truncate.maxWidth } : undefined}
                        className={cn("h-[60px] whitespace-nowrap px-3 py-2 text-sm font-semibold text-ink", col.align === "right" && "tabular text-right", col.truncate && "truncate")}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            summary={`${safePage * pageSize + 1}–${safePage * pageSize + pageRows.length}, ${
              total != null && !searchFields ? `jami ${formatNumber(total)}` : `${formatNumber(sorted.length)} ta`
            }`}
            hasPrev={safePage > 0}
            hasNext={safePage < pageCount - 1}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        </div>
      )}
    </div>
  );
}
