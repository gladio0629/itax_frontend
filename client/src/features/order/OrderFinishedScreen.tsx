import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PartyPopper, Star, MapPin } from "lucide-react";
import { api } from "@/api/client";
import type { OrderWithDetails, RouteSuggestion } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SkeletonList } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { formatSom, formatKm } from "@/lib/format";
import { useOrderStore } from "@/stores/orderStore";
import { RatingReasonsSheet } from "@/features/history/RatingReasonsSheet";

export function OrderFinishedScreen() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const resetDraft = useOrderStore((s) => s.reset);
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [suggestion, setSuggestion] = useState<RouteSuggestion | null>(null);
  const [error, setError] = useState(false);
  const [ratingError, setRatingError] = useState(false);
  const [pendingFive, setPendingFive] = useState(false);

  function load() {
    setError(false);
    api.getOrder(orderId).then(setOrder).catch(() => setError(true));
    api.getPopularRoutes().then((routes) => setSuggestion(routes[0] ?? null)).catch(() => {});
  }

  useEffect(load, [orderId]);

  async function submitRating(value: number, reasons?: string[], note?: string) {
    setRating(value);
    setRatingError(false);
    try {
      await api.rateOrder(orderId, value, reasons, note);
      setSubmitted(true);
    } catch {
      setRatingError(true);
    }
  }

  function onStarClick(value: number) {
    if (value === 5) setPendingFive(true);
    else submitRating(value);
  }

  if (error) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ErrorState onRetry={load} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col bg-bg px-4 pt-16">
        <SkeletonList count={2} />
      </div>
    );
  }

  return (
    <div className="relative h-full bg-bg">
      <div className="h-full overflow-y-auto px-5" style={{ paddingTop: "calc(var(--safe-top) + 32px)" }}>
      <div className="flex flex-col items-center gap-3 pb-6 text-center animate-scale-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-bg animate-check-pop">
          <PartyPopper className="h-9 w-9" />
        </div>
        <h1 className="text-xl font-semibold text-ink">Safar yakunlandi!</h1>
        <p className="max-w-[260px] text-sm text-ink/60">
          Manzilga xavfsiz yetib oldingiz. IZGO bilan sayohatingiz uchun rahmat.
        </p>
      </div>

      <Card className="mb-4 p-5">
        <p className="mb-3 text-center text-sm font-semibold text-ink">Haydovchini baholang</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button key={v} onClick={() => onStarClick(v)} aria-label={`${v} yulduz`} className="p-1">
              <Star className={`h-8 w-8 transition-colors ${v <= rating ? "fill-warning text-warning" : "text-ink/20"}`} />
            </button>
          ))}
        </div>
        {submitted && <p className="mt-3 text-center text-xs font-medium text-accent">Rahmat! Bahoyingiz qabul qilindi.</p>}
        {ratingError && <p className="mt-3 text-center text-xs font-medium text-danger">Baho yuborilmadi. Qaytadan urining.</p>}
      </Card>

      <Card className="mb-4 space-y-3 p-5">
        <p className="text-xs font-semibold text-ink/60">CHEK</p>
        <Row label="Yo'nalish" value={`${order.fromCity.name} \u2192 ${order.toCity.name}`} />
        <Row label="Masofa" value={formatKm(order.distanceKm)} />
        <Row label="To'lov usuli" value={order.paymentMethod === "cash" ? "Naqd pul" : "Karta"} />
        <div className="h-px bg-border" />
        <Row label="Jami to'landi" value={formatSom(order.price)} bold />
      </Card>

      {suggestion && (
        <button
          onClick={() => navigate("/home")}
          className="mb-6 flex items-center justify-between rounded-2xl bg-accent-5 px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-accent">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-ink/60">Keyingi safar uchun taklif</p>
              <p className="text-sm font-semibold text-ink">{suggestion.label}</p>
            </div>
          </div>
          <span className="text-xs font-semibold tabular text-accent">dan {formatSom(suggestion.fromPrice)}</span>
        </button>
      )}

      <div className="pb-8">
        <Button
          fullWidth
          onClick={() => {
            resetDraft();
            navigate("/home");
          }}
        >
          Bosh sahifaga qaytish
        </Button>
      </div>
      </div>

      {pendingFive && (
        <RatingReasonsSheet
          onClose={() => setPendingFive(false)}
          onSubmit={(reasons, note) => {
            setPendingFive(false);
            submitRating(5, reasons, note);
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink/60">{label}</span>
      <span className={`text-sm tabular ${bold ? "font-semibold text-ink" : "text-ink/80"}`}>{value}</span>
    </div>
  );
}
