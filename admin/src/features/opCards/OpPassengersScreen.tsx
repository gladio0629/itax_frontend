import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Search, Star, Users } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Badge } from "@/components/Badge";
import { SearchInput } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { PersonCell } from "@/components/Cells";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchFromUrl } from "@/hooks/useSearchFromUrl";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { opPath } from "@/features/ops/paths";
import { PASSENGER_STATUS } from "./labels";
import { OpTable, type OpColumn } from "./OpTable";
import { useOpData } from "./useOpData";
import type { OpPassengerRow, OpPassengerStatusFilter } from "@/api/opCards/types";
import type { PassengerStatus } from "@/api/types";

const STATUSES: PassengerStatus[] = ["active", "warned", "blocked"];

/** "Yo'lovchilar" operator window (design OpPassengers): search, status
 * chips and server pages; a row opens the passenger card. */
export function OpPassengersScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  useSearchFromUrl(setSearch);
  const q = useDebouncedValue(search, 300);
  const [status, setStatus] = useState<OpPassengerStatusFilter>("all");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useOpData(() => api.getOpPassengers({ search: q, status, page }), `${q}|${status}|${page}`);

  const chips = [
    { key: "all" as const, label: "Hammasi", count: data?.counts.all },
    ...STATUSES.map((s) => ({ key: s, label: PASSENGER_STATUS[s].label, count: data?.counts[s] })),
  ];

  const columns: OpColumn<OpPassengerRow>[] = [
    { key: "name", header: "Yo'lovchi", render: (p) => <PersonCell name={p.name} sub={p.phone} /> },
    { key: "orders", header: "Buyurtmalar", render: (p) => formatNumber(p.ordersCount) },
    {
      key: "rating",
      header: "Reyting",
      render: (p) =>
        p.rating ? (
          <span className="inline-flex items-center gap-1.5 font-bold">
            <Star className="h-3.5 w-3.5 fill-[#F5A700] text-[#F5A700]" aria-hidden />
            {p.rating.toFixed(1)}
          </span>
        ) : (
          "—"
        ),
    },
    { key: "last", header: "Oxirgi safar", render: (p) => (p.lastTripAt ? formatRelativeDay(p.lastTripAt) : "—") },
    { key: "status", header: "Holat", render: (p) => <Badge tone={PASSENGER_STATUS[p.status].tone}>{PASSENGER_STATUS[p.status].label}</Badge> },
    {
      key: "open",
      header: "",
      width: "56px",
      align: "right",
      render: (p) => (
        <Link
          to={opPath.passenger(p.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${p.name}: ochish`}
          title="Ochish"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink hover:bg-line"
        >
          <Eye className="h-[18px] w-[18px]" aria-hidden />
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader subtitle="Operator oynasi" title="Yo'lovchilar" />

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput
          className="w-[300px] max-w-full"
          label="Ism yoki telefon"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          icon={<Search className="h-4 w-4" aria-hidden />}
        />
        <FilterChips
          label="Holat bo'yicha"
          items={chips}
          value={status}
          onChange={(s) => {
            setStatus(s);
            setPage(1);
          }}
        />
      </div>

      {error && data && <StaleNotice onRetry={reload} />}
      {error && !data ? (
        <ErrorState message={error} onRetry={reload} retrying={loading} />
      ) : !data ? (
        <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data.rows.length === 0 ? (
        <EmptyState icon={<Users />} title="Yo'lovchi topilmadi" description="Qidiruv yoki filtrni o'zgartirib ko'ring." />
      ) : (
        <div className="rounded-card bg-white p-4 shadow-card">
          <OpTable
            columns={columns}
            rows={data.rows}
            rowKey={(p) => p.id}
            onRowClick={(p) => navigate(opPath.passenger(p.id))}
            pageInfo={{ page: data.page, pageSize: data.pageSize, total: data.total, rows: data.rows.length }}
            onPage={setPage}
            loading={loading}
            summaryStyle="jami"
          />
        </div>
      )}
    </>
  );
}
