import { useEffect, useState } from "react";
import { Check, Plus, Wallet, X } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Drawer } from "@/components/Drawer";
import { Card } from "@/components/Card";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { api } from "@/api/client";
import { formatDateTime, formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AdjustmentProposal, Driver, WalletEntryType, WalletLedgerRow } from "@/api/types";

const TYPE_LABEL: Record<WalletEntryType, string> = {
  cash: "Naqd to'lov",
  card: "Karta to'lovi",
  commission: "Komissiya",
  topup: "Hamyon to'ldirish",
  adjustment: "Tuzatish",
};
const TYPE_TONE: Record<WalletEntryType, "accent" | "info" | "danger" | "warning"> = {
  cash: "accent",
  card: "info",
  commission: "danger",
  topup: "accent",
  adjustment: "warning",
};

export function WalletScreen() {
  const [rows, setRows] = useState<WalletLedgerRow[] | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [proposals, setProposals] = useState<AdjustmentProposal[]>([]);
  const [error, setError] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState({ driverId: "", amount: "", reason: "" });
  const [proposing, setProposing] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setError(false);
    try {
      const [ledger, driverList, adj] = await Promise.all([api.getWalletLedger(), api.getDrivers(), api.getAdjustmentProposals()]);
      setRows(ledger);
      setDrivers(driverList);
      setProposals(adj);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm({ driverId: drivers[0]?.id ?? "", amount: "", reason: "" });
    setDrawer(true);
  }

  async function handlePropose() {
    const amount = Number(form.amount);
    if (!form.driverId || !amount || !form.reason.trim()) return;
    setProposing(true);
    try {
      await api.proposeWalletAdjustment(form.driverId, amount, form.reason.trim());
      setDrawer(false);
      setToast("Tuzatish ikkinchi adminga yuborildi");
      await load();
    } finally {
      setProposing(false);
    }
  }

  async function handleApprove(proposalId: string) {
    setActingId(proposalId);
    try {
      const review = await api.approveAdjustment(proposalId);
      setReviewId(review.id);
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(proposalId: string) {
    setActingId(proposalId);
    try {
      await api.rejectAdjustment(proposalId);
      await load();
    } finally {
      setActingId(null);
    }
  }

  const columns: Column<WalletLedgerRow>[] = [
    { key: "driver", header: "Haydovchi", sortValue: (r) => r.driverName, render: (r) => <span className="block max-w-[180px] truncate">{r.driverName}</span> },
    { key: "type", header: "Turi", render: (r) => <Badge tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type]}</Badge> },
    {
      key: "amount",
      header: "Summa",
      sortValue: (r) => r.amount,
      render: (r) => (
        <span className={cn("tabular font-medium", r.amount < 0 ? "text-danger" : "text-ink")}>
          {r.amount > 0 ? "+" : ""}
          {formatSom(r.amount)}
        </span>
      ),
    },
    { key: "balance", header: "Qoldiq", sortValue: (r) => r.balanceAfter, render: (r) => <span className="tabular">{formatSom(r.balanceAfter)}</span> },
    {
      key: "date",
      header: "Sana",
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="text-xs text-ink/60">{formatDateTime(r.createdAt)}</span>,
    },
  ];

  if (error) return <ErrorState onRetry={load} />;
  if (!rows) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const pending = proposals.filter((p) => p.status === "pending_second");

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
              load();
            }}
            onRejected={() => {
              setReviewId(null);
              load();
            }}
          />
        </Card>
      )}

      {pending.length > 0 && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Tasdiqlashni kutayotgan tuzatishlar</p>
          {pending.map((p) => {
            const driver = drivers.find((d) => d.id === p.driverId);
            return (
              <div key={p.id} className="rounded-2xl bg-ink/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone="warning">Ikkinchi adminga yuborildi</Badge>
                  <span className="text-xs text-ink/50">{p.proposedByName}</span>
                </div>
                <p className="text-sm text-ink">
                  <span className="font-medium">{driver?.name ?? p.driverId}</span>:{" "}
                  <span className={cn("tabular font-semibold", p.amount < 0 ? "text-danger" : "text-accent")}>
                    {p.amount > 0 ? "+" : ""}
                    {formatSom(p.amount)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink/60">{p.reason}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" loading={actingId === p.id} onClick={() => handleApprove(p.id)}>
                    <Check className="h-3.5 w-3.5" /> Tasdiqlash
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleReject(p.id)}>
                    <X className="h-3.5 w-3.5" /> Rad etish
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">To'lovlar jurnali</p>
        <div className="flex items-center gap-2">
          <ExportButton
            section="wallet"
            rows={rows}
            filenamePrefix="hamyon"
            buildRow={(r) => ({ Haydovchi: r.driverName, Turi: r.type, Summa: r.amount, Qoldiq: r.balanceAfter })}
          />
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tuzatish yozuvi qo'shish
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        searchFields={(r) => r.driverName}
        searchPlaceholder="Haydovchi bo'yicha qidirish..."
        pageSize={15}
        emptyIcon={<Wallet className="h-6 w-6" />}
        emptyTitle="Yozuvlar topilmadi"
      />

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Tuzatish yozuvi qo'shish">
        <div className="space-y-4">
          <p className="text-xs text-ink/60">Yozuv faqat ikkinchi admin tasdiqlagandan so'ng qo'llaniladi. Hamyon jurnali faqat qo'shish uchun — mavjud yozuvlarni tahrirlash yoki o'chirish mumkin emas.</p>
          <div>
            <label className="mb-2 block text-sm font-semibold text-ink/80">Haydovchi</label>
            <select
              value={form.driverId}
              onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-ink outline-none focus:border-accent"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Summa (so'm, manfiy bo'lishi mumkin)"
            type="number"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <Input label="Sabab" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          <Button fullWidth loading={proposing} disabled={!form.driverId || !Number(form.amount) || !form.reason.trim()} onClick={handlePropose}>
            Taklif qilish
          </Button>
        </div>
      </Drawer>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
