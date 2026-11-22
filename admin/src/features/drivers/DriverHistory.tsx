import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Card, StatTile } from "@/components/Card";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { formatCompactSom, formatMonth, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { KIND_LABEL, ORDER_STATUS, PAYMENT_LABEL } from "@/features/orders/labels";
import { TripsTable } from "./TripsTable";
import { Route as RouteIcon } from "lucide-react";
import type { DriverProfile, DriverTrips, DriverTripsQuery } from "@/api/types";

type Kind = NonNullable<DriverTripsQuery["kind"]>;

/** Driver history (design DriverHistory): monthly summary from the server,
 * kind chips, month filter, trips with commission and the driver's share. */
export function DriverHistory({ driver }: { driver: DriverProfile }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>("all");
  const [month, setMonth] = useState<string>("");
  const [data, setData] = useState<DriverTrips | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(false);
    api
      .getDriverTrips(driver.id, { kind, month: month || undefined })
      .then((d) => {
        if (!live) return;
        setData(d);
        if (!month) setMonth(d.month);
      })
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver.id, kind, month]);
  useEffect(() => load(), [load]);

  if (error && !data) return <ErrorState onRetry={load} retrying={loading} />;
  if (!data)
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[118px] rounded-card" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-card" />
      </div>
    );

  const monthName = formatMonth(data.month).split(" ")[0].toUpperCase();
  const s = data.summary;
  const income = s ? formatCompactSom(s.income) : null;
  const commission = s ? formatCompactSom(s.commission) : null;
  const chips = [
    { key: "all" as Kind, label: "Hammasi", count: data.counts?.all },
    { key: "passenger" as Kind, label: "Yo'lovchi", count: data.counts?.passenger },
    { key: "delivery" as Kind, label: "Dostavka", count: data.counts?.delivery },
    { key: "cancelled" as Kind, label: "Bekor qilingan", count: data.counts?.cancelled },
  ];

  return (
    <div className={cn("flex flex-col gap-5 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
      {s && income && commission && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label={`Safarlar, ${monthName}`} value={formatNumber(s.trips)} delta={{ text: `jami ${formatNumber(s.tripsTotal)} ta`, direction: "flat" }} />
          <StatTile label={`Daromad, ${monthName}`} value={income.value} unit={income.unit} delta={{ text: "komissiyadan keyin, so'm", direction: "flat" }} />
          <StatTile
            label={`Komissiya, ${monthName}`}
            value={commission.value}
            unit={commission.unit}
            delta={s.commissionAvgPct !== null ? { text: `o'rtacha ${String(s.commissionAvgPct).replace(".", ",")}%`, direction: "flat" } : null}
          />
          <StatTile
            label="Bekor qilgan"
            value={formatNumber(s.cancelled)}
            delta={s.cancelledPct !== null ? { text: `${formatMonth(data.month).split(" ")[0].toLowerCase()}da, ${s.cancelledPct}%`, direction: "flat" } : null}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <FilterChips label="Safar turi" items={chips} value={kind} onChange={setKind} />
        <span className="flex-1" />
        {data.months.length > 0 && (
          <FilterSelect
            label="Davr"
            aria-label="Oy"
            value={month || data.month}
            onChange={setMonth}
            options={data.months.map((m) => ({ value: m, label: formatMonth(m) }))}
          />
        )}
        <ExportButton
          section="drivers"
          rows={data.rows}
          filenamePrefix={`haydovchi_${driver.id}_${data.month}`}
          buildRow={(r) => ({
            ID: r.orderId,
            Tur: KIND_LABEL[r.kind],
            Sana: new Date(r.at).toISOString(),
            Qayerdan: r.fromName,
            Qayerga: r.toName,
            "Yo'lovchi / yuk": r.subject,
            Narx: r.price,
            "To'lov": PAYMENT_LABEL[r.paymentMethod],
            Komissiya: r.commission ?? "",
            Haydovchiga: r.payout ?? "",
            Holat: ORDER_STATUS[r.status].label,
          })}
        />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState icon={<RouteIcon />} title="Safar yo'q" description="Bu oyda tanlangan turdagi safar topilmadi." />
      ) : (
        <Card className="flex min-w-0 flex-col gap-4 p-4">
          <TripsTable rows={data.rows} onOpen={(id) => navigate(`/orders/${id}`)} />
          <p className="text-13 font-semibold text-muted">
            {formatNumber(data.rows.length)} ta safar · {formatMonth(data.month)}
          </p>
        </Card>
      )}
    </div>
  );
}
