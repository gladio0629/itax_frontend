import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { SearchInput } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { useAdapterList } from "@/hooks/useAdapterList";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { dayPresetRange, type DayPreset } from "@/lib/periods";
import { REASON, REASON_CHIPS, RESULT, SUBJECT_LABEL, Tag, since } from "./labels";
import type { HistoryEntry, HistoryResult, OperatorCounts, QueueListItem, QueueReason } from "@/api/types";

const caps = api.capabilities;
type Period = DayPreset;
const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Bugun" },
  { value: "yesterday", label: "Kecha" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
  { value: "all", label: "Hammasi" },
];

/** "Operatorlar" for supervisors (design Operators): three read-only columns. */
export function OperatorsBoard() {
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState<QueueReason | "all">("all");
  const [operatorId, setOperatorId] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("today");
  // "Bugungi tasdiqlanganlar" starts as today + Hal qilindi (as before).
  const [result, setResult] = useState<HistoryResult | "all">(caps.historyFilters ? "resolved" : "all");
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [counts, setCounts] = useState<OperatorCounts | null>(null);

  const filtersOn = caps.queueFilters;
  const queue = useAdapterList(api.getQueue, filtersOn ? { search, reason } : {});
  const inProgress = useAdapterList(api.getOperatorsInProgress, filtersOn ? { search, reason, operatorId } : {});
  const historyQuery = caps.historyFilters ? { search, reason, operatorId, result, ...dayPresetRange(period) } : dayPresetRange("today");
  const history = useAdapterList(api.getHistory, historyQuery);

  useEffect(() => {
    api
      .getOperatorsList()
      .then(setOperators)
      .catch(() => setOperators([]));
  }, []);
  const countsKey = JSON.stringify(historyQuery);
  useEffect(() => {
    if (!caps.operatorCounts) return;
    let live = true;
    const t = setTimeout(
      () =>
        api
          .getOperatorCounts(historyQuery)
          .then((c) => live && setCounts(c))
          .catch(() => live && setCounts(null)),
      300
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey]);

  const doneTitle = period === "today" && (result === "resolved" || !caps.historyFilters) ? "Bugungi tasdiqlanganlar" : "Yakunlanganlar";

  return (
    <>
      <PageHeader subtitle="Qo'ng'iroq navbati va natijalar" title="Operatorlar" />

      <div className="flex flex-wrap items-center gap-2.5">
        {filtersOn && (
          <SearchInput
            className="w-[300px] max-w-full"
            label="Telefon yoki izoh"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" aria-hidden />}
          />
        )}
        {filtersOn && (
          <FilterChips
            label="Sabab bo'yicha"
            value={reason}
            onChange={setReason}
            items={[{ key: "all" as const, label: "Hammasi" }, ...REASON_CHIPS.map((r) => ({ key: r, label: REASON[r].label }))]}
          />
        )}
        <span className="flex-1" />
        {filtersOn && operators.length > 0 && (
          <FilterSelect
            label="Operator"
            aria-label="Operator"
            value={operatorId}
            onChange={setOperatorId}
            options={[{ value: "all", label: "Hammasi" }, ...operators.map((o) => ({ value: o.id, label: o.name }))]}
          />
        )}
        {caps.historyFilters && (
          <>
            <FilterSelect
              label="Natija"
              aria-label="Natija"
              value={result}
              onChange={setResult}
              options={[{ value: "all", label: "Hammasi" }, ...caps.operatorResults.map((r) => ({ value: r, label: RESULT[r].label }))]}
            />
            <FilterSelect label="Sana" aria-label="Sana" value={period} onChange={setPeriod} options={PERIODS} />
          </>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Column title="Navbat" dot="bg-warn-strong" count={counts?.queue} list={queue} render={(q: QueueListItem) => <QueueCard key={q.id} q={q} />} empty="Navbat bo'sh" />
        <Column
          title="Jarayonda"
          dot="bg-info"
          count={counts?.inProgress}
          list={inProgress}
          render={(q: QueueListItem) => <QueueCard key={q.id} q={q} inProgress />}
          empty="Hozir hech kim qo'ng'iroq qilmayapti"
        />
        <Column
          title={doneTitle}
          dot="bg-green"
          count={counts?.approvedToday}
          list={history}
          render={(h: HistoryEntry) => <DoneCard key={h.id} h={h} />}
          empty="Bu davrda yakunlangan vazifa yo'q"
        />
      </div>
    </>
  );
}

function Column<T>({
  title,
  dot,
  count,
  list,
  render,
  empty,
}: {
  title: string;
  dot: string;
  count: number | undefined;
  list: { items: T[] | null; error: boolean; reload: () => void };
  render: (row: T) => ReactNode;
  empty: string;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2.5 rounded-card bg-[var(--board-column)] p-3.5">
      <h2 className="flex items-center gap-2 px-1 pb-1 pt-0.5">
        <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", dot)} />
        <span className="text-15 font-extrabold">{title}</span>
        {count !== undefined && <span className="tabular flex h-[22px] items-center rounded-full bg-white px-2 text-xs font-extrabold">{count}</span>}
      </h2>
      {list.error && list.items && <StaleNotice onRetry={list.reload} />}
      {list.error && !list.items ? (
        <ErrorState onRetry={list.reload} />
      ) : !list.items ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[110px] rounded-field" />)
      ) : list.items.length === 0 ? (
        <p className="px-1 py-6 text-center text-13 font-semibold text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">{list.items.map((r) => <li key={(r as { id: string }).id}>{render(r)}</li>)}</ul>
      )}
    </section>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return <article className="flex flex-col gap-2.5 rounded-field bg-white p-3.5 shadow-[0_1px_2px_rgba(11,21,36,0.06)]">{children}</article>;
}

function QueueCard({ q, inProgress }: { q: QueueListItem; inProgress?: boolean }) {
  return (
    <CardShell>
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-15 font-extrabold tracking-[0.3px]">{q.phone ?? q.subjectLabel}</span>
        <span className="text-xs font-bold text-muted">{since(inProgress && q.startedAt ? q.startedAt : q.waitingSinceAt)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Tag className={REASON[q.reason].tag}>{REASON[q.reason].label}</Tag>
        {q.subjectKind && <Tag className="bg-surface text-ink">{SUBJECT_LABEL[q.subjectKind]}</Tag>}
      </div>
      {q.requestText && <p className="text-13 leading-[19px] text-muted">{q.requestText}</p>}
      {inProgress && q.assignedOperatorName && (
        <span className="flex items-center gap-2 text-13 font-bold">
          <Avatar name={q.assignedOperatorName} size={28} />
          {q.assignedOperatorName}
        </span>
      )}
    </CardShell>
  );
}

function DoneCard({ h }: { h: HistoryEntry }) {
  const r = RESULT[h.result];
  return (
    <CardShell>
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-15 font-extrabold tracking-[0.3px]">{h.phone ?? h.subjectLabel}</span>
        <span className="tabular text-xs font-bold text-muted">{formatTime(h.resolvedAt)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Tag className={REASON[h.reason].tag}>{REASON[h.reason].label}</Tag>
        {h.subjectKind && <Tag className="bg-surface text-ink">{SUBJECT_LABEL[h.subjectKind]}</Tag>}
      </div>
      {h.note && <p className="text-13 leading-[19px] text-muted">{h.note}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-13 font-bold">
          <Avatar name={h.operatorName} size={28} />
          <span className="truncate">{h.operatorName}</span>
        </span>
        <Badge tone={r.tone}>{r.label}</Badge>
      </div>
    </CardShell>
  );
}
