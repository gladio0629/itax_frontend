import { useEffect, useState } from "react";
import { History, Pencil } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
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

const REASON_LABEL: Record<QueueReason, string> = {
  login_issue: "Kirishda muammo",
  info_needed: "Ma'lumot kerak",
  complaint: "Shikoyat",
};
const RESULT_LABEL: Record<HistoryResult, string> = {
  resolved: "Hal qilindi",
  callback: "Qayta qo'ng'iroq",
  rejected: "Rad etildi",
};
const RESULT_TONE: Record<HistoryResult, "accent" | "warning" | "danger"> = {
  resolved: "accent",
  callback: "warning",
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
  const [result, setResult] = useState<HistoryResult | "all">(canSupervise ? "resolved" : "all");
  const [dateFrom, setDateFrom] = useState(canSupervise ? todayStr() : "");
  const [dateTo, setDateTo] = useState(canSupervise ? todayStr() : "");
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
    { key: "date", header: "Sana", sortValue: (e) => e.resolvedAt, render: (e) => <span className="text-xs text-ink/60">{formatDateTime(e.resolvedAt)}</span> },
    { key: "phone", header: "Telefon", render: (e) => <span className="tabular">{e.phoneMasked}</span> },
    ...(canSupervise ? [{ key: "operator", header: "Operator", render: (e: HistoryEntry) => <span>{e.operatorName}</span> } as Column<HistoryEntry>] : []),
    { key: "reason", header: "Sabab", render: (e) => REASON_LABEL[e.reason] },
    { key: "result", header: "Natija", render: (e) => <Badge tone={RESULT_TONE[e.result]}>{RESULT_LABEL[e.result]}</Badge> },
    { key: "note", header: "Izoh", render: (e) => <span className="block max-w-[220px] truncate text-ink/70">{e.note}</span> },
    {
      key: "actions",
      header: "",
      width: "90px",
      render: (e) => (
        <div className="flex items-center justify-end gap-2" onClick={(ev) => ev.stopPropagation()}>
          {e.edited && <Badge tone="neutral">tahrirlandi</Badge>}
          {canWork && e.operatorId === me?.id && (
            <button aria-label="Tahrirlash" onClick={() => openEdit(e)} className="rounded-full p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink">
              <Pencil className="h-3.5 w-3.5" />
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
        searchPlaceholder="Telefon, izoh yoki operator..."
        resultCount={items.length}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      >
        <FilterSelect value={result} onChange={setResult} options={RESULT_OPTIONS} aria-label="Natija bo'yicha filtr" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Boshlanish sanasi"
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Tugash sanasi"
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
        />
        {canSupervise && operators.length > 1 && (
          <FilterSelect
            value={operatorId}
            onChange={setOperatorId}
            options={[{ value: "all", label: "Barcha operatorlar" }, ...operators.map((o) => ({ value: o.id, label: o.name }))]}
            aria-label="Operator bo'yicha filtr"
          />
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
              <label className="mb-2 block text-sm font-semibold text-ink/80">Natija</label>
              <select
                value={editResult}
                onChange={(e) => setEditResult(e.target.value as HistoryResult)}
                className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-ink outline-none transition-colors focus:border-accent"
              >
                {(Object.keys(RESULT_LABEL) as HistoryResult[]).map((r) => (
                  <option key={r} value={r}>
                    {RESULT_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink/80">Izoh</label>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-card p-3 text-sm text-ink outline-none transition-colors focus:border-accent"
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
