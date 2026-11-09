import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ReviewStatus } from "@/components/ReviewStatus";
import { api } from "@/api/client";
import { formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";

const QUICK_AMOUNTS = [100_000, 300_000, 500_000, 1_000_000];

export function WalletTopupScreen() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number | null>(300_000);
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const effectiveAmount = custom ? Number(custom.replace(/\D/g, "")) : amount ?? 0;

  async function submit() {
    if (!effectiveAmount || effectiveAmount <= 0) {
      setError("Summani kiriting");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const review = await api.requestWalletTopup(effectiveAmount);
      setReviewId(review.id);
    } catch {
      setError("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setSubmitting(false);
    }
  }

  if (reviewId) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title="To'ldirish" showBack={false} />
        <div className="flex flex-1 items-center justify-center">
          <ReviewStatus
            reviewId={reviewId}
            title="To'lov tekshirilmoqda"
            description="Hamyon balansini yangilaymiz. Bir necha soniya kuting."
            onApproved={() => navigate("/wallet", { replace: true })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title="Hamyonni to'ldirish" />
      <div className="flex-1 px-6 pt-2">
        <p className="mb-4 text-sm text-ink/60">Summani tanlang yoki qo'lda kiriting.</p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          {QUICK_AMOUNTS.map((v) => (
            <button
              key={v}
              onClick={() => {
                setAmount(v);
                setCustom("");
              }}
              className={cn(
                "rounded-xl border px-4 py-3.5 text-sm font-semibold transition-colors",
                !custom && amount === v ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/80"
              )}
            >
              {formatSom(v)}
            </button>
          ))}
        </div>
        <Input
          label="Boshqa summa"
          inputMode="numeric"
          placeholder="Masalan: 250 000"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value.replace(/\D/g, ""));
            setAmount(null);
          }}
          error={error ?? undefined}
        />
      </div>
      <div className="px-6" style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
        <Button fullWidth loading={submitting} onClick={submit}>
          {effectiveAmount > 0 ? `${formatSom(effectiveAmount)} to'ldirish` : "To'ldirish"}
        </Button>
      </div>
    </div>
  );
}
