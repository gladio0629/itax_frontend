import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Headset, Info, Mail, Phone } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { AdminBrand } from "@/components/Logo";
import { api } from "@/api/client";
import { isApiError } from "@shared/http/errors";
import { useAuthStore } from "@/stores/authStore";
import { useMeStore } from "@/stores/meStore";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/cn";
import { DEMO_MODE } from "@/config";
import { AuthAside } from "./AuthAside";
import { CodeInput, formatCountdown } from "./CodeInput";
import type { LoginStartResult, LoginStepResult } from "@/api/types";

/**
 * Admin sign-in (doc 2.5, design Main + Verify). Nothing is remembered on
 * the device: every logout means a full sign-in again.
 *
 * Staff with email (superadmin, owner, menejer, marketolog):
 *   Main:   email → email code
 *   Verify: staff phone (sent together with the email code) → SMS code
 * Operator: Verify only: phone → SMS code.
 * The server decides the steps, code lengths and whether the phone matches.
 */
type Mode = "staff" | "operator";
type Stage = "email" | "emailCode" | "phone" | "smsCode";

/** Server keys that mean "the email code was wrong or expired". */
const CODE_ERRORS = new Set(["AUTH_OTP_INVALID", "INVALID_CODE"]);
const EXPIRED_ERRORS = new Set(["AUTH_OTP_EXPIRED", "TOO_MANY_ATTEMPTS"]);

