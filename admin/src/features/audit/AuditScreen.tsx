import { useState } from "react";
import { History } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { ListToolbar } from "@/components/ListToolbar";
import { FilterSelect } from "@/components/FilterSelect";
import { api } from "@/api/client";
import { useAdapterList } from "@/hooks/useAdapterList";
import { formatDateTime } from "@/lib/format";
import type { AuditAction, AuditEntry, AuditQuery } from "@/api/types";

// AuditAction labels below are the sample data's action names.

const ACTION_LABEL: Record<AuditAction, string> = {
  login_requested: "Kirish so'rovi",
  login_verified: "Kirish tasdiqlandi",
  logout: "Chiqish",
  driver_edit: "Haydovchi tahrirlandi",
  driver_block: "Haydovchi bloklandi",
  driver_unblock: "Haydovchi blokdan chiqarildi",
  driver_archive: "Haydovchi arxivlandi",
  driver_restore: "Haydovchi tiklandi",
  passenger_create: "Yo'lovchi qo'shildi",
  passenger_edit: "Yo'lovchi tahrirlandi",
  passenger_block: "Yo'lovchi bloklandi",
  passenger_unblock: "Yo'lovchi blokdan chiqarildi",
  passenger_archive: "Yo'lovchi arxivlandi",
  passenger_restore: "Yo'lovchi tiklandi",
  order_create: "Buyurtma yaratildi",
  order_edit: "Buyurtma tahrirlandi",
  order_cancel: "Buyurtma bekor qilindi",
  wallet_adjust_propose: "Hamyon tuzatishi taklif qilindi",
  wallet_adjust_approve: "Hamyon tuzatishi tasdiqlandi",
  wallet_adjust_reject: "Hamyon tuzatishi rad etildi",
  tariff_propose: "Tarif taklif qilindi",
  tariff_second_approve: "Tarif tasdiqlandi (2-admin)",
  tariff_reject: "Tarif rad etildi",
  complaint_assign: "Shikoyat biriktirildi",
  complaint_status: "Shikoyat holati o'zgardi",
  complaint_note: "Shikoyatga izoh qo'shildi",
  complaint_close: "Shikoyat yopildi",
  staff_create: "Xodim qo'shildi",
  staff_edit: "Xodim tahrirlandi",
  staff_block: "Xodim bloklandi",
  staff_unblock: "Xodim blokdan chiqarildi",
  staff_archive: "Xodim arxivlandi",
  staff_restore: "Xodim tiklandi",
  operator_task_start: "Operator vazifasi boshlandi",
  operator_task_result: "Operator vazifasi yakunlandi",
  operator_history_edit: "Operator tarixi tahrirlandi",
  export: "Eksport qilindi",
};
// The real backend's action names (AuditEntry.action is a free string in
// the contract; unknown ones are shown as they come).
const API_ACTION_LABEL: Record<string, string> = {
  "staff.create": "Xodim qo'shildi",
  "staff.update": "Xodim tahrirlandi",
  "staff.archive": "Xodim arxivlandi",
  "staff.provision": "Xodim hisobi yaratildi",
  "driver.create": "Haydovchi qo'shildi",
  "driver.update": "Haydovchi tahrirlandi",
  "driver.block": "Haydovchi bloklandi",
  "driver.unblock": "Haydovchi blokdan chiqarildi",
  "driver.archive": "Haydovchi arxivlandi",
  "driver.restore": "Haydovchi tiklandi",
  "passenger.create": "Yo'lovchi qo'shildi",
  "passenger.update": "Yo'lovchi tahrirlandi",
  "passenger.block": "Yo'lovchi bloklandi",
  "passenger.unblock": "Yo'lovchi blokdan chiqarildi",
  "passenger.archive": "Yo'lovchi arxivlandi",
  "passenger.restore": "Yo'lovchi tiklandi",
  "order.update": "Buyurtma tahrirlandi",
  "order.cancel": "Buyurtma bekor qilindi",
  "wallet.correction.create": "Hamyon tuzatishi taklif qilindi",
  "wallet.correction.approve": "Hamyon tuzatishi tasdiqlandi",
  "wallet.correction.reject": "Hamyon tuzatishi rad etildi",
  "tariff.create": "Tarif taklif qilindi",
  "tariff.update": "Tarif o'zgarishi taklif qilindi",
  "tariff.delete": "Tarifni arxivlash taklif qilindi",
  "tariff.approve": "Tarif tasdiqlandi (2-admin)",
  "tariff.reject": "Tarif rad etildi",
  "complaint.create": "Shikoyat yaratildi",
  "complaint.assign": "Shikoyat biriktirildi",
  "complaint.start": "Shikoyat ko'rib chiqishga olindi",
  "complaint.resolve": "Shikoyat hal qilindi",
  "complaint.reject": "Shikoyat rad etildi",
  "complaint.note.add": "Shikoyatga izoh qo'shildi",
  "operator.enqueue": "Operator navbatiga qo'shildi",
  "operator.start": "Operator vazifasi boshlandi",
  "operator.reject": "Operator vazifasi rad etildi",
  "operator.complete": "Operator vazifasi yakunlandi",
};
const ENTITY_LABEL: Record<string, string> = {
  staff: "Xodim",
  driver: "Haydovchi",
  passenger: "Yo'lovchi",
  order: "Buyurtma",
  correction: "Hamyon tuzatishi",
  tariff: "Tarif",
  complaint: "Shikoyat",
  queue_item: "Operator vazifasi",
};
const LABELS: Record<string, string> = api.capabilities.auditApiFilters ? API_ACTION_LABEL : ACTION_LABEL;
const actionLabel = (a: string) => LABELS[a] ?? (ACTION_LABEL as Record<string, string>)[a] ?? a;
const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Barcha amallar" },
  ...Object.keys(LABELS).map((a) => ({ value: a, label: LABELS[a] })),
];
const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Barcha obyektlar" },
  ...Object.keys(ENTITY_LABEL).map((e) => ({ value: e, label: ENTITY_LABEL[e] })),
];
const caps = api.capabilities;

