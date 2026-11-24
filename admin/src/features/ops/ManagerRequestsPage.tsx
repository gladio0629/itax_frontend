import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Inbox, Info, Lock, Phone, Wallet, XCircle } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { useAdapterList } from "@/hooks/useAdapterList";
import { Card, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { TextArea } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { InfoNote } from "@/components/Cells";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { ChangeConfirmModal } from "@/components/ChangeConfirmModal";
import { ModalNote } from "@/components/Modal";
import { cn } from "@/lib/cn";
import { refreshSectionBadges } from "@/lib/badgeEvents";
import { formatNumber, formatShortDateTime } from "@/lib/format";
import { Tag } from "@/features/operators/labels";
import { REQUEST_STATUS, REQUEST_TYPE, REQUEST_TYPES } from "./requestLabels";
import { opPath } from "./paths";
import type { ManagerRequest, ManagerRequestCounts, ManagerRequestPreview, ManagerRequestQuery, ManagerRequestStatus, ManagerRequestType } from "@/api/ops/types";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
type Period = NonNullable<ManagerRequestQuery["period"]>;
const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "today", label: "Bugun" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
];
const CHIPS: { key: ManagerRequestStatus; label: string }[] = [
  { key: "pending", label: "Kutilmoqda" },
  { key: "approved", label: "Tasdiqlangan" },
  { key: "rejected", label: "Rad etilgan" },
];
const shortName = (name: string) => {
  const [first, last] = name.split(" ");
  return last ? `${first} ${last[0]}.` : first;
};

/** Manager "So'rovlar" (design ManagerRequests): operators' requests.
 * "Tasdiqlash" on a money request first shows the server's old → new rows
 * (ManagerRequestConfirm); "Rad etish" needs a reason. The server applies
 * the change and writes the audit entry. */
