import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "./Input";
import { EmptyState } from "./EmptyState";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  width?: string;
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
        <EmptyState icon={emptyIcon ?? <Search className="h-6 w-6" />} title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-3xl bg-card shadow-softer">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/50"
                    >
                      {col.sortValue ? (
                        <button className="flex items-center gap-1 hover:text-ink" onClick={() => toggleSort(col.key)}>
                          {col.header}
                          <ChevronsUpDown className="h-3 w-3" />
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={() => onRowClick?.(row)}
                    className={cn("border-b border-border last:border-0", onRowClick && "cursor-pointer hover:bg-ink/[0.03]")}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-ink">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-ink/60">
            <span>
              {sorted.length} tadan {safePage * pageSize + 1}-{Math.min(sorted.length, safePage * pageSize + pageRows.length)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="tabular">
                {safePage + 1} / {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
