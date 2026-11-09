import { useEffect, useState } from "react";
import { Phone, PhoneMissed, PhoneOff, X } from "lucide-react";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";
import { ListToolbar } from "@/components/ListToolbar";
import { FilterSelect } from "@/components/FilterSelect";
import { useAdapterList } from "@/hooks/useAdapterList";
import { api } from "@/api/client";
import type { ActiveTask, HistoryResult, OperatorQueueQuery, QueueReason } from "@/api/types";

const REASON_LABEL: Record<QueueReason, string> = {
  login_issue: "Kirishda muammo",
  info_needed: "Ma'lumot kerak",
  complaint: "Shikoyat",
};
const REASON_OPTIONS: { value: QueueReason | "all"; label: string }[] = [
  { value: "all", label: "Barcha sabablar" },
  { value: "login_issue", label: REASON_LABEL.login_issue },
  { value: "info_needed", label: REASON_LABEL.info_needed },
  { value: "complaint", label: REASON_LABEL.complaint },
];

function waitingFor(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (mins < 1) return "hozir";
  return `${mins} daqiqa`;
}

export function QueueTab({ canWork, onChanged }: { canWork: boolean; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState<QueueReason | "all">("all");
  const query: OperatorQueueQuery = { search, reason };
  const { items: queue, error, reload } = useAdapterList(api.getQueue, query);

  const [active, setActive] = useState<ActiveTask | null>(null);
  const [activeLoaded, setActiveLoaded] = useState(!canWork);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [note, setNote] = useState("");
  const [pendingResult, setPendingResult] = useState<HistoryResult | null>(null);
  const [finishing, setFinishing] = useState<HistoryResult | null>(null);
  const [activeRejectReason, setActiveRejectReason] = useState("");

  useEffect(() => {
    if (!canWork) return;
    api.getActiveTask().then((t) => {
      setActive(t);
      setActiveLoaded(true);
    });
  }, [canWork]);

  async function start(id: string) {
    setBusyId(id);
    try {
      const task = await api.startTask(id);
      setActive(task);
      setNote("");
      reload();
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function rejectFromQueue(id: string) {
    if (!rejectReason.trim()) return;
    setBusyId(id);
    try {
      await api.rejectQueueItem(id, rejectReason.trim());
      setRejectingId(null);
      setRejectReason("");
      reload();
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function finish(result: HistoryResult) {
    if (!active) return;
    if (result === "rejected" && !activeRejectReason.trim()) {
      setFinishing("rejected");
      return;
    }
    setBusyId(active.id);
    setPendingResult(result);
    try {
      await api.finishTask(active.id, result, note.trim(), result === "rejected" ? activeRejectReason.trim() : undefined);
      setActive(null);
      setNote("");
      setActiveRejectReason("");
      setFinishing(null);
      reload();
      onChanged();
    } finally {
      setBusyId(null);
      setPendingResult(null);
    }
  }

  if (error) return <ErrorState onRetry={reload} />;
  if (!queue || !activeLoaded) {
    return (
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const hasActiveFilters = reason !== "all";

  return (
    <div className="space-y-6">
      {active && (
        <Card className="space-y-4 border-2 border-accent">
          <div className="flex items-center justify-between">
            <Badge tone="accent">Faol vazifa</Badge>
            <span className="tabular text-sm font-semibold text-ink">{active.phoneFull}</span>
          </div>
          <p className="text-sm text-ink/70">Sabab: {REASON_LABEL[active.reason]}</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Izoh..."
            rows={2}
            className="w-full rounded-xl border border-border bg-card p-3 text-sm text-ink outline-none transition-colors focus:border-accent"
          />
          {finishing === "rejected" && (
            <input
              value={activeRejectReason}
              onChange={(e) => setActiveRejectReason(e.target.value)}
              placeholder="Rad etish sababi (shart)..."
              className="h-10 w-full rounded-xl border border-danger bg-card px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
              autoFocus
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!!busyId} loading={pendingResult === "resolved"} onClick={() => finish("resolved")}>
              Hal qilindi
            </Button>
            <Button size="sm" variant="secondary" disabled={!!busyId} loading={pendingResult === "callback"} onClick={() => finish("callback")}>
              Qayta qo'ng'iroq
            </Button>
            <Button size="sm" variant="danger" disabled={!!busyId} loading={pendingResult === "rejected"} onClick={() => finish("rejected")}>
              Rad etish
            </Button>
          </div>
        </Card>
      )}

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Telefon bo'yicha qidirish..."
        resultCount={queue.length}
        hasActiveFilters={hasActiveFilters}
        onClear={() => setReason("all")}
      >
        <FilterSelect value={reason} onChange={setReason} options={REASON_OPTIONS} aria-label="Sabab bo'yicha filtr" />
      </ListToolbar>

      {queue.length === 0 ? (
        <EmptyState
          icon={<Phone className="h-6 w-6" />}
          title="Hech narsa topilmadi"
          description="Navbat bo'sh yoki filtrlarga mos mijoz yo'q."
          actionLabel={hasActiveFilters ? "Filtrlarni tozalash" : undefined}
          onAction={hasActiveFilters ? () => setReason("all") : undefined}
        />
      ) : (
        <div className="space-y-3">
          {queue.map((q) => (
            <Card key={q.id} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-10 text-accent">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink tabular">{q.phoneMasked}</p>
                  <p className="text-xs text-ink/50">
                    {REASON_LABEL[q.reason]} · {waitingFor(q.waitingSinceAt)} kutmoqda
                  </p>
                </div>
              </div>
              {!canWork ? null : rejectingId === q.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Sabab..."
                    className="h-9 w-48 rounded-xl border border-border bg-card px-3 text-xs text-ink outline-none transition-colors focus:border-accent"
                    autoFocus
                  />
                  <Button size="sm" variant="danger" loading={busyId === q.id} disabled={!rejectReason.trim()} onClick={() => rejectFromQueue(q.id)}>
                    Rad etish
                  </Button>
                  <button onClick={() => setRejectingId(null)} aria-label="Yopish" className="rounded-full p-1.5 text-ink/50 hover:bg-ink/5">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" disabled={!!active} loading={busyId === q.id} onClick={() => start(q.id)}>
                    <PhoneMissed className="h-3.5 w-3.5" /> Boshlash
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!!active} onClick={() => setRejectingId(q.id)}>
                    <PhoneOff className="h-3.5 w-3.5" /> Rad etish
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
