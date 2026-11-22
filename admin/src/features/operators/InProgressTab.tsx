import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";
import { ListToolbar } from "@/components/ListToolbar";
import { useAdapterList } from "@/hooks/useAdapterList";
import { api } from "@/api/client";
import type { OperatorInProgressQuery, QueueReason } from "@/api/types";

const REASON_LABEL: Record<QueueReason, string> = {
  login_issue: "Kirishda muammo",
  info_needed: "Ma'lumot kerak",
  complaint: "Shikoyat",
  driver_application: "Haydovchi arizasi",
  document_update: "Hujjat yangilanishi",
};

function elapsed(startedAt: number, tickMs: number): string {
  const secs = Math.max(0, Math.floor((tickMs - startedAt) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Supervisor-only (superadmin/owner/menejer): every call currently being
 * handled, with a timer counting from the server's own startedAt — not
 * reset by a client refresh. */
export function InProgressTab() {
  const [search, setSearch] = useState("");
  const query: OperatorInProgressQuery = { search };
  const { items, error, reload } = useAdapterList(api.getOperatorsInProgress, query);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(reload, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <ErrorState onRetry={reload} />;
  if (!items) {
    return (
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Operator yoki telefon…" resultCount={items.length} hasActiveFilters={false} onClear={() => {}} />

      {items.length === 0 ? (
        <EmptyState icon={<Loader2 className="h-6 w-6" />} title="Hozircha hech kim band emas" description="Hech bir operator vazifa bilan shug'ullanmayapti." />
      ) : (
        <div className="space-y-3">
          {items.map((q) => (
            <Card key={q.id} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 text-warning">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{q.assignedOperatorName ?? "—"}</p>
                  <p className="text-xs text-ink/50 tabular">
                    {q.phone ?? q.subjectLabel} · {REASON_LABEL[q.reason]}
                  </p>
                </div>
              </div>
              <span className="tabular text-sm font-semibold text-warning">{q.startedAt ? elapsed(q.startedAt, now) : "—"}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
