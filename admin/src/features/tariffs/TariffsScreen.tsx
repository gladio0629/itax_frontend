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
import type { Tariff, TariffCarClass, TariffNumericField, TariffProposal } from "@/api/types";

const caps = api.capabilities;

const FIELD_LABEL: Record<TariffNumericField | "name" | "carClass", string> = {
  name: "Nomi",
  carClass: "Mashina klassi",
  baseFare: "Bazaviy narx",
  perKmCar: caps.tariffFields.includes("perKmSeat") ? "Km narxi (avtomobil)" : "Km narxi",
  perKmSeat: "Km narxi (o'rindiq)",
  frontSeatSurcharge: "Old o'rindiq ustamasi",
  fuelAdjustmentPct: "Yoqilg'i ustamasi (%)",
  commissionPct: "Komissiya (%)",
  perMin: "Daqiqa narxi",
  minFare: "Minimal narx",
};
const CAR_CLASS_LABEL: Record<TariffCarClass, string> = {
  economy: "Ekonom",
  comfort: "Komfort",
  business: "Biznes",
  minivan: "Miniven",
};
/** The fields this backend knows, in display order (mock: the sample set;
 * real API: base fare, per km, per minute, minimum, commission). */
const NUMERIC_FIELDS = caps.tariffFields;
function formatTariffValue(k: TariffNumericField, v: number | undefined): string {
  const n = v ?? 0;
  return k === "fuelAdjustmentPct" || k === "commissionPct" ? `${n}%` : formatSom(n);
}

