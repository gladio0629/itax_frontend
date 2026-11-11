import { useEffect, useState } from "react";
import { Archive, Check, Plus, SlidersHorizontal, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatSom } from "@/lib/format";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ReviewStatus } from "@/components/ReviewStatus";
import { FormDrawer } from "@/components/FormDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { ListToolbar } from "@/components/ListToolbar";
import { api } from "@/api/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Tariff, TariffProposal } from "@/api/types";

const FIELD_LABEL: Record<keyof Omit<Tariff, "id" | "archived">, string> = {
  name: "Nomi",
  baseFare: "Bazaviy narx",
  perKmCar: "Km narxi (avtomobil)",
  perKmSeat: "Km narxi (o'rindiq)",
  frontSeatSurcharge: "Old o'rindiq ustamasi",
  fuelAdjustmentPct: "Yoqilg'i ustamasi (%)",
  commissionPct: "Komissiya (%)",
};
const NUMERIC_FIELDS = (Object.keys(FIELD_LABEL) as (keyof typeof FIELD_LABEL)[]).filter((k) => k !== "name") as Exclude<keyof typeof FIELD_LABEL, "name">[];
function formatTariffValue(k: (typeof NUMERIC_FIELDS)[number], v: number): string {
  return k === "fuelAdjustmentPct" || k === "commissionPct" ? `${v}%` : formatSom(v);
}

type FormState = { name: string; baseFare: string; perKmCar: string; perKmSeat: string; frontSeatSurcharge: string; fuelAdjustmentPct: string; commissionPct: string };
function tariffToForm(t: Tariff): FormState {
  return {
    name: t.name,
    baseFare: String(t.baseFare),
    perKmCar: String(t.perKmCar),
    perKmSeat: String(t.perKmSeat),
    frontSeatSurcharge: String(t.frontSeatSurcharge),
    fuelAdjustmentPct: String(t.fuelAdjustmentPct),
    commissionPct: String(t.commissionPct),
  };
}
const EMPTY_FORM: FormState = { name: "", baseFare: "15000", perKmCar: "850", perKmSeat: "230", frontSeatSurcharge: "15000", fuelAdjustmentPct: "0", commissionPct: "10" };

