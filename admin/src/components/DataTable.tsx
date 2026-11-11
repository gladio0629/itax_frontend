import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "./Input";
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
  searchPlaceholder = "Qidirish...",
  pageSize = 10,
  onRowClick,
  emptyIcon,
  emptyTitle = "Hech narsa topilmadi",
  emptyDescription = "Qidiruv shartlariga mos yozuv yo'q.",
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
        <div className="max-w-sm">
          <Input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={emptyIcon ?? <Search />} title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-border bg-card shadow-softer">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-ink/[0.02]">
                  {columns.map((col) => {
                    const active = sortKey === col.key;
                    const SortIcon = !active ? ChevronsUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        style={{ width: col.width }}
                        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                        className={cn("h-11 whitespace-nowrap px-3 text-xs font-semibold text-ink/60 xl:px-4", col.align === "right" && "text-right")}
                      >
                        {col.sortValue ? (
                          <button
                            type="button"
                            className={cn("-mx-2 inline-flex h-8 items-center gap-1 rounded-button px-2 hover:bg-ink/5 hover:text-ink", active && "text-ink")}
                            onClick={() => toggleSort(col.key)}
                          >
                            {col.header}
                            <SortIcon className={cn("h-3 w-3", !active && "text-ink/30")} aria-hidden />
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
                      "border-b border-border last:border-0 even:bg-ink/[0.015] hover:bg-accent-5",
                      onRowClick && "cursor-pointer focus-visible:bg-accent-5 focus-visible:outline-offset-[-2px]"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        title={col.truncate?.title(row)}
                        style={col.truncate ? { maxWidth: col.truncate.maxWidth } : undefined}
                        className={cn("h-12 whitespace-nowrap px-3 py-2 text-ink xl:px-4", col.align === "right" && "tabular text-right", col.truncate && "truncate")}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4 text-sm text-ink/60">
            <span className="tabular">
              {safePage * pageSize + 1}–{Math.min(sorted.length, safePage * pageSize + pageRows.length)} / {sorted.length}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  aria-label="Oldingi sahifa"
                  className="flex h-8 w-8 items-center justify-center rounded-button border border-border bg-card text-ink hover:bg-ink/[0.04] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="tabular min-w-12 text-center text-ink">
                  {safePage + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  aria-label="Keyingi sahifa"
                  className="flex h-8 w-8 items-center justify-center rounded-button border border-border bg-card text-ink hover:bg-ink/[0.04] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
