import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { Pagination } from "@/components/Pagination";

export type OpColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  width?: string;
};

/** Server page info for the footer ("1–8 / 43"). */
export type OpPageInfo = { page: number; pageSize: number; total: number; rows: number };

/**
 * Table for the operator windows. Rows, order and pages all come from the
 * server (no client-side sorting or slicing), so the footer shows the
 * server's total. Same look as DataTable.
 */
export function OpTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  pageInfo,
  onPage,
  loading,
  summaryStyle = "slash",
  empty,
}: {
  columns: OpColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageInfo?: OpPageInfo;
  onPage?: (page: number) => void;
  loading?: boolean;
  /** "jami" = "1–6, jami 48 210" (lists), "slash" = "1–8 / 43" (card tabs). */
  summaryStyle?: "jami" | "slash";
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const from = pageInfo ? (pageInfo.page - 1) * pageInfo.pageSize + (pageInfo.rows ? 1 : 0) : 0;
  const to = pageInfo ? (pageInfo.page - 1) * pageInfo.pageSize + pageInfo.rows : 0;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className={cn("min-w-0 overflow-x-auto rounded-box shadow-hairline transition-opacity", loading && "opacity-60")} aria-busy={loading || undefined}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={{ width: col.width }}
                  className={cn("h-11 whitespace-nowrap px-3 text-2xs font-bold uppercase tracking-[0.6px] text-muted", col.align === "right" && "text-right")}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
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
                  onRowClick && "cursor-pointer focus-visible:bg-surface focus-visible:outline-offset-[-2px]"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("h-12 whitespace-nowrap px-3 py-2 text-sm font-semibold text-ink", col.align === "right" && "tabular text-right")}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageInfo && onPage && (
        <Pagination
          summary={
            summaryStyle === "jami"
              ? `${from}–${to}, jami ${formatNumber(pageInfo.total)}`
              : `${from}–${to} / ${formatNumber(pageInfo.total)}`
          }
          hasPrev={pageInfo.page > 1}
          hasNext={pageInfo.page * pageInfo.pageSize < pageInfo.total}
          onPrev={() => onPage(pageInfo.page - 1)}
          onNext={() => onPage(pageInfo.page + 1)}
          loading={loading}
        />
      )}
    </div>
  );
}
