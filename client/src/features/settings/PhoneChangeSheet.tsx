import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ReviewStatus } from "@/components/ReviewStatus";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return parts.filter(Boolean).join(" ");
}

export function PhoneChangeSheet({ onClose, onDone }: { onClose: () => void; onDone: (phone: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = value.replace(/\D/g, "").length === 9;
  const fullPhone = `+998 ${value}`;

  async function requestCode() {
    if (!isValid) return;
    setLoading(true);
    try {
      const res = await api.requestPhoneChange(fullPhone);
      setRequestId(res.requestId);
      setDemoCode(res.demoCode);
      setTimeout(() => setDigits(res.demoCode.split("")), 600);
    } finally {
      setLoading(false);
    }
  }

  async function verify(code: string) {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    try {
      const review = await api.confirmPhoneChange(requestId, code, fullPhone);
      setReviewId(review.id);
    } catch {
      setError(t("account.otpError"));
      setDigits(["", "", "", ""]);
    } finally {
      setLoading(false);
    }
  }

  function onDigitChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (next.every((d) => d) && next.join("").length === 4) verify(next.join(""));
  }

  return (
    <Sheet open onClose={onClose} ariaLabel={t("account.changePhone")}>
      <div className="px-5 pb-6 pt-3">
        {reviewId ? (
          <ReviewStatus reviewId={reviewId} onApproved={() => onDone(fullPhone)} />
        ) : requestId ? (
          <>
            <h2 className="mb-4 text-sm font-semibold text-ink">{t("account.enterCode")}</h2>
            <div className="flex gap-3">
              {digits.map((d, i) => (
                <input
                  key={i}
                  value={d}
                  onChange={(e) => onDigitChange(i, e.target.value)}
                  name={`code-${i}`}
                  aria-label={t("auth.codeDigit", { n: i + 1 })}
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  spellCheck={false}
                  inputMode="numeric"
                  maxLength={1}
                  className={cn(
                    "h-14 w-14 rounded-xl border bg-card text-center text-lg font-semibold tabular text-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                    error ? "border-danger" : "border-border focus:border-accent"
                  )}
                />
              ))}
            </div>
            {error && <p className="mt-3 text-xs font-normal text-danger">{error}</p>}
            <p className="mt-3 text-xs text-ink/60">{t("account.demoCodeHint", { code: demoCode })}</p>
          </>
        ) : (
          <>
            <h2 className="mb-4 text-sm font-semibold text-ink">{t("account.changePhone")}</h2>
            <Input
              label={t("account.newPhone")}
              type="tel"
              name="phone"
              autoComplete="tel-national"
              inputMode="numeric"
              autoFocus
              placeholder="90 123 45 67"
              value={value}
              onChange={(e) => setValue(formatPhoneInput(e.target.value))}
              leftIcon={<span className="text-sm font-normal text-ink/80">+998</span>}
            />
            <div className="mt-5">
              <Button fullWidth disabled={!isValid} loading={loading} onClick={requestCode}>
                {t("common.confirm")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
