import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ShieldCheck } from "lucide-react";
import { api } from "@/api/client";
import type { SavedCard } from "@/api/types";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ScreenHeader } from "@/components/ScreenHeader";

function detectBrand(cardNumber: string): SavedCard["brand"] {
  if (cardNumber.startsWith("8600") || cardNumber.startsWith("9860")) return "uzcard";
  if (cardNumber.startsWith("9860") || cardNumber.startsWith("5614")) return "humo";
  return "visa";
}

/**
 * Imitates an external payment provider's hosted card-entry page. IZGO
 * never stores the full card number — only a label and the last 4 digits
 * are kept once the (simulated) provider tokenizes the card.
 */
export function CardLinkScreen() {
  const navigate = useNavigate();
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);

  const digits = cardNumber.replace(/\s/g, "");
  const isValid = digits.length === 16 && expiry.length === 5 && cvv.length === 3 && label.trim().length > 0;

  function formatCardNumber(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 16);
    return d.replace(/(.{4})/g, "$1 ").trim();
  }
  function formatExpiry(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(false);
    try {
      const review = await api.linkCard({
        label: label.trim(),
        last4: digits.slice(-4),
        brand: detectBrand(digits),
      });
      setReviewId(review.id);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (reviewId) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title="Karta bog'lash" showBack={false} />
        <div className="flex flex-1 items-center justify-center">
          <ReviewStatus
            reviewId={reviewId}
            title="Tekshiruvga yuborildi"
            description="Karta provayder tomonidan tekshirilmoqda."
            onApproved={() => navigate("/cards", { replace: true })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title="Karta bog'lash" />
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mb-6 flex items-center gap-2 text-ink/60">
          <Lock className="h-4 w-4" />
          <p className="text-xs">IZGO Pay &middot; xavfsiz to'lov provayderi orqali</p>
        </div>

        <div className="mb-6 h-44 w-full rounded-2xl bg-accent p-5 text-white shadow-soft">
          <p className="text-xs opacity-70">Karta raqami</p>
          <p className="mt-2 text-lg font-semibold tabular tracking-widest">
            {cardNumber || "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022"}
          </p>
          <div className="mt-6 flex justify-between text-xs opacity-80 tabular">
            <span>{expiry || "OY/YIL"}</span>
            <span>IZGO PAY</span>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl bg-card p-5 shadow-softer">
          <Input
            label="Karta raqami"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          />
          <div className="flex gap-3">
            <Input
              label="Amal qilish muddati"
              inputMode="numeric"
              placeholder="OY/YIL"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            />
            <Input
              label="CVV"
              inputMode="numeric"
              type="password"
              placeholder="•••"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </div>
          <Input
            label="Karta nomi"
            placeholder="Masalan: Ish kartam"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs text-ink/60">
          <ShieldCheck className="h-3.5 w-3.5" /> IZGO karta raqamingizni saqlamaydi, faqat oxirgi 4 raqam ko'rinadi.
        </p>
      </div>
      <div className="px-6" style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
        {submitError && <p className="mb-3 text-xs font-medium text-danger">Karta bog'lanmadi. Qaytadan urining.</p>}
        <Button fullWidth disabled={!isValid} loading={submitting} onClick={submit}>
          Kartani bog'lash
        </Button>
      </div>
    </div>
  );
}
