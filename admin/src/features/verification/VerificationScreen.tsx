import { useEffect, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { DocumentViewer } from "@/components/DocumentViewer";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";
import { api } from "@/api/client";
import { formatDate } from "@/lib/format";
import type { Driver } from "@/api/types";

export function VerificationScreen() {
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    setError(false);
    try {
      setDrivers(await api.getPendingDrivers());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.approveDriver(id);
      setDrivers((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!reason.trim()) return;
    setBusyId(id);
    try {
      await api.rejectDriver(id, reason.trim());
      setDrivers((prev) => prev?.filter((d) => d.id !== id) ?? null);
      setRejectingId(null);
      setReason("");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState onRetry={load} />;
  if (!drivers || drivers.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Navbat bo'sh"
        description="Tekshirishni kutayotgan haydovchilar yo'q."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      {drivers.map((d) => (
        <Card key={d.id} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar seed={d.avatarSeed} name={d.name} size={40} />
              <div>
                <p className="text-sm font-semibold text-ink">{d.name}</p>
                <p className="text-xs text-ink/50">
                  {d.carModel} · {d.plate}
                </p>
              </div>
            </div>
            <Badge tone="warning">Kutilmoqda</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DocumentViewer kind="license" name={d.name} plate={d.plate} />
            <DocumentViewer kind="tech_passport" name={d.name} plate={d.plate} />
          </div>
          <p className="text-xs text-ink/50">Ro'yxatdan o'tgan: {formatDate(d.joinedAt)}</p>

          {rejectingId === d.id ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Rad etish sababi..."
                rows={2}
                className="w-full rounded-2xl border border-border bg-card p-3 text-sm text-ink outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <Button variant="danger" size="sm" loading={busyId === d.id} disabled={!reason.trim()} onClick={() => handleReject(d.id)}>
                  Rad etish
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRejectingId(null);
                    setReason("");
                  }}
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" loading={busyId === d.id} onClick={() => handleApprove(d.id)}>
                <Check className="h-4 w-4" /> Tasdiqlash
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setRejectingId(d.id)}>
                <X className="h-4 w-4" /> Rad etish
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
