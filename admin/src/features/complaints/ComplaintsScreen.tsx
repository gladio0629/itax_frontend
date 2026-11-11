import { useState } from "react";
import { Check, MessageSquareWarning, UserPlus, X } from "lucide-react";
import { Card } from "@/components/Card";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";
import { ExportButton } from "@/components/ExportButton";
import { ListToolbar } from "@/components/ListToolbar";
import { FilterSelect } from "@/components/FilterSelect";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useAdapterList } from "@/hooks/useAdapterList";
import { formatDateTime } from "@/lib/format";
import type { Complaint, ComplaintCategoryFilter, ComplaintQuery, ComplaintStatus, ComplaintType } from "@/api/types";

const TYPE_LABEL: Record<ComplaintType, string> = {
  service_quality: "Xizmat sifati",
  payment_dispute: "To'lov bo'yicha nizo",
  suspicious_gps: "Shubhali GPS",
  repeated_pair: "Takroriy juftlik",
  otp_abuse: "OTP suiste'mol",
  referral_abuse: "Referal suiste'mol",
};
const FRAUD_TYPES: ComplaintType[] = ["suspicious_gps", "repeated_pair", "otp_abuse", "referral_abuse"];
const STATUS_TONE: Record<ComplaintStatus, BadgeTone> = {
  open: "pending",
  reviewing: "accent",
  resolved: "success",
  dismissed: "neutral",
};
const STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: "Ochiq",
  reviewing: "Ko'rib chiqilmoqda",
  resolved: "Hal qilindi",
  dismissed: "Rad etildi",
};
const STATUS_OPTIONS: { value: ComplaintStatus | "all"; label: string }[] = [
  { value: "all", label: "Barcha holatlar" },
  ...(Object.keys(STATUS_LABEL) as ComplaintStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];
const CATEGORY_OPTIONS: { value: ComplaintCategoryFilter; label: string }[] = [
  { value: "all", label: "Barcha turlar" },
  { value: "fraud", label: "Firibgarlik/xavf" },
  { value: "service", label: "Xizmat/to'lov" },
];

export function ComplaintsScreen() {
  const { me } = usePermissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ComplaintStatus | "all">("all");
  const [category, setCategory] = useState<ComplaintCategoryFilter>("all");
  const query: ComplaintQuery = { search, status, category };
  const { items, error, reload } = useAdapterList(api.getComplaints, query);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function assignToMe(id: string) {
    if (!me) return;
    setBusyId(id);
    try {
      await api.assignComplaint(id, me.id);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function close(id: string, status: "resolved" | "dismissed") {
    setBusyId(id);
    try {
      await api.setComplaintStatus(id, status);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function addNote(id: string) {
    const text = noteDrafts[id]?.trim();
    if (!text) return;
    setBusyId(id);
    try {
      await api.addComplaintNote(id, text);
      setNoteDrafts((d) => ({ ...d, [id]: "" }));
      reload();
    } finally {
      setBusyId(null);
    }
  }

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

  const hasActiveFilters = status !== "all" || category !== "all";
  function clearFilters() {
    setStatus("all");
    setCategory("all");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tavsif bo'yicha qidirish…"
          resultCount={items.length}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        >
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Holat bo'yicha filtr" />
          <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} aria-label="Turi bo'yicha filtr" />
        </ListToolbar>
        <ExportButton
          section="complaints"
          rows={items}
          filenamePrefix="shikoyatlar"
          buildRow={(c) => ({ Turi: TYPE_LABEL[c.type], Holat: c.status, Tasvir: c.description })}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<MessageSquareWarning className="h-6 w-6" />}
          title="Hech narsa topilmadi"
          description="Qidiruv yoki filtrlarga mos shikoyat yo'q."
          actionLabel={hasActiveFilters ? "Filtrlarni tozalash" : undefined}
          onAction={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {items.map((c: Complaint) => (
            <Card key={c.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge tone={FRAUD_TYPES.includes(c.type) ? "danger" : "info"} dot={false}>{TYPE_LABEL[c.type]}</Badge>
                <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
              </div>
              <p className="text-sm text-ink">{c.description}</p>
              <p className="text-xs text-ink/50">{formatDateTime(c.createdAt)}</p>
              {c.assignedToName && <p className="text-xs text-ink/60">Biriktirilgan: {c.assignedToName}</p>}

              {c.notes.length > 0 && (
                <div className="space-y-2 rounded-button bg-ink/5 p-3">
                  {c.notes.map((n) => (
                    <p key={n.id} className="text-xs text-ink/70">
                      <span className="font-semibold text-ink">{n.authorName}:</span> {n.text}
                    </p>
                  ))}
                </div>
              )}

              {(c.status === "open" || c.status === "reviewing") && (
                <>
                  <div className="flex gap-2">
                    <input
                      value={noteDrafts[c.id] ?? ""}
                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      placeholder="Izoh qo'shish…"
                      className="h-8 flex-1 rounded-button border border-border bg-card px-3 text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                    <Button size="sm" variant="secondary" disabled={!noteDrafts[c.id]?.trim()} loading={busyId === c.id} onClick={() => addNote(c.id)}>
                      Qo'shish
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!c.assignedToId && (
                      <Button size="sm" variant="secondary" loading={busyId === c.id} onClick={() => assignToMe(c.id)}>
                        <UserPlus className="h-4 w-4" /> O'zimga biriktirish
                      </Button>
                    )}
                    <Button size="sm" loading={busyId === c.id} onClick={() => close(c.id, "resolved")}>
                      <Check className="h-4 w-4" /> Hal qilish
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => close(c.id, "dismissed")}>
                      <X className="h-4 w-4" /> Rad etish
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