export function AuditScreen() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");
  const [entityType, setEntityType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const query: AuditQuery = {
    search: caps.auditSearch ? search : "",
    action,
    entityType: caps.auditApiFilters ? entityType : "all",
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
  const { items: entries, error, reload } = useAdapterList(api.getAuditLog, query);

  const columns: Column<AuditEntry>[] = [
    {
      key: "date",
      header: "Sana",
      sortValue: (e) => e.createdAt,
      render: (e) => <span className="text-ink/60">{formatDateTime(e.createdAt)}</span>,
    },
    {
      key: "actor",
      header: "Admin",
      sortValue: (e) => e.actorName,
      render: (e) => <span className="block max-w-[140px] truncate">{e.actorName}</span>,
    },
    { key: "action", header: "Amal", render: (e) => <Badge tone="info">{actionLabel(e.action)}</Badge> },
    {
      key: "target",
      header: "Obyekt",
      render: (e) => (
        <span className="block max-w-[160px] truncate text-ink/70" title={`${e.targetType}: ${e.targetId}`}>
          {ENTITY_LABEL[e.targetType] && caps.auditApiFilters ? ENTITY_LABEL[e.targetType] : e.targetType}: {e.targetId}
        </span>
      ),
    },
    {
      key: "detail",
      header: "Tafsilot",
      render: (e) => <span className="block max-w-[260px] truncate text-ink/70" title={e.detail}>
          {e.detail}
        </span>,
    },
  ];

  if (error) return <ErrorState onRetry={reload} />;
  if (!entries) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const hasActiveFilters = action !== "all" || entityType !== "all" || !!dateFrom || !!dateTo;
  function clearFilters() {
    setAction("all");
    setEntityType("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Admin, amal yoki obyekt bo'yicha qidirish…"
        searchEnabled={caps.auditSearch}
        resultCount={entries.length}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      >
        <FilterSelect value={action} onChange={setAction} options={ACTION_OPTIONS} aria-label="Amal bo'yicha filtr" />
        {caps.auditApiFilters && (
          <FilterSelect value={entityType} onChange={setEntityType} options={ENTITY_OPTIONS} aria-label="Obyekt turi bo'yicha filtr" />
        )}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Boshlanish sanasi"
          className="h-10 rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Tugash sanasi"
          className="h-10 rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
      </ListToolbar>

      <DataTable
        key={`${search}-${action}-${entityType}-${dateFrom}-${dateTo}`}
        columns={columns}
        rows={entries}
        rowKey={(e) => e.id}
        pageSize={15}
        emptyIcon={<History className="h-6 w-6" />}
        emptyTitle="Hech narsa topilmadi"
        emptyDescription="Qidiruv yoki filtrlarga mos audit yozuvi yo'q."
      />
    </div>
  );
}
