import { useEffect, useState } from "react";
import { Check, MessageSquareWarning, UserPlus, X } from "lucide-react";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";
import { ExportButton } from "@/components/ExportButton";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Complaint, ComplaintStatus, ComplaintType } from "@/api/types";

const TYPE_LABEL: Record<ComplaintType, string> = {
  service_quality: "Xizmat sifati",
  payment_dispute: "To'lov bo'yicha nizo",
  suspicious_gps: "Shubhali GPS",
  repeated_pair: "Takroriy juftlik",
  otp_abuse: "OTP suiste'mol",
  referral_abuse: "Referal suiste'mol",
};
const FRAUD_TYPES: ComplaintType[] = ["suspicious_gps", "repeated_pair", "otp_abuse", "referral_abuse"];
const STATUS_TONE: Record<ComplaintStatus, "neutral" | "warning" | "accent" | "danger"> = {
  open: "warning",
  reviewing: "warning",
  resolved: "accent",
  dismissed: "neutral",
};
const STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: "Ochiq",
  reviewing: "Ko'rib chiqilmoqda",
  resolved: "Hal qilindi",
  dismissed: "Rad etildi",
};

type Filter = "all" | "open" | "fraud";

export function ComplaintsScreen() {
  const { me } = usePermissions();
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function load() {
    setError(false);
    try {
      setItems(await api.getComplaints());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function assignToMe(id: string) {
    if (!me) return;
    setBusyId(id);
    try {
      const updated = await api.assignComplaint(id, me.id);
      setItems((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  async function close(id: string, status: "resolved" | "dismissed") {
    setBusyId(id);
    try {
      const updated = await api.setComplaintStatus(id, status);
      setItems((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  async function addNote(id: string) {
    const text = noteDrafts[id]?.trim();
    if (!text) return;
    setBusyId(id);
    try {
      const updated = await api.addComplaintNote(id, text);
      setItems((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? null);
      setNoteDrafts((d) => ({ ...d, [id]: "" }));
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

  const filtered = items.filter((c) => {
    if (filter === "open") return c.status === "open" || c.status === "reviewing";
    if (filter === "fraud") return FRAUD_TYPES.includes(c.type);
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["all", "open", "fraud"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", filter === f ? "bg-ink text-bg" : "bg-ink/5 text-ink/70")}
            >
              {f === "all" ? "Barchasi" : f === "open" ? "Ochiq" : "Firibgarlik/xavf"}
            </button>
          ))}
        </div>
        <ExportButton
          section="complaints"
          rows={filtered}
          filenamePrefix="shikoyatlar"
          buildRow={(c) => ({ Turi: TYPE_LABEL[c.type], Holat: c.status, Tasvir: c.description })}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<MessageSquareWarning className="h-6 w-6" />} title="Shikoyatlar yo'q" description="Tanlangan filtrga mos shikoyat topilmadi." />
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {filtered.map((c) => (
            <Card key={c.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge tone={FRAUD_TYPES.includes(c.type) ? "danger" : "info"}>{TYPE_LABEL[c.type]}</Badge>
                <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
              </div>
              <p className="text-sm text-ink">{c.description}</p>
              <p className="text-xs text-ink/50">{formatDateTime(c.createdAt)}</p>
              {c.assignedToName && <p className="text-xs text-ink/60">Biriktirilgan: {c.assignedToName}</p>}

              {c.notes.length > 0 && (
                <div className="space-y-1.5 rounded-xl bg-ink/5 p-3">
                  {c.notes.map((n) => (
                    <p key={n.id} className="text-xs text-ink/70">
                      <span className="font-semibold text-ink">{n.authorName}:</span> {n.text}
                    </p>
                  ))}
                </div>
              )}

              {(c.status === "open" || c.status === "reviewing") && (
                <>
                  <div className="flex gap-1.5">
                    <input
                      value={noteDrafts[c.id] ?? ""}
                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      placeholder="Izoh qo'shish..."
                      className="h-9 flex-1 rounded-xl border border-border bg-card px-3 text-xs text-ink outline-none focus:border-accent"
                    />
                    <Button size="sm" variant="secondary" disabled={!noteDrafts[c.id]?.trim()} loading={busyId === c.id} onClick={() => addNote(c.id)}>
                      Qo'shish
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!c.assignedToId && (
                      <Button size="sm" variant="secondary" loading={busyId === c.id} onClick={() => assignToMe(c.id)}>
                        <UserPlus className="h-3.5 w-3.5" /> O'zimga biriktirish
                      </Button>
                    )}
                    <Button size="sm" loading={busyId === c.id} onClick={() => close(c.id, "resolved")}>
                      <Check className="h-3.5 w-3.5" /> Hal qilish
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => close(c.id, "dismissed")}>
                      <X className="h-3.5 w-3.5" /> Rad etish
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
