import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Inbox, XCircle } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Card, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { MiniStat } from "@/components/Cells";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterSelect } from "@/components/FilterSelect";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { useAdapterList } from "@/hooks/useAdapterList";
import { formatDateTime, formatNumber, formatShortDateTime } from "@/lib/format";
import { MyTasks } from "@/features/operators/OperatorHistory";
import { Tag } from "@/features/operators/labels";
import { OpHistoryTabs, useOrdersTotal, useTasksSummary } from "./OpHistoryTabs";
import { REQUEST_STATUS, REQUEST_TYPE } from "./requestLabels";
import { REQUEST_PARAM } from "./requestParam";
import { opPath } from "./paths";
import type { ManagerRequest, ManagerRequestStatus } from "@/api/ops/types";

const STATUS_OPTIONS: { value: ManagerRequestStatus | "all"; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "pending", label: "Kutilmoqda" },
  { value: "approved", label: "Tasdiqlandi" },
  { value: "rejected", label: "Rad etildi" },
];

/** Operator "Tarix" → "Mening vazifalarim" (design OpMyTasks): own requests
 * to a manager with their status (and the manager's reason when rejected),
 * then the resolved calls. Tiles and counters come from the server. */
export function OpTasksPage() {
  const ordersTotal = useOrdersTotal();
  const { summary, reload: reloadSummary } = useTasksSummary();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<ManagerRequestStatus | "all">("all");
  const { items, error, reload } = useAdapterList(api.getMyRequests, { status });
  // The request modal can open on this page too: refresh when it closes.
  const requestOpen = params.has(REQUEST_PARAM);
  const wasOpen = useRef(requestOpen);
  useEffect(() => {
    if (wasOpen.current && !requestOpen) {
      reload();
      reloadSummary();
    }
    wasOpen.current = requestOpen;
  }, [requestOpen, reload, reloadSummary]);

  const rejected = (items ?? []).filter((r) => r.status === "rejected" && r.decision?.reason);

  const columns: Column<ManagerRequest>[] = [
    { key: "code", header: "So'rov", sortValue: (r) => r.createdAt, render: (r) => <span className="font-extrabold">{r.code}</span> },
    { key: "type", header: "Turi", render: (r) => <Tag className="bg-surface text-ink">{REQUEST_TYPE[r.type]}</Tag> },
    {
      key: "subject",
      header: "Bog'liq",
      render: (r) =>
        r.order ? (
          <Link to={opPath.order(r.order.id)} onClick={(e) => e.stopPropagation()} className="font-bold text-green-text hover:underline">
            {r.order.label}
          </Link>
        ) : (
          <span className="tabular font-semibold">
            {r.subject.name}
            {r.subject.phone ? ` · ${r.subject.phone}` : ""}
          </span>
        ),
    },
    { key: "amount", header: "Summa", align: "right", render: (r) => (r.amount !== null ? formatNumber(r.amount) : "—") },
    { key: "sent", header: "Yuborildi", sortValue: (r) => r.createdAt, render: (r) => <span className="tabular text-muted">{formatShortDateTime(r.createdAt)}</span> },
    { key: "status", header: "Holat", render: (r) => <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge> },
  ];

  return (
    <>
      <PageHeader subtitle="Operator oynasi" title="Tarix" />
      <OpHistoryTabs first="tasks" ordersCount={ordersTotal} tasksCount={summary?.total} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary ? (
          <>
            <MiniStat label="Kutilmoqda" value={formatNumber(summary.pending)} sub="menejerda" />
            <MiniStat label="Tasdiqlandi" value={formatNumber(summary.approvedWeek)} sub="shu hafta" />
            <MiniStat label="Rad etildi" value={formatNumber(summary.rejectedWeek)} sub="shu hafta" tone={summary.rejectedWeek ? "danger" : undefined} />
            <MiniStat label="Hal qilingan murojaatlar" value={formatNumber(summary.resolvedToday)} sub="bugun" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[98px] rounded-card" />)
        )}
      </div>

      <Card className="flex flex-col gap-3">
        <CardTitle
          right={<FilterSelect label="Holat" aria-label="So'rov holati" value={status} onChange={setStatus} options={STATUS_OPTIONS} />}
        >
          Menejerga so'rovlarim
        </CardTitle>
        {error && items && <StaleNotice onRetry={reload} />}
        {error && !items ? (
          <ErrorState onRetry={reload} />
        ) : !items ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : (
          <DataTable
            bare
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            pageSize={8}
            emptyIcon={<Inbox />}
            emptyTitle="So'rov yo'q"
            emptyDescription={`Yo'lovchi, haydovchi yoki buyurtma sahifasidan "Menejerga so'rov" yuboring.`}
          />
        )}
        {rejected.map((r) => (
          <div key={r.id} className="flex gap-2.5 rounded-box bg-error-soft px-4 py-3 text-13 leading-5 text-ink">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden />
            <span>
              <b className="font-extrabold">{r.code} rad etildi:</b> "{r.decision!.reason}" {r.decision!.byName}, {formatDateTime(r.decision!.at)}.
            </span>
          </div>
        ))}
      </Card>

      <h2 className="pt-1 text-base font-extrabold text-ink">Hal qilingan murojaatlar</h2>
      <MyTasks />
    </>
  );
}
