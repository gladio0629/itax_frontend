import { useEffect, useState } from "react";
import { History, Pencil } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Drawer } from "@/components/Drawer";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { ListToolbar } from "@/components/ListToolbar";
import { FilterSelect } from "@/components/FilterSelect";
import { Toast } from "@/components/Toast";
import { useAdapterList } from "@/hooks/useAdapterList";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateTime } from "@/lib/format";
import type { HistoryEntry, HistoryResult, OperatorApprovedQuery, QueueReason } from "@/api/types";

const caps = api.capabilities;

const REASON_LABEL: Record<QueueReason, string> = {
  login_issue: "Kirishda muammo",
  info_needed: "Ma'lumot kerak",
  complaint: "Shikoyat",
  driver_application: "Haydovchi arizasi",
  document_update: "Hujjat yangilanishi",
};
const RESULT_LABEL: Record<HistoryResult, string> = {
  resolved: "Hal qilindi",
  callback: "Qayta qo'ng'iroq",
  rejected: "Rad etildi",
};
const RESULT_TONE: Record<HistoryResult, BadgeTone> = {
  resolved: "success",
  callback: "pending",
  rejected: "danger",
};
const RESULT_OPTIONS: { value: HistoryResult | "all"; label: string }[] = [
  { value: "all", label: "Barcha natijalar" },
  { value: "resolved", label: RESULT_LABEL.resolved },
  { value: "callback", label: RESULT_LABEL.callback },
  { value: "rejected", label: RESULT_LABEL.rejected },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HistoryTab({ canSupervise, onChanged }: { canSupervise: boolean; onChanged: () => void }) {
  const { me } = usePermissions();
  const canWork = !!me?.actions.includes("operatorWork");

  // A supervisor's "Bugungi tasdiqlanganlar" defaults to today + Hal
  // qilindi; an operator's own "Tarix" starts unfiltered.
  const [search, setSearch] = useState("");
  // Without server-side filters (real API) the lists start unfiltered.
  const supervisorDefaults = canSupervise && caps.historyFilters;
  const [result, setResult] = useState<HistoryResult | "all">(supervisorDefaults ? "resolved" : "all");
  const [dateFrom, setDateFrom] = useState(supervisorDefaults ? todayStr() : "");
  const [dateTo, setDateTo] = useState(supervisorDefaults ? todayStr() : "");
  const [operatorId, setOperatorId] = useState<string>("all");
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (canSupervise) api.getOperatorsList().then(setOperators).catch(() => {});
  }, [canSupervise]);

  const query: OperatorApprovedQuery = { search, result, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, operatorId: canSupervise ? operatorId : undefined };
  const { items, error, reload } = useAdapterList(api.getHistory, query);

  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const [editResult, setEditResult] = useState<HistoryResult>("resolved");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function openEdit(e: HistoryEntry) {
    setEditing(e);
    setEditResult(e.result);
    setEditNote(e.note);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.editHistoryEntry(editing.id, { result: editResult, note: editNote });
      setEditing(null);
      setToast("Saqlandi");
      reload();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setResult(canSupervise ? "resolved" : "all");
    setDateFrom(canSupervise ? todayStr() : "");
    setDateTo(canSupervise ? todayStr() : "");
    setOperatorId("all");
  }

  const hasActiveFilters = canSupervise
    ? result !== "resolved" || dateFrom !== todayStr() || dateTo !== todayStr() || operatorId !== "all"
    : result !== "all" || !!dateFrom || !!dateTo;

  const columns: Column<HistoryEntry>[] = [
    { key: "date", header: "Sana", sortValue: (e) => e.resolvedAt, render: (e) => <span className="text-ink/60">{formatDateTime(e.resolvedAt)}</span> },
    { key: "phone", header: "Telefon", render: (e) => <span className="tabular">{e.phoneMasked}</span> },
    ...(canSupervise ? [{ key: "operator", header: "Operator", render: (e: HistoryEntry) => <span>{e.operatorName}</span> } as Column<HistoryEntry>] : []),
    { key: "reason", header: "Sabab", render: (e) => REASON_LABEL[e.reason] },
    { key: "result", header: "Natija", render: (e) => <Badge tone={RESULT_TONE[e.result]}>{RESULT_LABEL[e.result]}</Badge> },
    { key: "note", header: "Izoh", render: (e) => <span className="block max-w-[220px] truncate text-ink/70" title={e.note}>
          {e.note}
        </span> },
    {
      key: "actions",
      header: "",
      width: "90px",
      render: (e) => (
        <div className="flex items-center justify-end gap-2" onClick={(ev) => ev.stopPropagation()}>
          {e.edited && <Badge tone="neutral">tahrirlandi</Badge>}
          {caps.historyEdit && canWork && e.operatorId === me?.id && (
            <button type="button" aria-label="Tahrirlash" onClick={() => openEdit(e)} className="rounded-full p-2 text-ink/50 hover:bg-ink/5 hover:text-ink">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (error) return <ErrorState onRetry={reload} />;
  if (!items) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Telefon, izoh yoki operator…"
        searchEnabled={caps.historyFilters}
        resultCount={items.length}
        hasActiveFilters={caps.historyFilters && hasActiveFilters}
        onClear={clearFilters}
      >
        {caps.historyFilters && (
          <>
        <FilterSelect value={result} onChange={setResult} options={RESULT_OPTIONS} aria-label="Natija bo'yicha filtr" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Boshlanish sanasi"
          className="h-10 rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Tugash sanasi"
          className="h-10 rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
        {canSupervise && operators.length > 1 && (
          <FilterSelect
            value={operatorId}
            onChange={setOperatorId}
            options={[{ value: "all", label: "Barcha operatorlar" }, ...operators.map((o) => ({ value: o.id, label: o.name }))]}
            aria-label="Operator bo'yicha filtr"
          />
        )}
          </>
        )}
      </ListToolbar>

      <DataTable
        key={`${search}-${result}-${dateFrom}-${dateTo}-${operatorId}`}
        columns={columns}
        rows={items}
        rowKey={(e) => e.id}
        pageSize={15}
        emptyIcon={<History className="h-6 w-6" />}
        emptyTitle="Hech narsa topilmadi"
        emptyDescription="Tanlangan filtrlarga mos yozuv yo'q."
      />

      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Yozuvni tahrirlash">
        {editing && (
          <div className="space-y-4">
            <div>
              <label htmlFor="fld-natija" className="mb-2 block text-sm font-semibold text-ink/80">Natija</label>
              <select id="fld-natija"
                value={editResult}
                onChange={(e) => setEditResult(e.target.value as HistoryResult)}
                className="h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              >
                {(Object.keys(RESULT_LABEL) as HistoryResult[]).map((r) => (
                  <option key={r} value={r}>
                    {RESULT_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fld-izoh" className="mb-2 block text-sm font-semibold text-ink/80">Izoh</label>
              <textarea id="fld-izoh"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
                className="w-full rounded-button border border-border bg-card p-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>
            <Button fullWidth loading={saving} onClick={handleSaveEdit}>
              Saqlash
            </Button>
          </div>
        )}
      </Drawer>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
