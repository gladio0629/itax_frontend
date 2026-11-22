import { useRef, useState } from "react";
import { api } from "@/api/client";
import { ReviewStatus } from "@/components/ReviewStatus";
import { useT } from "@/lib/i18n/provider";
import { formatPhoneInput } from "@/lib/phone";
import { serverErrorKey } from "@/lib/apiError";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { BottomSheet, Field, PrimaryButton } from "@/ui";

/**
 * Change the phone number: the new number, the SMS code, then the review.
 * (The sample data hands back the code and fills it in.)
 */
export function PhoneChangeSheet({ onClose, onDone }: { onClose: () => void; onDone: (phone: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [testCode, setTestCode] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const isValid = value.replace(/\D/g, "").length === 9;
  const fullPhone = `+998 ${value}`;

  async function requestCode() {
    if (!isValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.requestPhoneChange(fullPhone);
      setRequestId(res.requestId);
      if (res.testCode) {
        setTestCode(res.testCode);
        const code = res.testCode;
        window.setTimeout(() => {
          setDigits(code.split(""));
          verify(code, res.requestId);
        }, 600);
      } else window.setTimeout(() => boxes.current[0]?.focus(), 0);
    } catch (e) {
      setError(t((serverErrorKey(e) ?? "common.errorMessage") as TranslationKey));
    } finally {
      setLoading(false);
    }
  }

  async function verify(code: string, id = requestId) {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const review = await api.confirmPhoneChange(id, code, fullPhone);
      setReviewId(review.id);
    } catch {
      setError(t("account.otpError"));
      setDigits(["", "", "", ""]);
      boxes.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  function onDigit(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    setError(null);
    if (v && i < 3) boxes.current[i + 1]?.focus();
    if (next.every((d) => d)) verify(next.join(""));
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={requestId && !reviewId ? t("account.enterCode") : t("account.changePhone")}
      closeLabel={t("common.close")}
      footer={
        !requestId ? (
          <PrimaryButton disabled={!isValid} loading={loading} onClick={requestCode}>
            {t("common.confirm")}
          </PrimaryButton>
        ) : undefined
      }
    >
      {reviewId ? (
        <ReviewStatus reviewId={reviewId} onApproved={() => onDone(fullPhone)} />
      ) : requestId ? (
        <>
          <p className="text-[14px] text-iz-muted">{fullPhone}</p>
          <div className="flex gap-3" role="group" aria-label={t("account.enterCode")}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (boxes.current[i] = el)}
                value={d}
                onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus();
                }}
                name={`code-${i}`}
                aria-label={t("auth.codeDigit", { n: i + 1 })}
                autoComplete={i === 0 ? "one-time-code" : "off"}
                inputMode="numeric"
                maxLength={1}
                disabled={loading}
                className={cn(
                  "iz-input h-16 w-14 rounded-iz-field border-2 bg-iz-field text-center text-[24px] font-extrabold tabular-nums text-iz-ink outline-none focus:border-iz-ink focus:bg-iz-field-focus focus:shadow-[0_0_0_4px_var(--iz-focus-ring)]",
                  error ? "border-iz-danger" : "border-transparent"
                )}
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-iz-danger">
              {error}
            </p>
          )}
          {testCode && <p className="text-[12px] text-iz-muted">{t("account.testCodeHint", { code: testCode })}</p>}
        </>
      ) : (
        <Field
          label={t("account.newPhone")}
          icon="phone"
          type="tel"
          name="phone"
          autoComplete="tel-national"
          inputMode="numeric"
          autoFocus
          placeholder="90 123 45 67"
          value={value}
          onChange={(e) => {
            setValue(formatPhoneInput(e.target.value));
            setError(null);
          }}
          prefix="+998"
          error={error ?? undefined}
        />
      )}
    </BottomSheet>
  );
}
