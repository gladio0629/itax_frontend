import { useEffect, useMemo, useState } from "react";
import { History, Pencil } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Drawer } from "@/components/Drawer";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { HistoryEntry, HistoryResult, QueueReason } from "@/api/types";

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

export function OperatorHistoryScreen() {
  const { me } = usePermissions();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [operatorFilter, setOperatorFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<HistoryResult | "all">("all");
  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const [editResult, setEditResult] = useState<HistoryResult>("resolved");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setError(false);
    try {
      setEntries(await api.getHistory());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const operators = useMemo(() => {
    if (!entries) return [];
    const map = new Map<string, string>();
    entries.forEach((e) => map.set(e.operatorId, e.operatorName));
    return Array.from(map.entries());
  }, [entries]);

  function openEdit(e: HistoryEntry) {
    setEditing(e);
    setEditResult(e.result);
    setEditNote(e.note);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await api.editHistoryEntry(editing.id, { result: editResult, note: editNote });
      setEntries((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
      setEditing(null);
      setToast("Saqlandi");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<HistoryEntry>[] = [
    { key: "date", header: "Sana", sortValue: (e) => e.resolvedAt, render: (e) => <span className="text-xs text-ink/60">{formatDateTime(e.resolvedAt)}</span> },
    { key: "phone", header: "Telefon", render: (e) => <span className="tabular">{e.phoneMasked}</span> },
    ...(me?.role !== "operator" ? [{ key: "operator", header: "Operator", render: (e: HistoryEntry) => <span>{e.operatorName}</span> } as Column<HistoryEntry>] : []),
    { key: "reason", header: "Sabab", render: (e) => REASON_LABEL[e.reason] },
    { key: "result", header: "Natija", render: (e) => <Badge tone={RESULT_TONE[e.result]}>{RESULT_LABEL[e.result]}</Badge> },
    { key: "note", header: "Izoh", render: (e) => <span className="block max-w-[220px] truncate text-ink/70">{e.note}</span> },
    {
      key: "edited",
      header: "",
      width: "90px",
      render: (e) => (
        <div className="flex items-center justify-end gap-2" onClick={(ev) => ev.stopPropagation()}>
          {e.edited && <Badge tone="neutral">tahrirlandi</Badge>}
          <button aria-label="Tahrirlash" onClick={() => openEdit(e)} className="rounded-full p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  if (error) return <ErrorState onRetry={load} />;
  if (!entries) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const rows = entries.filter((e) => {
    if (operatorFilter !== "all" && e.operatorId !== operatorFilter) return false;
    if (resultFilter !== "all" && e.result !== resultFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {me?.role !== "operator" && operators.length > 1 && (
          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className="h-9 rounded-xl border border-border bg-card px-3 text-xs text-ink outline-none focus:border-accent"
          >
            <option value="all">Barcha operatorlar</option>
            {operators.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        {(["all", "resolved", "callback", "rejected"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setResultFilter(r)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", resultFilter === r ? "bg-ink text-bg" : "bg-ink/5 text-ink/70")}
          >
            {r === "all" ? "Barchasi" : RESULT_LABEL[r]}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        searchFields={(e) => `${e.phoneMasked} ${e.note} ${e.operatorName}`}
        searchPlaceholder="Telefon, izoh yoki operator..."
        pageSize={15}
        emptyIcon={<History className="h-6 w-6" />}
        emptyTitle="Tarix bo'sh"
      />

      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Yozuvni tahrirlash">
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink/80">Natija</label>
              <select
                value={editResult}
                onChange={(e) => setEditResult(e.target.value as HistoryResult)}
                className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-ink outline-none focus:border-accent"
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
                className="w-full rounded-xl border border-border bg-card p-3 text-sm text-ink outline-none focus:border-accent"
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
