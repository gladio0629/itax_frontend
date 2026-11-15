import { useEffect, useState } from "react";
import { Check, Plus, Wallet, X } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormDrawer } from "@/components/FormDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/Card";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { ListToolbar } from "@/components/ListToolbar";
import { FilterSelect } from "@/components/FilterSelect";
import { api } from "@/api/client";
import { useAdapterList } from "@/hooks/useAdapterList";
import { formatDateTime, formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AdjustmentProposal, Driver, WalletEntryType, WalletLedgerRow, WalletQuery } from "@/api/types";

const caps = api.capabilities;

const TYPE_LABEL: Record<WalletEntryType, string> = {
  cash: "Naqd to'lov",
  card: "Karta to'lovi",
  commission: "Komissiya",
  topup: "Hamyon to'ldirish",
  adjustment: "Tuzatish",
  trip_payment: "Safar to'lovi",
  bonus: "Bonus",
};
const TYPE_TONE: Record<WalletEntryType, "accent" | "info" | "danger" | "warning"> = {
  cash: "accent",
  card: "info",
  commission: "danger",
  topup: "accent",
  adjustment: "warning",
  trip_payment: "accent",
  bonus: "info",
};
// The sample data's own entry types (the real API's ledger can't be filtered).
const TYPE_OPTIONS: { value: WalletEntryType | "all"; label: string }[] = [
  { value: "all", label: "Barcha turlar" },
  ...(["cash", "card", "commission", "topup", "adjustment"] as WalletEntryType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] })),
];
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");

