import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, CreditCard, Tag, Gift, Car as CarIcon, Armchair } from "lucide-react";
import { api, FEATURE_BONUS } from "@/api/client";
import type { City, Quote } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BottomBar } from "@/components/BottomBar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { useOrderStore } from "@/stores/orderStore";
import { formatSom, formatKm } from "@/lib/format";
import { cn } from "@/lib/cn";
import { SeatMap } from "./SeatMap";

const TIME_OPTIONS = Array.from({ length: 17 }, (_, i) => {
  const h = 6 + i;
  return `${String(h).padStart(2, "0")}:00`;
});

export function OrderConfigureScreen() {
  const navigate = useNavigate();
  const { draft, setField } = useOrderStore();
  const [cities, setCities] = useState<City[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoResult, setPromoResult] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    api.getCities().then(setCities).catch(() => {});
  }, []);

  function loadQuote() {
    if (!draft.fromCityId || !draft.toCityId) return;
    setQuoteLoading(true);
    setQuoteError(false);
    api
      .getQuote({ fromCityId: draft.fromCityId, toCityId: draft.toCityId, mode: draft.mode, seatIds: draft.seatIds })
      .then((q) => setQuote(q))
      .catch(() => {
        setQuote(null);
        setQuoteError(true);
      })
      .finally(() => setQuoteLoading(false));
  }

  useEffect(loadQuote, [draft.fromCityId, draft.toCityId, draft.mode, draft.seatIds]);

  function cityName(id: string) {
    return cities.find((c) => c.id === id)?.name ?? "\u2026";
  }

  function toggleSeat(seatId: string) {
    const has = draft.seatIds.includes(seatId);
    setField("seatIds", has ? draft.seatIds.filter((s) => s !== seatId) : [...draft.seatIds, seatId]);
  }

  async function applyPromo() {
    if (!draft.promoCode) return;
    setPromoChecking(true);
    try {
      const res = await api.applyPromoCode(draft.promoCode);
      setPromoResult(res.message);
    } finally {
      setPromoChecking(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(false);
    try {
      const order = await api.createOrder({
        fromCityId: draft.fromCityId,
        toCityId: draft.toCityId,
        mode: draft.mode,
        seatIds: draft.seatIds,
        paymentMethod: draft.paymentMethod,
        timeMode: draft.timeMode,
        timeRange: draft.timeRange,
        promoCode: draft.promoCode || undefined,
      });
      navigate(`/order/track/${order.id}`);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = (draft.mode === "car" || draft.seatIds.length > 0) && !!quote && !quoteError;

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title="Buyurtma" />
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <Card className="mb-4 flex items-center justify-between p-4">
          <div>
            <p className="text-[11px] text-ink/60">Yo'nalish</p>
            <p className="text-sm font-semibold text-ink">
              {cityName(draft.fromCityId)} &rarr; {cityName(draft.toCityId)}
            </p>
          </div>
          {quote && <p className="text-xs font-semibold text-ink/60 tabular">{formatKm(quote.distanceKm)}</p>}
        </Card>

        <p className="mb-2 text-sm font-semibold text-ink">Joylashuv turi</p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => setField("mode", "car")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 text-sm font-semibold transition-colors",
              draft.mode === "car" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
            )}
          >
            <CarIcon className="h-4 w-4" /> Butun mashina
          </button>
          <button
            onClick={() => setField("mode", "seat")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 text-sm font-semibold transition-colors",
              draft.mode === "seat" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
            )}
          >
            <Armchair className="h-4 w-4" /> Bir joy
          </button>
        </div>

        {draft.mode === "seat" && (
          <div className="mb-5">
            <SeatMap selected={draft.seatIds} onToggle={toggleSeat} />
          </div>
        )}

        <p className="mb-2 text-sm font-semibold text-ink">Jo'nash vaqti</p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setField("timeMode", "now")}
            className={cn(
              "rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
              draft.timeMode === "now" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
            )}
          >
            Hozir
          </button>
          <button
            onClick={() => setField("timeMode", "range")}
            className={cn(
              "rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
              draft.timeMode === "range" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
            )}
          >
            Vaqt oralig'i
          </button>
        </div>
        {draft.timeMode === "range" && (
          <div className="mb-5 flex items-center gap-3">
            <select
              value={draft.timeRange.from}
              onChange={(e) => setField("timeRange", { ...draft.timeRange, from: e.target.value })}
              className="h-12 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-ink tabular outline-none transition-colors focus:border-accent"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <span className="text-sm text-ink/60">dan</span>
            <select
              value={draft.timeRange.to}
              onChange={(e) => setField("timeRange", { ...draft.timeRange, to: e.target.value })}
              className="h-12 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-ink tabular outline-none transition-colors focus:border-accent"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        <p className="mb-2 text-sm font-semibold text-ink">To'lov usuli</p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => setField("paymentMethod", "cash")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 text-sm font-semibold transition-colors",
              draft.paymentMethod === "cash" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
            )}
          >
            <Banknote className="h-4 w-4" /> Naqd
          </button>
          <button
            onClick={() => setField("paymentMethod", "card")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 text-sm font-semibold transition-colors",
              draft.paymentMethod === "card" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
            )}
          >
            <CreditCard className="h-4 w-4" /> Karta
          </button>
        </div>
        {draft.paymentMethod === "card" && (
          <button
            onClick={() => navigate("/cards")}
            className="mb-5 w-full rounded-xl border border-dashed border-accent/40 py-3 text-xs font-semibold text-accent"
          >
            Kartalarni boshqarish
          </button>
        )}

        {FEATURE_BONUS && (
          <div className="mb-5">
            {!promoOpen ? (
              <button
                onClick={() => setPromoOpen(true)}
                className="flex w-full items-center justify-between rounded-xl bg-accent-5 px-4 py-3 text-sm font-semibold text-accent"
              >
                <span className="flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Promo-kod qo'shish
                </span>
                <span>+</span>
              </button>
            ) : (
              <div className="rounded-2xl bg-accent-5 p-4">
                <div className="flex gap-2">
                  <input
                    value={draft.promoCode}
                    onChange={(e) => setField("promoCode", e.target.value)}
                    placeholder="IZGO10"
                    className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm uppercase outline-none transition-colors focus:border-accent"
                  />
                  <Button size="sm" variant="secondary" loading={promoChecking} onClick={applyPromo}>
                    Qo'llash
                  </Button>
                </div>
                {promoResult && <p className="mt-2 text-xs font-medium text-accent">{promoResult}</p>}
              </div>
            )}
            <button
              onClick={() => navigate("/referral")}
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-ink/60"
            >
              <Gift className="h-4 w-4" /> Do'stlarni taklif qilib bonus oling
            </button>
          </div>
        )}
      </div>

      <BottomBar>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-ink/60">Jami narx</span>
          {quoteLoading ? (
            <Skeleton className="h-7 w-28" />
          ) : quoteError ? (
            <button onClick={loadQuote} className="text-xs font-semibold text-danger underline">
              Narxni hisoblab bo'lmadi — qayta urinish
            </button>
          ) : (
            <span className="text-xl font-semibold tabular text-ink">{formatSom(quote?.price ?? 0)}</span>
          )}
        </div>
        {submitError && <p className="mb-2 text-xs font-medium text-danger">Buyurtma yuborilmadi. Qaytadan urining.</p>}
        <Button fullWidth disabled={!canSubmit || quoteLoading} loading={submitting} onClick={submit}>
          Buyurtma berish
        </Button>
      </BottomBar>
    </div>
  );
}
