import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";
import { api } from "@/api/client";
import type { Tariff, TariffProposal } from "@/api/types";

const FIELD_LABEL: Partial<Record<keyof Tariff, string>> = {
  baseFare: "Bazaviy narx",
  perKmCar: "Km narxi (avtomobil)",
  perKmSeat: "Km narxi (o'rindiq)",
  frontSeatSurcharge: "Old o'rindiq ustamasi",
  fuelAdjustmentPct: "Yoqilg'i ustamasi (%)",
  commissionPct: "Komissiya (%)",
};
const EDITABLE_FIELDS = Object.keys(FIELD_LABEL) as (keyof Tariff)[];

export function TariffsScreen() {
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [proposals, setProposals] = useState<TariffProposal[]>([]);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState<Partial<Tariff>>({});
  const [proposing, setProposing] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setError(false);
    try {
      const [t, p] = await Promise.all([api.getTariffs(), api.getTariffProposals()]);
      setTariff(t[0]);
      setDraft({});
      setProposals(p);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handlePropose() {
    if (Object.keys(draft).length === 0) return;
    setProposing(true);
    try {
      await api.proposeTariffChange(draft);
      await load();
    } finally {
      setProposing(false);
    }
  }

  async function handleApprove(proposalId: string) {
    setActingId(proposalId);
    try {
      const review = await api.approveTariffChange(proposalId);
      setReviewId(review.id);
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(proposalId: string) {
    setActingId(proposalId);
    try {
      await api.rejectTariffChange(proposalId);
      await load();
    } finally {
      setActingId(null);
    }
  }

  if (error) return <ErrorState onRetry={load} />;
  if (!tariff) {
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

  return (
    <div className="grid grid-cols-2 gap-6">
      <Card className="space-y-4">
        <p className="text-sm font-semibold text-ink">Joriy tarif — {tariff.name}</p>
        <div className="space-y-3">
          {EDITABLE_FIELDS.map((key) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink/70">{FIELD_LABEL[key]}</span>
              <div className="w-32">
                <Input
                  value={draft[key] !== undefined ? String(draft[key]) : String(tariff[key])}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                />
              </div>
            </div>
          ))}
        </div>
        <Button fullWidth loading={proposing} disabled={Object.keys(draft).length === 0} onClick={handlePropose}>
          O'zgarishni taklif qilish
        </Button>
        <p className="text-xs text-ink/50">Tarif o'zgarishi kuchga kirishi uchun ikkinchi admin tasdiqlashi kerak.</p>
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-semibold text-ink">Tasdiqlashni kutayotgan o'zgarishlar</p>
        {pending.length === 0 ? (
          <p className="text-sm text-ink/50">Hozircha so'rovlar yo'q.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="rounded-2xl bg-ink/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone="warning">Ikkinchi adminga yuborildi</Badge>
                  <span className="text-xs text-ink/50">{p.proposedByName}</span>
                </div>
                <ul className="mb-3 space-y-1 text-sm text-ink/70">
                  {Object.entries(p.patch).map(([k, v]) => (
                    <li key={k}>
                      {FIELD_LABEL[k as keyof Tariff] ?? k}: <span className="font-medium text-ink">{String(v)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button size="sm" loading={actingId === p.id} onClick={() => handleApprove(p.id)}>
                    <Check className="h-3.5 w-3.5" /> Tasdiqlash
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleReject(p.id)}>
                    <X className="h-3.5 w-3.5" /> Rad etish
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
