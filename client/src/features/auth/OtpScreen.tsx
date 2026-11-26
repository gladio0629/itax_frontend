import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { rich } from "@/lib/i18n/rich";
import { serverErrorKey } from "@/lib/apiError";
import { maskPhone } from "@/lib/phone";
import { waitForReview } from "@/lib/waitForReview";
import { cn } from "@/lib/cn";
import { useLiftFloatingControl } from "@/stores/floatingControlStore";
import { Icon, IconButton, PrimaryButton, useStatusBar } from "@/ui";

/** `testCode` comes only from the sample-data adapter; a real backend sends the code by SMS. */
type LocationState = { requestId: string; testCode?: string; resendAfterSec?: number; codeLength?: number; phone: string };

const DEFAULT_RESEND_SEC = 30;
// SMS code length: the server's code_length when it sends one; otherwise the
// adapter's range (fixed 4 with sample data, 4–6 with a backend that doesn't
// say). The confirm button works from `min`; typing all `max` digits submits.
function codeLengths(fromServer?: number) {
  if (fromServer && fromServer >= 4 && fromServer <= 8) return { min: fromServer, max: fromServer };
  return api.otpLength;
}

function mmss(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

/** Login, step 2 (design: Otp / KbOtp). */
export function OtpScreen() {
  useStatusBar("light");
  const formRef = useRef<HTMLFormElement>(null);
  useLiftFloatingControl(formRef);
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const completeAuth = useAuthStore((s) => s.completeAuth);
  const state = (location.state as LocationState) ?? null;
  const [lengths, setLengths] = useState(() => codeLengths(state?.codeLength));
  const { min: CODE_MIN, max: CODE_MAX } = lengths;
  const emptyCode = () => Array<string>(CODE_MAX).fill("");
  const toDigits = (code: string) => [...code.slice(0, CODE_MAX).split(""), ...emptyCode()].slice(0, CODE_MAX);

  const [digits, setDigits] = useState<string[]>(emptyCode);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seconds, setSeconds] = useState(state?.resendAfterSec ?? DEFAULT_RESEND_SEC);
  // A resend issues a new request id (the code it sends replaces the old one).
  const [requestId, setRequestId] = useState(state?.requestId ?? "");
  const [resending, setResending] = useState(false);
  const inputsRef = useRef<HTMLInputElement[]>([]);
  const pollSignal = useRef({ cancelled: false });

  useEffect(() => {
    if (!state) {
      navigate("/auth/phone", { replace: true });
      return;
    }
    const code = state.testCode;
    if (!code) return;
    const timer = setTimeout(() => setDigits(toDigits(code)), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, navigate]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  // A fresh signal per mount (StrictMode mounts twice in dev).
  useEffect(() => {
    const signal = { cancelled: false };
    pollSignal.current = signal;
    return () => {
      signal.cancelled = true;
    };
  }, []);

  if (!state) return null;

  async function handleVerify(code: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const review = await api.verifyOtp(requestId, code);
      const verdict = review.status === "pending" ? await waitForReview(review.id, pollSignal.current) : review.status;
      if (verdict === "cancelled") return;
      if (verdict === "approved") {
        completeAuth();
        navigate("/home", { replace: true });
        return;
      }
      setError(t("auth.otpRejected"));
      setDigits(emptyCode());
      inputsRef.current[0]?.focus();
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
    if (!state || resending || seconds > 0) return;
    setResending(true);
    setError(null);
    try {
      const res = await api.requestOtp(state.phone);
      setRequestId(res.requestId);
      if (res.codeLength) setLengths(codeLengths(res.codeLength));
      setSeconds(res.resendAfterSec ?? DEFAULT_RESEND_SEC);
      if (res.testCode) setDigits(toDigits(res.testCode));
    } catch (e) {
      const key = serverErrorKey(e);
      setError(key ? t(key as TranslationKey) : t("auth.otpSendError"));
    } finally {
      setResending(false);
    }
  }

  function fill(from: number, raw: string) {
    const incoming = raw.replace(/\D/g, "");
    if (!incoming) return;
    const next = [...digits];
    let i = from;
    for (const ch of incoming) {
      if (i >= CODE_MAX) break;
      next[i++] = ch;
    }
    setDigits(next);
    setError(null);
    inputsRef.current[Math.min(i, CODE_MAX - 1)]?.focus();
    if (next.every((d) => d)) void handleVerify(next.join(""));
  }

  function onDigitChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "");
    if (!v) {
      const next = [...digits];
      next[i] = "";
      setDigits(next);
      return;
    }
    // Typing over a filled box keeps the new digit; an SMS autofill or a
    // paste delivers several at once.
    fill(i, v.length > 1 && digits[i] && v.startsWith(digits[i]) ? v.slice(1) : v);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      inputsRef.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) inputsRef.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < CODE_MAX - 1) inputsRef.current[i + 1]?.focus();
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fill(i, e.clipboardData.getData("text"));
  }

  const entered = digits.join("");
  // Valid when the filled boxes are an unbroken prefix of at least CODE_MIN digits.
  const firstEmpty = digits.indexOf("");
  const codeReady = entered.length >= CODE_MIN && (firstEmpty === -1 || entered.length === firstEmpty);
  const canResend = seconds <= 0 && !resending;

  return (
    <div className="flex h-full flex-col bg-iz-head">
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 px-6 pb-7 pt-[calc(var(--safe-top)+12px)] kb:pb-5">
        <IconButton icon="back" label={t("common.back")} onClick={() => navigate("/auth/phone", { replace: true })} />
        <div className="flex flex-col gap-3.5 kb:gap-1.5">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-iz-head-card text-iz-green kb:hidden" aria-hidden>
            <Icon name="chat" size={30} />
          </span>
          <h1 className="text-[32px] font-extrabold leading-10 text-iz-head-text kb:text-[24px] kb:leading-8">{t("auth.enterCodeTitle")}</h1>
          <p className="text-[15px] leading-[23px] text-iz-head-muted kb:text-[14px] kb:leading-[21px]">
            {rich(t("auth.codeSentTo"), {
              phone: <span className="font-bold text-iz-head-text">{maskPhone(state.phone)}</span>,
              change: (
                <Link to="/auth/phone" replace className="font-bold text-iz-green">
                  {t("auth.changePhone")}
                </Link>
              ),
            })}
          </p>
        </div>
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (codeReady) void handleVerify(entered);
        }}
        className="flex shrink-0 flex-col gap-[18px] rounded-t-iz-sheet bg-iz-sheet px-6 pb-[calc(max(var(--safe-bottom),16px)+12px)] pt-7 kb:gap-3.5 kb:pb-[calc(var(--kb-inset)+16px)] kb:pt-5"
      >
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-[14px] font-bold text-iz-ink kb:sr-only">
            {CODE_MIN === CODE_MAX ? t("auth.codeLabel", { count: CODE_MAX }) : t("auth.codeLabelAny")}
          </legend>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${CODE_MAX}, minmax(0, 1fr))` }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  if (el) inputsRef.current[i] = el;
                }}
                value={d}
                onChange={(e) => onDigitChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
                onFocus={(e) => e.target.select()}
                name={`code-${i}`}
                aria-label={t("auth.codeDigit", { n: i + 1 })}
                aria-invalid={error ? true : undefined}
                autoComplete={i === 0 ? "one-time-code" : "off"}
                autoFocus={i === 0}
                spellCheck={false}
                inputMode="numeric"
                readOnly={submitting}
                className={cn(
                  "iz-input h-16 w-full min-w-0 rounded-[18px] border-2 p-0 text-center text-[24px] font-extrabold tabular-nums outline-none transition-[background,box-shadow]",
                  "focus:border-iz-ink focus:bg-iz-field-focus focus:text-iz-ink focus:shadow-[0_0_0_4px_var(--iz-focus-ring)]",
                  error ? "border-iz-danger" : "border-transparent",
                  d ? "bg-iz-selected text-iz-on-selected" : "bg-iz-field text-iz-ink"
                )}
              />
            ))}
          </div>
          {error && (
            <span role="alert" className="text-[13px] font-semibold text-iz-danger">
              {error}
            </span>
          )}
        </fieldset>

        <button
          type="button"
          onClick={resend}
          disabled={!canResend}
          className={cn(
            "flex h-14 items-center gap-3 rounded-[18px] bg-iz-field px-4 text-left kb:h-auto kb:bg-transparent kb:px-0",
            canResend && "active:opacity-70"
          )}
        >
          <Icon name={canResend ? "refresh" : "clock"} className={cn("shrink-0 kb:hidden", canResend ? "text-iz-green-text" : "text-iz-muted")} />
          <span className={cn("flex-1 text-[14px]", canResend ? "font-bold text-iz-ink" : "font-semibold text-iz-muted")}>{t("auth.resend")}</span>
          {seconds > 0 && (
            <span className="text-[15px] font-extrabold tabular-nums text-iz-ink" aria-live="off">
              {mmss(seconds)}
            </span>
          )}
        </button>

        <PrimaryButton type="submit" loading={submitting} disabled={!codeReady}>
          {t("common.confirm")}
        </PrimaryButton>
      </form>
    </div>
  );
}