export function TariffsScreen() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [active, setActive] = useState<Tariff[] | null>(null);
  const [archived, setArchived] = useState<Tariff[]>([]);
  const [proposals, setProposals] = useState<TariffProposal[]>([]);
  const [error, setError] = useState(false);
  const [drawer, setDrawer] = useState<"create" | Tariff | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState<Tariff | null>(null);
  const [acting, setActing] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setError(false);
    try {
      const [a, ar, p] = await Promise.all([
        api.getTariffs({ search: debouncedSearch, status: "active" }),
        api.getTariffs({ search: debouncedSearch, status: "archived" }),
        api.getTariffProposals({ status: "pending_second" }),
      ]);
      setActive(a);
      setArchived(ar);
      setProposals(p);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setDrawer("create");
  }
  function openEdit(t: Tariff) {
    setForm(tariffToForm(t));
    setDrawer(t);
  }

  async function handleSave() {
    const patch = {
      name: form.name.trim(),
      baseFare: Number(form.baseFare),
      perKmCar: Number(form.perKmCar),
      perKmSeat: Number(form.perKmSeat),
      frontSeatSurcharge: Number(form.frontSeatSurcharge),
      fuelAdjustmentPct: Number(form.fuelAdjustmentPct),
      commissionPct: Number(form.commissionPct),
    };
    setSaving(true);
    try {
      if (drawer === "create") await api.proposeTariffCreate(patch);
      else if (drawer) await api.proposeTariffEdit(drawer.id, patch);
      setDrawer(null);
      setToast("Taklif ikkinchi adminga yuborildi");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!archiving) return;
    setActing(true);
    try {
      await api.proposeTariffArchive(archiving.id);
      setArchiving(null);
      setToast("Arxivlash taklifi yuborildi");
      await load();
    } finally {
      setActing(false);
    }
  }

  async function handleApprove(proposalId: string) {
    setActing(true);
    try {
      const review = await api.approveTariffProposal(proposalId);
      setReviewId(review.id);
    } finally {
      setActing(false);
    }
  }

  async function handleReject(proposalId: string) {
    setActing(true);
    try {
      await api.rejectTariffProposal(proposalId);
      await load();
    } finally {
      setActing(false);
    }
  }

  if (error) return <ErrorState onRetry={load} />;
  if (!active) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (reviewId) {
    return (
      <Card>
        <ReviewStatus
          reviewId={reviewId}
          title="Ikkinchi adminga yuborildi"
          description="Tarif o'zgarishi ikkinchi admin tomonidan tasdiqlanmoqda."
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
    );
  }

  return (
    <div className="space-y-6">
      {proposals.length > 0 && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Tasdiqlashni kutayotgan o'zgarishlar</p>
          {proposals.map((p) => (
            <div key={p.id} className="rounded-card border border-warning/20 bg-warning/[0.04] p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge tone="pending">
                  {p.type === "create" ? "Yangi tarif" : p.type === "archive" ? "Arxivlash" : "O'zgarish"}
                </Badge>
                <span className="text-xs text-ink/50">{p.proposedByName}</span>
              </div>
              {p.type !== "archive" && (
                <ul className="mb-3 space-y-1 text-sm text-ink/70">
                  {Object.entries(p.patch).map(([k, v]) => (
                    <li key={k}>
                      {FIELD_LABEL[k as keyof typeof FIELD_LABEL] ?? k}:{" "}
                      <span className="tabular font-semibold text-ink">
                        {(NUMERIC_FIELDS as string[]).includes(k) ? formatTariffValue(k as (typeof NUMERIC_FIELDS)[number], Number(v)) : String(v)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Button size="sm" loading={acting} onClick={() => handleApprove(p.id)}>
                  <Check className="h-4 w-4" /> Tasdiqlash
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleReject(p.id)}>
                  <X className="h-4 w-4" /> Rad etish
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Tarif nomi..." resultCount={active.length + archived.length} hasActiveFilters={false} onClear={() => {}} />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Yangi tarif
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {active.map((t) => (
          <Card key={t.id} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink">{t.name}</h2>
                <Badge tone="success">Faol</Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>
                  Tahrirlash
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setArchiving(t)} aria-label={`${t.name} tarifini arxivlash`} title="Arxivlash">
                  <Archive className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <dl className="divide-y divide-border text-sm">
              {NUMERIC_FIELDS.map((k) => (
                <div key={k} className="flex h-10 items-center justify-between gap-4">
                  <dt className="text-ink/60">{FIELD_LABEL[k]}</dt>
                  <dd className="tabular font-semibold text-ink">{formatTariffValue(k, t[k])}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
        {active.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyState icon={<SlidersHorizontal />} title="Faol tarif topilmadi" description="Qidiruvni o'zgartiring yoki yangi tarif qo'shing." />
          </div>
        )}
      </div>

      {archived.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-ink/60">Arxivlangan tariflar</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {archived.map((t) => (
              <Card key={t.id} className="space-y-2 bg-ink/[0.02] shadow-none">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink/60">{t.name}</p>
                  <Badge tone="neutral">Arxivlangan</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <FormDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer === "create" ? "Yangi tarif" : "Tarifni tahrirlash"}
        onSubmit={handleSave}
        submitLabel="Taklif qilish"
        loading={saving}
        disabled={!form.name.trim()}
      >
        <Input label="Nomi" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
        {NUMERIC_FIELDS.map((key) => (
          <Input
            key={key}
            label={FIELD_LABEL[key]}
            type="number"
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        ))}
        <p className="text-xs text-ink/50">O'zgarish kuchga kirishi uchun ikkinchi admin tasdiqlashi kerak.</p>
      </FormDrawer>

      <ConfirmDialog
        open={archiving !== null}
        title="Tarifni arxivlash"
        description={`"${archiving?.name ?? ""}" arxivlash taklifi ikkinchi adminga yuboriladi.`}
        confirmLabel="Taklif qilish"
        loading={acting}
        onConfirm={handleArchive}
        onCancel={() => setArchiving(null)}
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