type CodeMeta = { length: number; min: number };
const metaOf = (r: Pick<LoginStartResult, "codeLength" | "codeMinLength">): CodeMeta => ({
  length: r.codeLength ?? 6,
  min: r.codeMinLength ?? r.codeLength ?? 6,
});

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function LoginScreen() {
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const [mode, setMode] = useState<Mode>("staff");
  const [stage, setStage] = useState<Stage>("email");
  // The sample-data build prefills a sample account; the real build starts empty.
  const [email, setEmail] = useState(DEMO_MODE ? "kamola@izgo.example" : "");
  const [phone, setPhone] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [needsPhone, setNeedsPhone] = useState(true);
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [emailMeta, setEmailMeta] = useState<CodeMeta>({ length: 6, min: 6 });
  const [smsMeta, setSmsMeta] = useState<CodeMeta>({ length: 6, min: 6 });
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  // Only the mock adapter returns the code (sample-data build).
  const [testCode, setTestCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  function resetAll(nextMode: Mode) {
    setMode(nextMode);
    setStage(nextMode === "staff" ? "email" : "phone");
    setRequestId(null);
    setEmailCode("");
    setSmsCode("");
    setEmailConfirmed(false);
    setResendSeconds(0);
    setTestCode(undefined);
    setError(null);
  }

  function codeSent(r: { requestId: string; resendSeconds: number; testCode?: string }) {
    setRequestId(r.requestId);
    setResendSeconds(r.resendSeconds);
    setTestCode(r.testCode);
  }

  function finish() {
    useMeStore.getState().clear();
    setAuthenticated(true);
    navigate("/", { replace: true });
  }

  /** A step result that still needs the SMS code. */
  function toSmsStep(r: Extract<LoginStepResult, { done: false }> | LoginStartResult) {
    codeSent(r);
    setSmsMeta(metaOf(r));
    setSmsCode("");
    setStage("smsCode");
  }

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  // --- staff: Main ---------------------------------------------------------
  const sendEmail = () =>
    run(async () => {
      const value = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setError("Emailni to'liq kiriting, masalan: ism@izgo.uz");
        return;
      }
      try {
        const r = await api.requestLogin(value);
        if (r.steps[0] !== "email_code") {
          // Not an email account (the server decides); operators use the phone path.
          setError("Bu hisob telefon va SMS kod bilan kiradi.");
          return;
        }
        codeSent(r);
        setNeedsPhone(r.needsPhone ?? false);
        setEmailMeta(metaOf(r));
        setEmailCode("");
        setStage("emailCode");
      } catch (e) {
        setError(errText(e, "Kod yuborib bo'lmadi."));
      }
    });

  const submitEmailCode = () =>
    run(async () => {
      if (emailCode.length < emailMeta.min || !requestId) return;
      if (needsPhone) {
        // The real API checks the email code together with the phone (Verify).
        setStage("phone");
        return;
      }
      try {
        const r = await api.verifyLoginStep(requestId, emailCode);
        setEmailConfirmed(true);
        if (r.done) finish();
        else toSmsStep(r);
      } catch (e) {
        setError(errText(e, "Kod noto'g'ri."));
        setEmailCode("");
      }
    });

  // --- Verify: phone, then SMS --------------------------------------------
  const sendPhone = () =>
    run(async () => {
      if (!phone.trim()) {
        setError("Telefon raqamini kiriting.");
        return;
      }
      try {
        if (mode === "operator") {
          const r = await api.requestLogin(phone.trim());
          if (r.steps[0] !== "phone_code") {
            setError("Bu hisob email orqali kiradi. Email bilan kiring.");
            return;
          }
          toSmsStep(r);
          return;
        }
        if (!requestId) return;
        const r = await api.verifyLoginStep(requestId, emailCode, { phone: phone.trim() });
        setEmailConfirmed(true);
        if (r.done) finish();
        else toSmsStep(r);
      } catch (e) {
        const code = isApiError(e) ? e.code : "";
        if (mode === "staff" && (CODE_ERRORS.has(code) || EXPIRED_ERRORS.has(code))) {
          // The email code was rejected: back to Main to fix or re-request it.
          setEmailCode("");
          setStage(EXPIRED_ERRORS.has(code) ? "email" : "emailCode");
        }
        setError(errText(e, "SMS kod yuborib bo'lmadi."));
      }
    });

  const submitSms = () =>
    run(async () => {
      if (smsCode.length < smsMeta.min || !requestId) return;
      try {
        const r = await api.verifyLoginStep(requestId, smsCode);
        if (r.done) finish();
        else toSmsStep(r);
      } catch (e) {
        const code = isApiError(e) ? e.code : "";
        setSmsCode("");
        if (EXPIRED_ERRORS.has(code)) {
          resetAll(mode);
        }
        setError(errText(e, "Kod noto'g'ri."));
      }
    });

  async function resend() {
    if (!requestId || resendSeconds > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const r = await api.resendLoginCode(requestId);
      setResendSeconds(r.resendSeconds);
      setTestCode(r.testCode);
      if (r.codeLength) {
        const meta = { length: r.codeLength, min: r.codeLength };
        if (stage === "emailCode") {
          setEmailMeta(meta);
          setEmailCode("");
        } else {
          setSmsMeta(meta);
          setSmsCode("");
        }
      }
    } catch (e) {
      setError(errText(e, "Kodni qayta yuborib bo'lmadi."));
    } finally {
      setResending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (stage === "email") sendEmail();
    else if (stage === "emailCode") submitEmailCode();
    else if (stage === "phone") sendPhone();
    else submitSms();
  }

  function goBack() {
    setError(null);
    if (mode === "operator") return stage === "smsCode" ? resetAll("operator") : resetAll("staff");
    if (stage === "phone") return setStage("emailCode");
    // After the SMS was sent the email code is used up: start over.
    resetAll("staff");
  }

  const onMain = mode === "staff" && (stage === "email" || stage === "emailCode");

  const aside = onMain
    ? {
        title: "Platforma boshqaruvi",
        text: "Buyurtmalar, haydovchilar, hamyon va jamoa: hammasi bitta joyda. Har harakat audit jurnaliga yoziladi.",
      }
    : {
        title: "Ikki qadamli himoya",
        text: "Email va telefon: ikkalasi tasdiqlanmasa, panelga hech kim kira olmaydi. Operatorlar faqat telefon va SMS bilan kiradi.",
      };

  return (
    <div className="flex min-h-screen bg-white">
      <AuthAside {...aside} />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center bg-ink px-5 lg:hidden">
          <AdminBrand compact />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <form noValidate onSubmit={onSubmit} className="flex w-full max-w-[440px] flex-col gap-[18px]">
            {!onMain && (
              <button
                type="button"
                onClick={goBack}
                className="-ml-1 inline-flex h-11 items-center gap-1.5 self-start rounded-full px-1 text-sm font-bold text-ink hover:text-ink/70"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden /> Orqaga
              </button>
            )}

            {mode === "staff" && <StepBar step={onMain ? 1 : 2} />}

            <div className="flex flex-col gap-2">
              <h1 className="text-[30px] font-extrabold leading-9 text-ink">
                {onMain ? "Xodim sifatida kirish" : mode === "operator" ? "Operator sifatida kirish" : "Telefonni tasdiqlang"}
              </h1>
              <p className="text-15 leading-[22px] text-muted">
                {onMain
                  ? "Avval email, keyin telefon tasdiqlanadi. Faqat IZGO jamoasi uchun."
                  : mode === "operator"
                    ? "Telefon raqamingizga SMS kod yuboriladi. Operatorlar faqat telefon va SMS bilan kiradi."
                    : "Xodim hisobidagi telefon raqamiga SMS kod yuboriladi."}
              </p>
            </div>

            {/* ---- Main: email ---- */}
            {onMain && stage === "email" && (
              <Input
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ism@izgo.uz"
                leftIcon={<Mail className="h-5 w-5" aria-hidden />}
              />
            )}

            {onMain && stage === "emailCode" && (
              <>
                <SentField icon={<Mail className="h-5 w-5" aria-hidden />} label="Email" value={email.trim()} onChange={() => resetAll("staff")} sentText="Kod emailingizga yuborildi" />
                <CodeBlock
                  label={`Emaildagi ${emailMeta.length} xonali kod`}
                  length={emailMeta.length}
                  value={emailCode}
                  onChange={(v) => {
                    setEmailCode(v);
                    setError(null);
                  }}
                  invalid={!!error}
                  disabled={busy}
                  resendSeconds={resendSeconds}
                  resending={resending}
                  onResend={resend}
                  testCode={testCode}
                />
              </>
            )}

            {/* ---- Verify ---- */}
            {!onMain && mode === "staff" && (
              <div className="flex items-center gap-3 rounded-field bg-green-soft px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green text-ink">
                  <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-extrabold text-ink">{emailConfirmed ? "Email tasdiqlandi" : "Email kodi kiritildi"}</span>
                  <span className="truncate text-xs font-semibold text-muted">{email.trim()}</span>
                </span>
              </div>
            )}

            {!onMain && stage === "phone" && (
              <Input
                label="Telefon"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                leftIcon={<Phone className="h-5 w-5" aria-hidden />}
                hint={mode === "staff" ? "Xodim hisobingizdagi raqam." : undefined}
              />
            )}

            {!onMain && stage === "smsCode" && (
              <>
                <SentField
                  icon={<Phone className="h-5 w-5" aria-hidden />}
                  label="Telefon"
                  value={formatPhone(phone.trim())}
                  // Staff: the email code is used up once the SMS is sent, so a
                  // different phone means starting over (Orqaga).
                  onChange={mode === "operator" ? () => resetAll("operator") : undefined}
                  sentText="SMS kod yuborildi"
                />
                <CodeBlock
                  label={`SMS dagi ${smsMeta.length} xonali kod`}
                  length={smsMeta.length}
                  value={smsCode}
                  onChange={(v) => {
                    setSmsCode(v);
                    setError(null);
                  }}
                  invalid={!!error}
                  disabled={busy}
                  resendSeconds={resendSeconds}
                  resending={resending}
                  onResend={resend}
                  testCode={testCode}
                />
              </>
            )}

            {error && (
              <p role="alert" className="-mt-1 text-13 font-semibold text-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              loading={busy}
              disabled={
                (stage === "emailCode" && emailCode.length < emailMeta.min) || (stage === "smsCode" && smsCode.length < smsMeta.min)
              }
              className="h-14 w-full text-sm"
            >
              {stage === "email" ? "Kod yuborish" : stage === "phone" ? "SMS kod yuborish" : stage === "smsCode" ? "Kirish" : "Davom etish"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>

            {onMain && (
              <button
                type="button"
                onClick={() => resetAll("operator")}
                className="inline-flex h-11 items-center gap-2 self-center rounded-full px-3 text-13 font-bold text-ink hover:bg-surface"
              >
                <Headset className="h-4 w-4" aria-hidden /> Operatormisiz? Telefon bilan kiring
              </button>
            )}

            {!onMain && (
              <p className="flex items-start justify-center gap-1.5 text-center text-xs leading-[18px] text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Qurilma eslab qolinmaydi: har chiqishdan keyin qaytadan kirasiz.
              </p>
            )}

            {DEMO_MODE && stage === "email" && mode === "staff" && (
              <p className="rounded-field bg-surface px-4 py-3 text-xs leading-5 text-muted">
                Sinov hisoblari (email · telefon): kamola@izgo.example · +998 90 000 00 01 (superadmin), behzod@izgo.example · …02 (owner),
                javlon@izgo.example · …03 (menejer), shahnoza@izgo.example · …04 (marketolog). Operator: +998 90 000 00 05.
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

function StepBar({ step }: { step: 1 | 2 }) {
  const items = ["1. Email va kod", "2. Telefon va SMS kod"];
  return (
    <ol className="flex gap-2" aria-label={`Kirish: ${step}-qadam, jami 2`}>
      {items.map((label, i) => {
        const done = i < step;
        return (
          <li key={label} className="flex flex-1 flex-col gap-2" aria-current={i + 1 === step ? "step" : undefined}>
            <span aria-hidden className={cn("h-1 rounded-sm", done ? "bg-green" : "bg-line")} />
            <span className={cn("text-xs font-bold", done ? "text-ink" : "text-muted")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** A value that was already sent (email / phone) with "O'zgartirish". */
function SentField({
  icon,
  label,
  value,
  onChange,
  sentText,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange?: () => void;
  sentText: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-16 items-center gap-3 rounded-field bg-surface py-2.5 pl-4 pr-2.5">
        <span className="shrink-0 text-muted">{icon}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="label-caps text-muted">{label}</span>
          <span className="tabular truncate text-15 font-bold text-ink">{value}</span>
        </span>
        {onChange && (
          <button type="button" onClick={onChange} className="h-11 shrink-0 rounded-full bg-white px-3.5 text-13 font-bold text-ink hover:bg-line">
            O'zgartirish
          </button>
        )}
      </div>
      <span role="status" className="flex items-center gap-1.5 text-13 font-semibold text-green-text">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {sentText}
      </span>
    </div>
  );
}

function CodeBlock({
  label,
  length,
  value,
  onChange,
  invalid,
  disabled,
  resendSeconds,
  resending,
  onResend,
  testCode,
}: {
  label: string;
  length: number;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  disabled: boolean;
  resendSeconds: number;
  resending: boolean;
  onResend: () => void;
  testCode?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5" role="group" aria-label={label}>
      <span className="text-sm font-bold text-ink">{label}</span>
      <CodeInput length={length} value={value} onChange={onChange} label={label} invalid={invalid} disabled={disabled} autoFocus />
      <div className="flex items-center justify-between text-13 font-semibold text-muted">
        <button
          type="button"
          onClick={onResend}
          disabled={resendSeconds > 0 || resending}
          className="-ml-1 h-11 rounded-full px-1 text-left enabled:font-bold enabled:text-ink enabled:hover:underline disabled:cursor-default"
        >
          Kodni qayta yuborish
        </button>
        {resendSeconds > 0 && (
          <span className="tabular font-extrabold text-ink" aria-label={`${resendSeconds} soniyadan keyin`}>
            {formatCountdown(resendSeconds)}
          </span>
        )}
      </div>
      {/* Sample-data build only: the http build drops this line. */}
      {DEMO_MODE && testCode && <span className="text-xs font-semibold text-muted">Sinov kodi: {testCode}</span>}
    </div>
  );
}
