import { useEffect, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
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
  suspicious_gps: "Shubhali GPS",
  repeated_pair: "Takroriy juftlik",
  otp_abuse: "OTP suiste'mol",
  referral_abuse: "Referal suiste'mol",
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

export function RiskScreen() {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(false);
    try {
      setItems(await api.getRiskItems());
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
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Xavfli holatlar yo'q"
        description="Hozircha firibgarlik yoki xavf belgilari aniqlanmagan."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      {items.map((c) => (
        <Card key={c.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge tone="danger">{TYPE_LABEL[c.type] ?? c.type}</Badge>
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
