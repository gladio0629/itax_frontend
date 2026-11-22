import { useState } from "react";
import { History, Lock, Search } from "lucide-react";
import { useSearchFromUrl } from "@/hooks/useSearchFromUrl";
import { PageHeader } from "@/layouts/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { SearchInput } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { ExportButton } from "@/components/ExportButton";
import { InfoNote, PersonCell } from "@/components/Cells";
import { api } from "@/api/client";
import { useAdapterList } from "@/hooks/useAdapterList";
import { ROLE_LABEL } from "@/lib/roles";
import { formatDate, formatTime } from "@/lib/format";
import { dayPresetRange, type DayPreset } from "@/lib/periods";
import type { AuditAction, AuditCategory, AuditEntry, AuditQuery } from "@/api/types";

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
  order_to_operator: "Buyurtma operatorga yuborildi",
  wallet_correction: "Tuzatish yozuvi qo'shildi",
  tariff_update: "Tarif o'zgartirildi",
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
  "wallet.correction.create": "Tuzatish yozuvi qo'shildi",
  "tariff.update": "Tarif o'zgartirildi",
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
  { value: "all", label: "Hammasi" },
  ...Object.keys(LABELS).map((a) => ({ value: a, label: LABELS[a] })),
];
const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Hammasi" },
  ...Object.keys(ENTITY_LABEL).map((e) => ({ value: e, label: ENTITY_LABEL[e] })),
];
const caps = api.capabilities;

const CATEGORIES: { key: AuditCategory | "all"; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "money", label: "Pul" },
  { key: "tariff", label: "Tarif" },
  { key: "block", label: "Bloklash" },
  { key: "personal", label: "Shaxsiy ma'lumot" },
  { key: "login", label: "Kirish" },
  { key: "staff", label: "Xodim" },
];
type Period = DayPreset | "custom";
const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "today", label: "Bugun" },
  { value: "yesterday", label: "Kecha" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
  { value: "custom", label: "Boshqa sana" },
];
const DATE_INPUT =
  "tabular h-11 rounded-full bg-white px-3.5 text-13 font-bold text-ink shadow-hairline outline-none focus:shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]";
const targetText = (e: AuditEntry) => `${ENTITY_LABEL[e.targetType] && caps.auditApiFilters ? ENTITY_LABEL[e.targetType] : e.targetType} · ${e.targetId}`;

/** Audit jurnali (design Audit): read-only, nothing here edits a record. */
export function AuditScreen() {
  const [search, setSearch] = useState("");
  useSearchFromUrl(setSearch);
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [action, setAction] = useState<string>("all");
  const [entityType, setEntityType] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const range = period === "custom" ? { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } : dayPresetRange(period);
  const query: AuditQuery = {
    search: caps.auditSearch ? search : "",
    action,
    entityType: caps.auditApiFilters ? entityType : "all",
    category: caps.auditCategories ? category : "all",
    ...range,
  };
  const { items: entries, error, reload } = useAdapterList(api.getAuditLog, query);
  const showIp = !!entries?.some((e) => e.ip);

  const columns: Column<AuditEntry>[] = [
    {
      key: "date",
      header: "Vaqt",
      sortValue: (e) => e.createdAt,
      render: (e) => (
        <span className="flex flex-col">
          <span className="tabular font-bold">{formatTime(e.createdAt)}</span>
          <span className="tabular text-xs font-semibold text-muted">{formatDate(e.createdAt)}</span>
        </span>
      ),
    },
    {
      key: "actor",
      header: "Xodim",
      sortValue: (e) => e.actorName,
      render: (e) => <PersonCell name={e.actorName} sub={e.actorRole ? ROLE_LABEL[e.actorRole] : undefined} />,
    },
    { key: "action", header: "Amal", render: (e) => <span className="font-bold">{actionLabel(e.action)}</span> },
    {
      key: "target",
      header: "Obyekt",
      truncate: { maxWidth: 300, title: (e) => `${targetText(e)}${e.detail ? ` — ${e.detail}` : ""}` },
      render: (e) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{targetText(e)}</span>
          {e.detail && <span className="truncate text-xs font-semibold text-muted">{e.detail}</span>}
        </span>
      ),
    },
    ...(showIp ? [{ key: "ip", header: "IP", render: (e: AuditEntry) => <span className="tabular text-muted">{e.ip ?? "—"}</span> } satisfies Column<AuditEntry>] : []),
  ];

  return (
    <>
      <PageHeader
        subtitle="Kim, nima, qachon"
        title="Audit jurnali"
        actions={
          <ExportButton
            section="audit"
            rows={entries ?? []}
            filenamePrefix="audit"
            buildRow={(e) => ({
              Vaqt: new Date(e.createdAt).toISOString(),
              Xodim: e.actorName,
              Rol: e.actorRole ? ROLE_LABEL[e.actorRole] : "",
              Amal: actionLabel(e.action),
              Obyekt: targetText(e),
              Tafsilot: e.detail,
              IP: e.ip ?? "",
            })}
          />
        }
      />

      <InfoNote icon={<Lock className="h-[18px] w-[18px]" aria-hidden />}>
        Jurnal <b className="text-ink">o'zgarmaydi</b>: hech kim, superadmin ham, yozuvni tahrirlay yoki o'chira olmaydi.
      </InfoNote>

      <div className="flex flex-wrap items-center gap-2.5">
        {caps.auditSearch && (
          <SearchInput
            className="w-[260px] max-w-full"
            label="Xodim, amal yoki obyekt"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" aria-hidden />}
          />
        )}
        {caps.auditCategories && <FilterChips label="Toifa bo'yicha" items={CATEGORIES} value={category} onChange={setCategory} />}
        <span className="flex-1" />
        <FilterSelect label="Amal" aria-label="Amal" value={action} onChange={setAction} options={ACTION_OPTIONS} />
        {caps.auditApiFilters && <FilterSelect label="Obyekt" aria-label="Obyekt turi" value={entityType} onChange={setEntityType} options={ENTITY_OPTIONS} />}
        <FilterSelect label="Sana" aria-label="Sana" value={period} onChange={setPeriod} options={PERIODS} />
        {period === "custom" && (
          <>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Boshlanish sanasi" className={DATE_INPUT} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Tugash sanasi" className={DATE_INPUT} />
          </>
        )}
      </div>

      {error && entries && <StaleNotice onRetry={reload} />}
      {error && !entries ? (
        <ErrorState onRetry={reload} />
      ) : !entries ? (
        <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={entries}
          rowKey={(e) => e.id}
          pageSize={15}
          emptyIcon={<History />}
          emptyTitle="Yozuv topilmadi"
          emptyDescription="Qidiruv yoki filtrlarga mos audit yozuvi yo'q."
        />
      )}
    </>
  );
}
