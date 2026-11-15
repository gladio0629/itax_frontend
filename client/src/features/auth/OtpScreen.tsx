import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "@/lib/icons";
import { Button } from "@/components/Button";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ScreenHeader } from "@/components/ScreenHeader";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { serverErrorKey } from "@/lib/apiError";
import { useLiftFloatingControl } from "@/stores/floatingControlStore";
import { cn } from "@/lib/cn";

/** `testCode` comes only from the sample-data adapter; a real backend sends the code by SMS. */
type LocationState = { requestId: string; testCode?: string; resendAfterSec?: number; phone: string };

const DEFAULT_RESEND_SEC = 30;
// SMS code length: fixed 4 with sample data; 4–6 with the real backend (the
// confirm button works from `min`, typing all `max` digits submits at once).
const { min: CODE_MIN, max: CODE_MAX } = api.otpLength;
const emptyCode = () => Array<string>(CODE_MAX).fill("");
const toDigits = (code: string) => [...code.slice(0, CODE_MAX).split(""), ...emptyCode()].slice(0, CODE_MAX);

export function OtpScreen() {
  const footerRef = useRef<HTMLDivElement>(null);
  useLiftFloatingControl(footerRef);
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const completeAuth = useAuthStore((s) => s.completeAuth);
  const state = (location.state as LocationState) ?? null;

  const [digits, setDigits] = useState<string[]>(emptyCode);
  const [phase, setPhase] = useState<"enter" | "review">("enter");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seconds, setSeconds] = useState(state?.resendAfterSec ?? DEFAULT_RESEND_SEC);
  // A resend issues a new request id (the code it sends replaces the old one).
  const [requestId, setRequestId] = useState(state?.requestId ?? "");
  const [resending, setResending] = useState(false);
  const inputsRef = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    if (!state) {
      navigate("/auth/phone", { replace: true });
      return;
    }
    const code = state.testCode;
    if (!code) return;
    const t = setTimeout(() => {
      setDigits(toDigits(code));
    }, 900);
    return () => clearTimeout(t);
  }, [state, navigate]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  if (!state) return null;

  async function handleVerify(code: string) {
    setSubmitting(true);
    setError(null);
    try {
      const review = await api.verifyOtp(requestId, code);
      setReviewId(review.id);
      setPhase("review");
    } catch (e) {
      const key = serverErrorKey(e);
      setError(key ? t(key as TranslationKey) : t("auth.otpError"));
      setDigits(emptyCode());
      inputsRef.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (!state || resending) return;
    setResending(true);
    setError(null);
    try {
      const res = await api.requestOtp(state.phone);
      setRequestId(res.requestId);
      setSeconds(res.resendAfterSec ?? DEFAULT_RESEND_SEC);
      if (res.testCode) setDigits(toDigits(res.testCode));
    } catch (e) {
      const key = serverErrorKey(e);
      setError(key ? t(key as TranslationKey) : t("auth.otpSendError"));
    } finally {
      setResending(false);
    }
  }

  function onDigitChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < CODE_MAX - 1) inputsRef.current[i + 1]?.focus();
    if (next.every((d) => d)) handleVerify(next.join(""));
  }

  const entered = digits.join("");
  // Valid when the filled boxes are an unbroken prefix of at least CODE_MIN digits.
  const firstEmpty = digits.indexOf("");
  const codeReady = entered.length >= CODE_MIN && (firstEmpty === -1 || entered.length === firstEmpty);

  if (phase === "review" && reviewId) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title={t("auth.confirmTitle")} />
        <div className="flex flex-1 items-center justify-center">
          <ReviewStatus
            reviewId={reviewId}
            onApproved={() => {
              completeAuth();
              navigate("/home", { replace: true });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg px-6" style={{ paddingTop: "calc(var(--safe-top) + 48px)" }}>
      <div className="flex-1">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl bg-accent-10 text-accent">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-ink">{t("auth.enterCodeTitle")}</h1>
        <p className="mb-8 text-sm text-ink/60">{t("auth.enterCodeDesc", { phone: state.phone })}</p>

        <div className={CODE_MAX > 4 ? "flex gap-2" : "flex gap-3"}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                if (el) inputsRef.current[i] = el;
              }}
              value={d}
              onChange={(e) => onDigitChange(i, e.target.value)}
              name={`code-${i}`}
              aria-label={t("auth.codeDigit", { n: i + 1 })}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              spellCheck={false}
              inputMode="numeric"
              maxLength={1}
              className={cn(
                CODE_MAX > 4 ? "h-14 w-11" : "h-14 w-14",
                "rounded-xl border bg-card text-center text-lg font-semibold tabular text-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                error ? "border-danger" : "border-border focus:border-accent"
              )}
            />
          ))}
        </div>
        {error && <p className="mt-3 text-xs font-normal text-danger">{error}</p>}

        <button
          disabled={seconds > 0 || resending}
          onClick={resend}
          className="mt-6 text-sm font-semibold text-accent disabled:text-ink/40"
        >
          {seconds > 0 ? (
            <span className="tabular">{t("auth.resendIn", { seconds })}</span>
          ) : (
            t("auth.resend")
          )}
        </button>
      </div>

      <div ref={footerRef} style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
        <Button
          fullWidth
          loading={submitting}
          disabled={!codeReady}
          onClick={() => handleVerify(entered)}
        >
          {t("common.confirm")}
        </Button>
      </div>
    </div>
  );
}