type FormState = Record<TariffNumericField, string> & { name: string; carClass: TariffCarClass | "" };
function tariffToForm(t: Tariff): FormState {
  return {
    name: t.name,
    carClass: t.carClass ?? "",
    baseFare: String(t.baseFare),
    perKmCar: String(t.perKmCar),
    perKmSeat: String(t.perKmSeat),
    frontSeatSurcharge: String(t.frontSeatSurcharge),
    fuelAdjustmentPct: String(t.fuelAdjustmentPct),
    commissionPct: String(t.commissionPct),
    perMin: String(t.perMin ?? 0),
    minFare: String(t.minFare ?? 0),
  };
}
const EMPTY_FORM: FormState = {
  name: "",
  carClass: "",
  baseFare: "15000",
  perKmCar: "850",
  perKmSeat: "230",
  frontSeatSurcharge: "15000",
  fuelAdjustmentPct: "0",
  commissionPct: "10",
  perMin: "0",
  minFare: "0",
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");

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
  const [formError, setFormError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Tariff | null>(null);
  const [rejecting, setRejecting] = useState<TariffProposal | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
    setFormError(null);
    setDrawer("create");
  }
  function openEdit(t: Tariff) {
    setForm(tariffToForm(t));
    setFormError(null);
    setDrawer(t);
  }

  async function handleSave() {
    // Only the fields this backend knows are sent.
    const patch: Partial<Tariff> = { name: form.name.trim() };
    for (const k of NUMERIC_FIELDS) patch[k] = Number(form[k]);
    if (caps.tariffCarClass && form.carClass) patch.carClass = form.carClass;
    setSaving(true);
    setFormError(null);
    try {
      if (drawer === "create") await api.proposeTariffCreate({ ...tariffToCreate(), ...patch } as Omit<Tariff, "id" | "archived">);
      else if (drawer) await api.proposeTariffEdit(drawer.id, patch);
      setDrawer(null);
      setToast("Taklif ikkinchi adminga yuborildi");
      await load();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  /** Defaults for the fields a create form doesn't show (mock-only fields). */
  function tariffToCreate(): Omit<Tariff, "id" | "archived"> {
    return {
      name: "",
      baseFare: Number(EMPTY_FORM.baseFare),
      perKmCar: Number(EMPTY_FORM.perKmCar),
      perKmSeat: Number(EMPTY_FORM.perKmSeat),
      frontSeatSurcharge: Number(EMPTY_FORM.frontSeatSurcharge),
      fuelAdjustmentPct: Number(EMPTY_FORM.fuelAdjustmentPct),
      commissionPct: Number(EMPTY_FORM.commissionPct),
    };
  }

  async function handleArchive() {
    if (!archiving) return;
    setActing(true);
    setActionError(null);
    try {
      await api.proposeTariffArchive(archiving.id);
      setArchiving(null);
      setToast("Arxivlash taklifi yuborildi");
      await load();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setActing(false);
    }
  }

  async function handleApprove(proposalId: string) {
    setActing(true);
    setActionError(null);
    try {
      const review = await api.approveTariffProposal(proposalId);
      setReviewId(review.id);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setActing(false);
    }
  }

  async function handleReject(reason?: string) {
    if (!rejecting) return;
    setActing(true);
    setActionError(null);
    try {
      await api.rejectTariffProposal(rejecting.id, reason);
      setRejecting(null);
      await load();
    } catch (e) {
      setActionError(errorText(e));
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
      {actionError && !archiving && !rejecting && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {actionError}
        </p>
      )}

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
              {p.type !== "archive" &&
                (caps.tariffProposalValues ? (
                  <ul className="mb-3 space-y-1 text-sm text-ink/70">
                    {Object.entries(p.patch).map(([k, v]) => (
                      <li key={k}>
                        {FIELD_LABEL[k as keyof typeof FIELD_LABEL] ?? k}:{" "}
                        <span className="tabular font-semibold text-ink">
                          {(NUMERIC_FIELDS as readonly string[]).includes(k) ? formatTariffValue(k as TariffNumericField, Number(v)) : String(v)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  // The real API doesn't return the proposed values yet (gap).
                  <p className="mb-3 text-sm text-ink/70">
                    <span className="font-semibold text-ink">{p.patch.name}</span> — yangi qiymatlar server javobida ko'rsatilmaydi.
                  </p>
                ))}
              {p.type === "archive" && <p className="mb-3 text-sm font-semibold text-ink">{p.patch.name}</p>}
              <div className="flex gap-2">
                <Button size="sm" loading={acting} onClick={() => handleApprove(p.id)}>
                  <Check className="h-4 w-4" /> Tasdiqlash
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setActionError(null);
                    setRejecting(p);
                  }}
                >
                  <X className="h-4 w-4" /> Rad etish
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tarif nomi…"
          searchEnabled={caps.tariffSearch}
          resultCount={active.length + archived.length}
          hasActiveFilters={false}
          onClear={() => {}}
        />
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
                {caps.tariffCarClass && t.carClass && <Badge tone="info">{CAR_CLASS_LABEL[t.carClass]}</Badge>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>
                  Tahrirlash
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setActionError(null);
                    setArchiving(t);
                  }}
                  aria-label={`${t.name} tarifini arxivlash`}
                  title="Arxivlash"
                >
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
        error={formError}
        disabled={!form.name.trim() || (caps.tariffCarClass && !form.carClass)}
      >
        <Input label="Nomi" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
        {caps.tariffCarClass && (
          <div>
            <label htmlFor="fld-klass" className="mb-2 block text-sm font-semibold text-ink/80">
              {FIELD_LABEL.carClass}
              <span className="ml-1 text-danger" aria-hidden>
                *
              </span>
            </label>
            <select
              id="fld-klass"
              value={form.carClass}
              onChange={(e) => setForm((f) => ({ ...f, carClass: e.target.value as TariffCarClass }))}
              className="h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              <option value="" disabled>
                Tanlang…
              </option>
              {(Object.keys(CAR_CLASS_LABEL) as TariffCarClass[]).map((c) => (
                <option key={c} value={c}>
                  {CAR_CLASS_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        )}
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
        error={actionError}
        onConfirm={handleArchive}
        onCancel={() => setArchiving(null)}
      />

      <ConfirmDialog
        open={rejecting !== null}
        title="O'zgarishni rad etish"
        description={`"${rejecting?.patch.name ?? ""}" bo'yicha taklif rad etiladi.`}
        confirmLabel="Rad etish"
        reasonLabel="Rad etish sababi (kamida 3 ta belgi)…"
        reasonMinLength={3}
        loading={acting}
        error={actionError}
        onConfirm={handleReject}
        onCancel={() => setRejecting(null)}
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