export function WalletScreen() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<WalletEntryType | "all">("all");
  const query: WalletQuery = { search, type };
  const { items: rows, error, reload } = useAdapterList(api.getWalletLedger, query);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [proposals, setProposals] = useState<AdjustmentProposal[]>([]);
  async function loadSide() {
    try {
      const [driverList, adj] = await Promise.all([api.getDrivers({}), api.getAdjustmentProposals({ status: "pending_second" })]);
      setDrivers(driverList);
      setProposals(adj);
    } catch {
      /* the ledger below shows its own error state */
    }
  }
  useEffect(() => {
    loadSide();
  }, []);

  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState({ driverId: "", amount: "", reason: "" });
  const [walletInfo, setWalletInfo] = useState<{ balance: number; debtLimit: number | null } | null>(null);
  const [proposing, setProposing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  function openCreate() {
    const driverId = drivers[0]?.id ?? "";
    setForm({ driverId, amount: "", reason: "" });
    setFormError(null);
    setDrawer(true);
  }

  useEffect(() => {
    if (!drawer || !form.driverId) {
      setWalletInfo(null);
      return;
    }
    api.getDriverWalletInfo(form.driverId).then(setWalletInfo, () => setWalletInfo(null));
  }, [drawer, form.driverId]);

  async function handlePropose() {
    const amount = Number(form.amount);
    if (!form.driverId || !amount || !form.reason.trim()) return;
    setProposing(true);
    setFormError(null);
    try {
      const created = await api.proposeWalletAdjustment(form.driverId, amount, form.reason.trim());
      setDrawer(false);
      // With no list of pending corrections on the server, the second admin
      // needs the id to find it.
      setToast(caps.adjustmentProposalsList ? "Tuzatish ikkinchi adminga yuborildi" : `Tuzatish yaratildi (ID: ${created.id}). Ikkinchi admin tasdiqlaydi.`);
      loadSide();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setProposing(false);
    }
  }

  async function handleApprove(proposalId: string) {
    if (!proposalId.trim()) return;
    setActingId(proposalId);
    setActionError(null);
    try {
      const review = await api.approveAdjustment(proposalId);
      setLookupId("");
      setReviewId(review.id);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(reason?: string) {
    if (!rejectingId) return;
    setActingId(rejectingId);
    setActionError(null);
    try {
      await api.rejectAdjustment(rejectingId, reason);
      setRejectingId(null);
      setLookupId("");
      setToast("Tuzatish rad etildi");
      loadSide();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setActingId(null);
    }
  }

  const columns: Column<WalletLedgerRow>[] = [
    {
      key: "driver",
      // The real ledger only names the wallet, not the driver.
      header: caps.walletDriverName ? "Haydovchi" : "Hamyon",
      sortValue: (r) => r.driverName,
      render: (r) => <span className="block max-w-[180px] truncate">{r.driverName}</span>,
    },
    { key: "type", header: "Turi", render: (r) => <Badge tone={TYPE_TONE[r.type]} dot={false}>{TYPE_LABEL[r.type]}</Badge> },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      sortValue: (r) => r.amount,
      render: (r) => (
        <span className={cn("tabular font-semibold", r.amount < 0 ? "text-danger" : "text-ink")}>
          {r.amount > 0 ? "+" : ""}
          {formatSom(r.amount)}
        </span>
      ),
    },
    { key: "balance", header: "Qoldiq", align: "right", sortValue: (r) => r.balanceAfter, render: (r) => <span className="tabular">{formatSom(r.balanceAfter)}</span> },
    {
      key: "date",
      header: "Sana",
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="text-ink/60">{formatDateTime(r.createdAt)}</span>,
    },
  ];

  if (error) return <ErrorState onRetry={reload} />;
  if (!rows) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const hasActiveFilters = type !== "all";

  return (
    <div className="space-y-6">
      {reviewId && (
        <Card>
          <ReviewStatus
            reviewId={reviewId}
            title="Ikkinchi adminga yuborildi"
            description="Hamyon tuzatishi ikkinchi admin tomonidan tasdiqlanmoqda."
            onApproved={() => {
              setReviewId(null);
              loadSide();
              reload();
            }}
            onRejected={() => {
              setReviewId(null);
              loadSide();
            }}
          />
        </Card>
      )}

      {actionError && !rejectingId && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {actionError}
        </p>
      )}

      {!caps.adjustmentProposalsList && (
        // No endpoint lists pending corrections yet: the second admin opens
        // one by the id the first admin passes on.
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Tuzatishni tasdiqlash yoki rad etish</p>
          <p className="text-xs text-ink/60">Tuzatishni yaratgan xodim bergan ID ni kiriting. O'zingiz yaratgan tuzatishni tasdiqlay olmaysiz.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-96 max-w-full">
              <Input label="Tuzatish ID" value={lookupId} onChange={(e) => setLookupId(e.target.value)} autoComplete="off" spellCheck={false} />
            </div>
            <Button size="sm" disabled={!lookupId.trim()} loading={actingId === lookupId.trim()} onClick={() => handleApprove(lookupId.trim())}>
              <Check className="h-4 w-4" /> Tasdiqlash
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!lookupId.trim()}
              onClick={() => {
                setActionError(null);
                setRejectingId(lookupId.trim());
              }}
            >
              <X className="h-4 w-4" /> Rad etish
            </Button>
          </div>
        </Card>
      )}

      {proposals.length > 0 && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">
            {caps.adjustmentProposalsList ? "Tasdiqlashni kutayotgan tuzatishlar" : "Shu oynada yaratilgan tuzatishlar (ikkinchi admin tasdiqlaydi)"}
          </p>
          {proposals.map((p) => {
            const driver = drivers.find((d) => d.id === p.driverId);
            return (
              <div key={p.id} className="rounded-card border border-warning/20 bg-warning/[0.04] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone="pending">Ikkinchi adminga yuborildi</Badge>
                  <span className="text-xs text-ink/50">{p.proposedByName}</span>
                </div>
                <p className="text-sm text-ink">
                  <span className="font-semibold">{driver?.name ?? p.subjectLabel ?? p.driverId}</span>:{" "}
                  <span className={cn("tabular font-semibold", p.amount < 0 ? "text-danger" : "text-accent")}>
                    {p.amount > 0 ? "+" : ""}
                    {formatSom(p.amount)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink/60">{p.reason}</p>
                {caps.adjustmentProposalsList ? (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" loading={actingId === p.id} onClick={() => handleApprove(p.id)}>
                      <Check className="h-4 w-4" /> Tasdiqlash
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setActionError(null);
                        setRejectingId(p.id);
                      }}
                    >
                      <X className="h-4 w-4" /> Rad etish
                    </Button>
                  </div>
                ) : (
                  <p className="tabular mt-2 select-all text-xs text-ink/50">ID: {p.id}</p>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Haydovchi bo'yicha qidirish…"
          searchEnabled={caps.walletLedgerFilters}
          resultCount={rows.length}
          hasActiveFilters={hasActiveFilters}
          onClear={() => setType("all")}
        >
          {caps.walletLedgerFilters && <FilterSelect value={type} onChange={setType} options={TYPE_OPTIONS} aria-label="Turi bo'yicha filtr" />}
        </ListToolbar>
        <div className="flex shrink-0 items-center gap-2">
          <ExportButton
            section="wallet"
            rows={rows}
            filenamePrefix="hamyon"
            buildRow={(r) => ({ Haydovchi: r.driverName, Turi: r.type, Summa: r.amount, Qoldiq: r.balanceAfter })}
          />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tuzatish yozuvi qo'shish
          </Button>
        </div>
      </div>

      <DataTable
        key={`${search}-${type}`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        pageSize={15}
        emptyIcon={<Wallet className="h-6 w-6" />}
        emptyTitle="Yozuvlar topilmadi"
        emptyDescription="Qidiruv yoki filtrlarga mos yozuv yo'q."
      />

      <FormDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Tuzatish yozuvi qo'shish"
        onSubmit={handlePropose}
        submitLabel="Taklif qilish"
        loading={proposing}
        error={formError}
        disabled={!form.driverId || !Number(form.amount) || form.reason.trim().length < caps.adjustmentReasonMinLength}
      >
        <p className="text-xs text-ink/60">Yozuv faqat ikkinchi admin tasdiqlagandan so'ng qo'llaniladi. Hamyon jurnali faqat qo'shish uchun — mavjud yozuvlarni tahrirlash yoki o'chirish mumkin emas.</p>
        <div>
          <label htmlFor="fld-haydovchi" className="mb-2 block text-sm font-semibold text-ink/80">Haydovchi<span className="ml-1 text-danger" aria-hidden>
            *
          </span></label>
          <select id="fld-haydovchi"
            value={form.driverId}
            onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}
            className="h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        {walletInfo && (
          <div className="flex items-center justify-between rounded-button bg-ink/5 px-4 py-3 text-xs">
            <span className="text-ink/60">
              Joriy balans:{" "}
              <span className={cn("font-semibold", walletInfo.debtLimit !== null && walletInfo.balance < walletInfo.debtLimit ? "text-danger" : "text-ink")}>
                {formatSom(walletInfo.balance)}
              </span>
            </span>
            {walletInfo.debtLimit !== null && (
              <span className="text-ink/60">
                Qarz limiti: <span className="font-semibold text-ink">{formatSom(walletInfo.debtLimit)}</span>
              </span>
            )}
          </div>
        )}
        <Input
          label="Summa (so'm, manfiy bo'lishi mumkin)"
          required
          type="number"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
        />
        <Input
          label="Sabab"
          required
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          hint={caps.adjustmentReasonMinLength > 1 ? `Kamida ${caps.adjustmentReasonMinLength} ta belgi.` : undefined}
        />
      </FormDrawer>

      <ConfirmDialog
        open={rejectingId !== null}
        title="Tuzatishni rad etish"
        description="Tuzatish balansga ta'sir qilmaydi va yopiladi."
        confirmLabel="Rad etish"
        reasonLabel="Rad etish sababi (kamida 3 ta belgi)…"
        reasonMinLength={3}
        loading={actingId === rejectingId}
        error={actionError}
        onConfirm={handleReject}
        onCancel={() => setRejectingId(null)}
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
