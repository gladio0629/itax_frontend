import { useEffect, useState } from "react";
import { Check, LifeBuoy, X } from "lucide-react";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";
import { api } from "@/api/client";
import { formatDateTime } from "@/lib/format";
import type { Complaint, ComplaintType } from "@/api/types";

const TYPE_LABEL: Partial<Record<ComplaintType, string>> = {
  service_quality: "Xizmat sifati",
  payment_dispute: "To'lov bo'yicha nizo",
};
const STATUS_TONE: Record<Complaint["status"], "neutral" | "warning" | "accent"> = {
  open: "warning",
  reviewing: "warning",
  resolved: "accent",
  dismissed: "neutral",
};
const STATUS_LABEL: Record<Complaint["status"], string> = {
  open: "Ochiq",
  reviewing: "Ko'rib chiqilmoqda",
  resolved: "Hal qilindi",
  dismissed: "Rad etildi",
};

export function SupportScreen() {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(false);
    try {
      setItems(await api.getSupportTickets());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function act(id: string, status: "resolved" | "dismissed") {
    setBusyId(id);
    try {
      const updated = await api.resolveComplaint(id, status);
      setItems((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorState onRetry={load} />;
  if (!items) {
    return (
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<LifeBuoy className="h-6 w-6" />}
        title="Murojaatlar yo'q"
        description="Hozircha qo'llab-quvvatlash murojaatlari mavjud emas."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      {items.map((c) => (
        <Card key={c.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge tone="info">{TYPE_LABEL[c.type] ?? c.type}</Badge>
            <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
          </div>
          <p className="text-sm text-ink">{c.description}</p>
          <p className="text-xs text-ink/50">{formatDateTime(c.createdAt)}</p>
          {(c.status === "open" || c.status === "reviewing") && (
            <div className="flex gap-2">
              <Button size="sm" loading={busyId === c.id} onClick={() => act(c.id, "resolved")}>
                <Check className="h-3.5 w-3.5" /> Hal qilish
              </Button>
              <Button size="sm" variant="secondary" onClick={() => act(c.id, "dismissed")}>
                <X className="h-3.5 w-3.5" /> Rad etish
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
