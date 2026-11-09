import { useEffect, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ReviewStatus } from "@/components/ReviewStatus";
import { Drawer } from "@/components/Drawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { api } from "@/api/client";
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
const NUMERIC_FIELDS = (Object.keys(FIELD_LABEL) as (keyof typeof FIELD_LABEL)[]).filter((k) => k !== "name");

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
  const [tariffs, setTariffs] = useState<Tariff[] | null>(null);
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
      const [t, p] = await Promise.all([api.getTariffs(), api.getTariffProposals()]);
      setTariffs(t);
      setProposals(p);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

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
  if (!tariffs) {
    return (
      <div className="grid grid-cols-2 gap-5">
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

  const pending = proposals.filter((p) => p.status === "pending_second");
  const active = tariffs.filter((t) => !t.archived);
  const archived = tariffs.filter((t) => t.archived);

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Tasdiqlashni kutayotgan o'zgarishlar</p>
          {pending.map((p) => (
            <div key={p.id} className="rounded-2xl bg-ink/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge tone="warning">
                  {p.type === "create" ? "Yangi tarif" : p.type === "archive" ? "Arxivlash" : "O'zgarish"}
                </Badge>
                <span className="text-xs text-ink/50">{p.proposedByName}</span>
              </div>
              {p.type !== "archive" && (
                <ul className="mb-3 space-y-1 text-sm text-ink/70">
                  {Object.entries(p.patch).map(([k, v]) => (
                    <li key={k}>
                      {FIELD_LABEL[k as keyof typeof FIELD_LABEL] ?? k}: <span className="font-medium text-ink">{String(v)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Button size="sm" loading={acting} onClick={() => handleApprove(p.id)}>
                  <Check className="h-3.5 w-3.5" /> Tasdiqlash
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleReject(p.id)}>
                  <X className="h-3.5 w-3.5" /> Rad etish
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Tariflar</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Yangi tarif
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {active.map((t) => (
          <Card key={t.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{t.name}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>
                  Tahrirlash
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setArchiving(t)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <ul className="space-y-1 text-sm text-ink/70">
              {NUMERIC_FIELDS.map((k) => (
                <li key={k} className="flex justify-between">
                  <span>{FIELD_LABEL[k]}</span>
                  <span className="font-medium text-ink tabular">{t[k]}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {active.length === 0 && <p className="text-sm text-ink/50">Faol tarif yo'q.</p>}
      </div>

      {archived.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-ink/60">Arxivlangan tariflar</p>
          <div className="grid grid-cols-2 gap-5">
            {archived.map((t) => (
              <Card key={t.id} className="space-y-2 opacity-60">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{t.name}</p>
                  <Badge tone="neutral">Arxivlangan</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer === "create" ? "Yangi tarif" : "Tarifni tahrirlash"}>
        <div className="space-y-4">
          <Input label="Nomi" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
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
          <Button fullWidth loading={saving} disabled={!form.name.trim()} onClick={handleSave}>
            Taklif qilish
          </Button>
        </div>
      </Drawer>

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
