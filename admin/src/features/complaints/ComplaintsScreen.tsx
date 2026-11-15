import { useState } from "react";
import { Check, MessageSquareWarning, MessagesSquare, UserPlus, X } from "lucide-react";
import { Card } from "@/components/Card";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
import type {
  Complaint,
  ComplaintCategoryFilter,
  ComplaintQuery,
  ComplaintStatus,
  ComplaintSubjectType,
  ComplaintType,
} from "@/api/types";

const caps = api.capabilities;

const TYPE_LABEL: Record<ComplaintType, string> = {
  // sample data
  service_quality: "Xizmat sifati",
  payment_dispute: "To'lov bo'yicha nizo",
  suspicious_gps: "Shubhali GPS",
  repeated_pair: "Takroriy juftlik",
  otp_abuse: "OTP suiste'mol",
  referral_abuse: "Referal suiste'mol",
  // real API categories
  driver_behavior: "Haydovchi xulqi",
  passenger_behavior: "Yo'lovchi xulqi",
  payment: "To'lov",
  safety: "Xavfsizlik",
  lost_item: "Yo'qolgan buyum",
  app_issue: "Ilova muammosi",
  other: "Boshqa",
};
const DANGER_TYPES: ComplaintType[] = ["suspicious_gps", "repeated_pair", "otp_abuse", "referral_abuse", "safety"];
const STATUS_TONE: Record<ComplaintStatus, BadgeTone> = {
  open: "pending",
  reviewing: "accent",
  resolved: "success",
  dismissed: "danger",
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
const SUBJECT_LABEL: Record<ComplaintSubjectType, string> = { passenger: "Yo'lovchi", driver: "Haydovchi", order: "Buyurtma" };
const SUBJECT_OPTIONS: { value: ComplaintSubjectType | "all"; label: string }[] = [
  { value: "all", label: "Barcha obyektlar" },
  ...(Object.keys(SUBJECT_LABEL) as ComplaintSubjectType[]).map((s) => ({ value: s, label: SUBJECT_LABEL[s] })),
];
type AssigneeFilter = "all" | "me";
const ASSIGNEE_OPTIONS: { value: AssigneeFilter; label: string }[] = [
  { value: "all", label: "Barcha xodimlar" },
  { value: "me", label: "Menga biriktirilgan" },
];
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
const shortRef = (id: string) => `#${id.slice(0, 8)}`;

type Closing = { id: string; status: "resolved" | "dismissed" };

export function ComplaintsScreen() {
  const { me } = usePermissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ComplaintStatus | "all">("all");
  const [category, setCategory] = useState<ComplaintCategoryFilter>("all");
  const [subjectType, setSubjectType] = useState<ComplaintSubjectType | "all">("all");
  const [assignee, setAssignee] = useState<AssigneeFilter>("all");
  const query: ComplaintQuery = {
    search: caps.complaintSearch ? search : "",
    status,
    category: caps.complaintCategoryFilter ? category : "all",
    subjectType: caps.complaintSubjectFilter ? subjectType : "all",
    assignedToMe: caps.complaintAssigneeFilter && assignee === "me",
  };
  const { items, error, reload } = useAdapterList(api.getComplaints, query);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  // Complaints fetched one by one (with notes), for lists that come without them.
  const [details, setDetails] = useState<Record<string, Complaint>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [closing, setClosing] = useState<Closing | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<Complaint>, onError: (msg: string) => void = setActionError): Promise<boolean> {
    setBusyId(id);
    setActionError(null);
    try {
      const updated = await action();
      setDetails((d) => ({ ...d, [id]: updated }));
      reload();
      return true;
    } catch (e) {
      onError(errorText(e));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  function loadNotes(id: string) {
    setBusyId(id);
    setActionError(null);
    api.getComplaint(id).then(
      (c) => setDetails((d) => ({ ...d, [id]: c })),
      (e) => setActionError(errorText(e))
    ).finally(() => setBusyId(null));
  }

  function assignToMe(id: string) {
    if (!me) return;
    run(id, () => api.assignComplaint(id, me.id));
  }

  function close(id: string, next: Closing["status"]) {
    if (caps.complaintResolution) {
      // The server needs a closing text for resolved/rejected.
      setCloseError(null);
      setClosing({ id, status: next });
      return;
    }
    run(id, () => api.setComplaintStatus(id, next));
  }

  async function confirmClose(resolution?: string) {
    if (!closing) return;
    const { id, status: next } = closing;
    setCloseError(null);
    const ok = await run(id, () => api.setComplaintStatus(id, next, resolution), setCloseError);
    if (ok) setClosing(null);
  }

  async function addNote(id: string) {
    const text = noteDrafts[id]?.trim();
    if (!text) return;
    const ok = await run(id, () => api.addComplaintNote(id, text));
    if (ok) setNoteDrafts((d) => ({ ...d, [id]: "" }));
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

  const hasActiveFilters = status !== "all" || category !== "all" || subjectType !== "all" || assignee !== "all";
  function clearFilters() {
    setStatus("all");
    setCategory("all");
    setSubjectType("all");
    setAssignee("all");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tavsif bo'yicha qidirish…"
          searchEnabled={caps.complaintSearch}
          resultCount={items.length}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        >
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Holat bo'yicha filtr" />
          {caps.complaintCategoryFilter && (
            <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} aria-label="Turi bo'yicha filtr" />
          )}
          {caps.complaintSubjectFilter && (
            <FilterSelect value={subjectType} onChange={setSubjectType} options={SUBJECT_OPTIONS} aria-label="Obyekt bo'yicha filtr" />
          )}
          {caps.complaintAssigneeFilter && (
            <FilterSelect value={assignee} onChange={setAssignee} options={ASSIGNEE_OPTIONS} aria-label="Biriktirilgan xodim bo'yicha filtr" />
          )}
        </ListToolbar>
        <ExportButton
          section="complaints"
          rows={items}
          filenamePrefix="shikoyatlar"
          buildRow={(c) => ({ Turi: TYPE_LABEL[c.type] ?? c.type, Holat: c.status, Tasvir: c.description })}
        />
      </div>

      {actionError && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {actionError}
        </p>
      )}

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
          {items.map((row: Complaint) => {
            // Status/assignee always from the (fresher) list row; only the notes
            // come from the one-by-one fetch when the list has none.
            const detail = details[row.id];
            const c = caps.complaintNotesInList || !detail ? row : { ...row, notes: detail.notes };
            const notesKnown = caps.complaintNotesInList || !!detail;
            return (
              <Card key={c.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge tone={DANGER_TYPES.includes(c.type) ? "danger" : "info"} dot={false}>
                    {TYPE_LABEL[c.type] ?? c.type}
                  </Badge>
                  <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                </div>
                <p className="text-sm text-ink">{c.description}</p>
                <p className="text-xs text-ink/50">
                  {formatDateTime(c.createdAt)}
                  {c.subjectType && c.subjectId && ` · ${SUBJECT_LABEL[c.subjectType]} ${shortRef(c.subjectId)}`}
                  {c.orderId && c.subjectType !== "order" && ` · Buyurtma ${shortRef(c.orderId)}`}
                </p>
                {c.assignedToName && <p className="text-xs text-ink/60">Biriktirilgan: {c.assignedToName}</p>}
                {c.resolution && (
                  <p className="rounded-button bg-ink/5 p-3 text-xs text-ink/70">
                    <span className="font-semibold text-ink">Yakuniy izoh:</span> {c.resolution}
                  </p>
                )}

                {notesKnown ? (
                  c.notes.length > 0 ? (
                    <div className="space-y-2 rounded-button bg-ink/5 p-3">
                      {c.notes.map((n) => (
                        <p key={n.id} className="text-xs text-ink/70">
                          <span className="font-semibold text-ink">{n.authorName}:</span> {n.text}
                        </p>
                      ))}
                    </div>
                  ) : (
                    !caps.complaintNotesInList && <p className="text-xs text-ink/50">Izohlar yo'q.</p>
                  )
                ) : (
                  <Button size="sm" variant="ghost" loading={busyId === c.id} onClick={() => loadNotes(c.id)}>
                    <MessagesSquare className="h-4 w-4" /> Izohlarni ko'rish
                  </Button>
                )}

                {(c.status === "open" || c.status === "reviewing") && (
                  <>
                    <div className="flex gap-2">
                      <input
                        value={noteDrafts[c.id] ?? ""}
                        onChange={(e) => setNoteDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                        placeholder="Izoh qo'shish…"
                        aria-label="Izoh matni"
                        maxLength={1000}
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
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={closing !== null}
        title={closing?.status === "resolved" ? "Shikoyatni hal qilish" : "Shikoyatni rad etish"}
        description="Shikoyat yopiladi. Yakuniy izoh shikoyatda saqlanadi."
        confirmLabel={closing?.status === "resolved" ? "Hal qilish" : "Rad etish"}
        tone={closing?.status === "resolved" ? "accent" : "danger"}
        reasonLabel="Yakuniy izoh (kamida 3 ta belgi)…"
        reasonMinLength={3}
        loading={!!closing && busyId === closing.id}
        error={closeError}
        onConfirm={confirmClose}
        onCancel={() => setClosing(null)}
      />
    </div>
  );
}