export function ManagerRequestsPage() {
  const { me } = usePermissions();
  const [status, setStatus] = useState<ManagerRequestStatus>("pending");
  const [type, setType] = useState<ManagerRequestType | "all">("all");
  const [operatorId, setOperatorId] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("all");
  const filters = { type, operatorId, period };
  const { items, error, reload } = useAdapterList(api.getManagerRequests, { ...filters, status });
  // "So'nggi qarorlar" under the pending list.
  const decided = useAdapterList(api.getManagerRequests, { ...filters, status: "decided" } as ManagerRequestQuery);
  const [counts, setCounts] = useState<ManagerRequestCounts | null>(null);
  const [countsTick, setCountsTick] = useState(0);
  const [operators, setOperators] = useState<{ id: string; name: string }[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const countsKey = JSON.stringify(filters);
  useEffect(() => {
    let live = true;
    api
      .getManagerRequestCounts(filters)
      .then((c) => live && setCounts(c))
      .catch(() => live && setCounts(null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey, countsTick]);
  useEffect(() => {
    api
      .getOperatorsList()
      .then(setOperators)
      .catch(() => setOperators(null));
  }, []);

  const refresh = (message: string) => {
    setToast(message);
    refreshSectionBadges();
    reload();
    decided.reload();
    setCountsTick((n) => n + 1);
  };

  const orderHref = (id: string) => (me?.sections.includes("orders") ? `/orders/${encodeURIComponent(id)}` : opPath.order(id));
  const recent = decided.items ?? [];

  const decisionColumns: Column<ManagerRequest>[] = [
    { key: "code", header: "So'rov", render: (r) => <span className="font-extrabold">{r.code}</span> },
    { key: "type", header: "Turi", render: (r) => <Tag className="bg-surface text-ink">{REQUEST_TYPE[r.type]}</Tag> },
    { key: "op", header: "Operator", render: (r) => shortName(r.operator.name) },
    { key: "amount", header: "Summa", align: "right", render: (r) => (r.amount !== null ? formatNumber(r.amount) : "—") },
    { key: "decision", header: "Qaror", render: (r) => <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge> },
    { key: "by", header: "Kim", render: (r) => (r.decision ? shortName(r.decision.byName) : "—") },
    {
      key: "at",
      header: "Vaqt",
      sortValue: (r) => r.decision?.at ?? r.createdAt,
      render: (r) => <span className="tabular text-muted">{r.decision ? formatShortDateTime(r.decision.at) : "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader subtitle="Operatorlardan kelgan so'rovlar" title="So'rovlar" />

      <div className="flex flex-wrap items-center gap-2.5">
        <FilterChips label="Holat bo'yicha" items={CHIPS.map((c) => ({ ...c, count: counts ? counts[c.key] ?? 0 : undefined }))} value={status} onChange={setStatus} />
        <span className="flex-1" />
        <FilterSelect
          label="Turi"
          aria-label="So'rov turi"
          value={type}
          onChange={setType}
          options={[{ value: "all", label: "Hammasi" }, ...REQUEST_TYPES.map((t) => ({ value: t, label: REQUEST_TYPE[t] }))]}
        />
        {operators && (
          <FilterSelect
            label="Operator"
            aria-label="Operator"
            value={operatorId}
            onChange={setOperatorId}
            options={[{ value: "all", label: "Hammasi" }, ...operators.map((o) => ({ value: o.id, label: o.name }))]}
          />
        )}
        <FilterSelect label="Sana" aria-label="Sana" value={period} onChange={setPeriod} options={PERIODS} />
      </div>

      <InfoNote icon={<Info className="h-[18px] w-[18px]" aria-hidden />}>
        Pul bilan bog'liq so'rovni tasdiqlashdan oldin "eski → yangi" oynasi chiqadi. Har qaror audit jurnaliga yoziladi.
      </InfoNote>

      {error && items && <StaleNotice onRetry={reload} />}
      {error && !items ? (
        <ErrorState onRetry={reload} />
      ) : !items ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[170px] rounded-card" />)
      ) : status !== "pending" ? (
        <DataTable
          columns={decisionColumns}
          rows={items}
          rowKey={(r) => r.id}
          emptyIcon={<Inbox />}
          emptyTitle="So'rov topilmadi"
          emptyDescription="Filtrlarni o'zgartirib ko'ring."
        />
      ) : items.length === 0 ? (
        <EmptyState icon={<CheckCircle2 />} title="Kutilayotgan so'rov yo'q" description="Operatorlardan yangi so'rov kelganda shu yerda ko'rinadi." />
      ) : (
        items.map((r) => <RequestCard key={r.id} request={r} orderHref={orderHref} onDone={refresh} />)
      )}

      {status === "pending" && recent.length > 0 && (
        <Card className="flex flex-col gap-4">
          <CardTitle>So'nggi qarorlar</CardTitle>
          <DataTable bare columns={decisionColumns} rows={recent} rowKey={(r) => r.id} pageSize={10} />
        </Card>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

const ICON: Partial<Record<ManagerRequestType, typeof Wallet>> = { block: Lock, unblock: Lock, phone_change: Phone };

function RequestCard({ request: r, orderHref, onDone }: { request: ManagerRequest; orderHref: (id: string) => string; onDone: (message: string) => void }) {
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | "preview" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ManagerRequestPreview | null>(null);
  const sending = useRef(false);
  const Icon = ICON[r.type] ?? Wallet;
  const danger = r.type === "block";
  const canApprove = r.allowedActions.includes("approve");
  const canReject = r.allowedActions.includes("reject");

  async function run(kind: "approve" | "reject" | "preview", fn: () => Promise<void>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  const approve = () =>
    run("approve", async () => {
      await api.approveManagerRequest(r.id);
      setPreview(null);
      onDone(`${r.code} tasdiqlandi`);
    });
  const onApprove = () =>
    r.needsPreview
      ? run("preview", async () => {
          setPreview(await api.getManagerRequestPreview(r.id));
        })
      : approve();
  const reject = () =>
    run("reject", async () => {
      await api.rejectManagerRequest(r.id, reason.trim());
      onDone(`${r.code} rad etildi`);
    });

  return (
    <Card className="flex flex-col gap-3.5 px-[22px]">
      <div className="flex items-start gap-3.5">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]", danger ? "bg-error-soft text-error" : "bg-green-soft text-green-text")}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[17px] font-extrabold leading-6">{r.title}</h2>
            <Tag className="bg-surface text-ink">{REQUEST_TYPE[r.type]}</Tag>
            <span className="text-xs font-bold text-muted">{r.code}</span>
          </span>
          <span className="tabular text-13 font-semibold text-muted">
            {r.operator.name} (operator) · {formatShortDateTime(r.createdAt).toLowerCase()} ·{" "}
            {r.order ? (
              <Link to={orderHref(r.order.id)} className="font-extrabold text-green-text hover:underline">
                {r.order.label}
              </Link>
            ) : (
              r.subject.phone ?? r.subject.name
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
          <span className="tabular text-lg font-extrabold">{r.amount !== null ? `${formatNumber(r.amount)} so'm` : "—"}</span>
        </span>
      </div>
      <div className="flex flex-col gap-3 sm:pl-[58px]">
        <p className="text-sm leading-[21px]">
          <b className="font-extrabold">Sabab:</b> {r.reason}
        </p>
        {mode === "reject" && (
          <TextArea label="Rad etish sababi (majburiy)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} autoFocus />
        )}
        {error && !preview && (
          <p role="alert" className="text-13 font-semibold text-error">
            {error}
          </p>
        )}
        {(canApprove || canReject) && (
          <div className="flex flex-wrap justify-end gap-2.5">
            {mode === "reject" ? (
              <>
                <Button variant="soft" onClick={() => setMode("idle")} disabled={!!busy}>
                  Orqaga
                </Button>
                <Button variant="danger" onClick={reject} loading={busy === "reject"} disabled={!reason.trim() || !!busy}>
                  <XCircle className="h-4 w-4" aria-hidden /> Rad etishni yuborish
                </Button>
              </>
            ) : (
              <>
                {canReject && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      setMode("reject");
                      setReason("");
                      setError(null);
                    }}
                    disabled={!!busy}
                  >
                    <XCircle className="h-4 w-4" aria-hidden /> Rad etish
                  </Button>
                )}
                {canApprove && (
                  <Button onClick={onApprove} loading={busy === "approve" || busy === "preview"} disabled={!!busy}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Tasdiqlash
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <ChangeConfirmModal
        open={!!preview}
        title={preview?.title ?? ""}
        description="Tasdiqlasangiz, quyidagi o'zgarishlar darhol bajariladi."
        rows={(preview?.rows ?? []).map((row) => ({ label: row.label, before: `${formatNumber(row.before)} so'm`, after: `${formatNumber(row.after)} so'm` }))}
        facts={[
          { label: "So'radi", value: r.operator.name },
          ...(r.order ? [{ label: "Buyurtma", value: r.order.label }] : []),
          { label: r.subject.kind === "driver" ? "Haydovchi" : "Yo'lovchi", value: [r.subject.name, r.subject.phone].filter(Boolean).join(" · ") },
        ]}
        extra={
          <ModalNote icon={<Info className="h-4 w-4" aria-hidden />}>
            Daftardagi eski yozuvlar o'zgarmaydi: yangi "Qaytarish" va "Tuzatish" yozuvlari qo'shiladi.
          </ModalNote>
        }
        confirmLabel="Tasdiqlash va bajarish"
        loading={busy === "approve"}
        error={preview ? error : null}
        onConfirm={approve}
        onCancel={() => {
          setPreview(null);
          setError(null);
        }}
      />
    </Card>
  );
}
