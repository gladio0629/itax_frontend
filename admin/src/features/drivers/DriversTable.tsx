import { Car } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { LevelBadge, PersonCell } from "@/components/Cells";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { driverBadge } from "./driverLabels";
import type { ReactNode } from "react";
import type { Driver } from "@/api/types";

/**
 * Drivers table (design Drivers). Also used read-only by the operator's
 * "Haydovchilar" window (group 5): `showBalance={false}` and no actions.
 */
export function DriversTable({
  rows,
  showBalance,
  total,
  onOpen,
  actions,
}: {
  rows: Driver[];
  showBalance: boolean;
  total?: number | null;
  onOpen?: (d: Driver) => void;
  actions?: (d: Driver) => ReactNode;
}) {
  const columns: Column<Driver>[] = [
    { key: "name", header: "Haydovchi", sortValue: (d) => d.name, render: (d) => <PersonCell name={d.name} sub={d.phone} /> },
    {
      key: "car",
      header: "Mashina",
      render: (d) => (
        <span className="text-ink">
          {d.carModel}
          {d.plate && <span className="text-muted"> · {d.plate}</span>}
        </span>
      ),
    },
    ...(rows.some((d) => d.route)
      ? [{ key: "route", header: "Yo'nalish", render: (d: Driver) => d.route ?? "—" } satisfies Column<Driver>]
      : []),
    { key: "rating", header: "Reyting", sortValue: (d) => d.rating, render: (d) => (d.rating ? d.rating.toFixed(2) : "—") },
    { key: "trips", header: "Safarlar", align: "right", sortValue: (d) => d.totalTrips, render: (d) => formatNumber(d.totalTrips) },
    ...(rows.some((d) => d.level) ? [{ key: "level", header: "Daraja", render: (d: Driver) => <LevelBadge level={d.level} /> } satisfies Column<Driver>] : []),
    ...(showBalance
      ? [
          {
            key: "balance",
            header: "Balans",
            align: "right",
            sortValue: (d: Driver) => d.walletBalance,
            render: (d: Driver) => (
              <span className={cn("font-bold", d.walletBalance < 0 ? "text-error" : "text-ink")}>{formatNumber(d.walletBalance)}</span>
            ),
          } satisfies Column<Driver>,
        ]
      : []),
    {
      key: "status",
      header: "Holat",
      render: (d) => {
        const b = driverBadge(d);
        return <Badge tone={b.tone}>{b.label}</Badge>;
      },
    },
    ...(actions ? [{ key: "actions", header: "", width: "56px", render: actions } satisfies Column<Driver>] : []),
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(d) => d.id}
      onRowClick={onOpen}
      total={total}
      emptyIcon={<Car />}
      emptyTitle="Haydovchi topilmadi"
      emptyDescription="Filtrlarni o'zgartirib ko'ring."
    />
  );
}
