import { useState } from "react";
import { History, Pencil, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { useAdapterList } from "@/hooks/useAdapterList";
import { Tabs } from "@/components/Tabs";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { IconButton } from "@/components/Button";
import { FormDrawer } from "@/components/FormDrawer";
import { SearchInput, SelectField, TextArea } from "@/components/Input";
import { FilterSelect } from "@/components/FilterSelect";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { formatDateTime } from "@/lib/format";
import { OrdersScreen } from "@/features/orders/OrdersScreen";
import { REASON, REASON_CHIPS, RESULT, Tag } from "./labels";
import type { HistoryEntry, HistoryResult, ListPeriod, QueueReason } from "@/api/types";

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
type TabKey = "tasks" | "orders";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PERIODS: { value: Exclude<ListPeriod, "90d">; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "today", label: "Bugun" },
  { value: "yesterday", label: "Kecha" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
];
function range(p: Exclude<ListPeriod, "90d">): { dateFrom?: string; dateTo?: string } {
  if (p === "all") return {};
  const day = (back: number) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return iso(d);
  };
  if (p === "today") return { dateFrom: day(0), dateTo: day(0) };
  if (p === "yesterday") return { dateFrom: day(1), dateTo: day(1) };
  return { dateFrom: day(p === "7d" ? 6 : 29), dateTo: day(0) };
}

/** Operator's "Tarix" (design OperatorHistory): own task history (result
 * and comment editable) and the read-only orders window (doc 2.5). */
export function OperatorHistory() {
  const { me } = usePermissions();
  const [params, setParams] = useSearchParams();
  const canOrders = !!me?.sections.includes("orders_view");
  const tab: TabKey = params.get("tab") === "orders" && canOrders ? "orders" : "tasks";
  const setTab = (t: TabKey) => setParams(t === "tasks" ? {} : { tab: t }, { replace: true });

  return (
    <>
      <PageHeader subtitle="Natijalarim va buyurtmalar" title="Tarix" />
      {canOrders && (
        <Tabs
          label="Tarix bo'limlari"
          value={tab}
          onChange={setTab}
          items={[
            { key: "tasks", label: "Mening vazifalarim" },
            { key: "orders", label: "Buyurtmalar" },
          ]}
        />
      )}
      {tab === "orders" ? <OrdersScreen readOnly /> : <MyTasks />}
    </>
  );
}

function MyTasks() {
  const { me } = usePermissions();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<HistoryResult | "all">("all");
  const [reason, setReason] = useState<QueueReason | "all">("all");
  const [period, setPeriod] = useState<Exclude<ListPeriod, "90d">>("all");
  const query = caps.historyFilters ? { search, result, reason, ...range(period) } : {};
  const { items, error, reload } = useAdapterList(api.getHistory, query);

  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const [editResult, setEditResult] = useState<HistoryResult>("resolved");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canEdit = (e: HistoryEntry) => caps.historyEdit && !!me?.actions.includes("operatorWork") && e.operatorId === me?.id;

  function openEdit(e: HistoryEntry) {
    setEditing(e);
    setEditResult(e.result);
    setEditNote(e.note);
    setSaveError(null);
  }
  async function save() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.editHistoryEntry(editing.id, { result: editResult, note: editNote.trim() });
      setEditing(null);
      setToast("Saqlandi");
      reload();
    } catch (e) {
      setSaveError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  // "Rad etildi" is set by the reject flow (with its reason), not by editing.
  const editOptions = caps.operatorResults
    .filter((r) => r !== "rejected" || editing?.result === "rejected")
    .map((r) => ({ value: r, label: RESULT[r].label }));
  if (editing && !editOptions.some((o) => o.value === editing.result)) editOptions.push({ value: editing.result, label: RESULT[editing.result].label });

  const columns: Column<HistoryEntry>[] = [
    { key: "date", header: "Sana", sortValue: (e) => e.resolvedAt, render: (e) => <span className="tabular text-muted">{formatDateTime(e.resolvedAt)}</span> },
    { key: "phone", header: "Telefon", render: (e) => <span className="tabular font-bold">{e.phone ?? e.subjectLabel}</span> },
    { key: "reason", header: "Sabab", render: (e) => <Tag className={REASON[e.reason].tag}>{REASON[e.reason].label}</Tag> },
    {
      key: "result",
      header: "Natija",
      render: (e) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={RESULT[e.result].tone}>{RESULT[e.result].label}</Badge>
          {e.edited && <span className="text-xs font-semibold text-muted">tahrirlandi</span>}
        </span>
      ),
    },
    { key: "note", header: "Izoh", truncate: { maxWidth: 260, title: (e) => e.note }, render: (e) => <span className="text-muted">{e.note || "—"}</span> },
    {
      key: "actions",
      header: "",
      width: "56px",
      render: (e) =>
        canEdit(e) && (
          <IconButton size={36} label="Natija va izohni tahrirlash" onClick={() => openEdit(e)}>
            <Pencil className="h-4 w-4" aria-hidden />
          </IconButton>
        ),
    },
  ];

  return (
    <>
      {caps.historyFilters && (
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchInput
            className="w-[300px] max-w-full"
            label="Telefon yoki izoh"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" aria-hidden />}
          />
          <span className="flex-1" />
          <FilterSelect
            label="Sabab"
            aria-label="Sabab"
            value={reason}
            onChange={setReason}
            options={[{ value: "all", label: "Hammasi" }, ...REASON_CHIPS.map((r) => ({ value: r, label: REASON[r].label }))]}
          />
          <FilterSelect
            label="Natija"
            aria-label="Natija"
            value={result}
            onChange={setResult}
            options={[{ value: "all", label: "Hammasi" }, ...caps.operatorResults.map((r) => ({ value: r, label: RESULT[r].label }))]}
          />
          <FilterSelect label="Sana" aria-label="Sana" value={period} onChange={setPeriod} options={PERIODS} />
        </div>
      )}

      {error && items && <StaleNotice onRetry={reload} />}
      {error && !items ? (
        <ErrorState onRetry={reload} />
      ) : !items ? (
        <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(e) => e.id}
          emptyIcon={<History />}
          emptyTitle="Yozuv topilmadi"
          emptyDescription="Filtrlarni o'zgartirib ko'ring."
        />
      )}

      <FormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Natijani tahrirlash"
        onSubmit={save}
        submitLabel="Saqlash"
        loading={saving}
        error={saveError}
      >
        {editing && (
          <>
            <p className="tabular text-15 font-extrabold">{editing.phone ?? editing.subjectLabel}</p>
            <SelectField
              label="Natija"
              value={editResult}
              onChange={(e) => setEditResult(e.target.value as HistoryResult)}
              options={editOptions}
            />
            <TextArea label="Izoh" value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={4} maxLength={1000} />
          </>
        )}
      </FormDrawer>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
