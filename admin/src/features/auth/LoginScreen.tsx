import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IdCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { ReviewStatus } from "@/components/ReviewStatus";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useMeStore } from "@/stores/meStore";
import { cn } from "@/lib/cn";
import { DEMO_MODE } from "@/config";

type Phase = "identifier" | "code" | "review";

export function LoginScreen() {
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const [phase, setPhase] = useState<Phase>("identifier");
  // The sample-data build prefills a sample account; the real build starts empty.
  const [identifier, setIdentifier] = useState(DEMO_MODE ? "kamola@izgo.example" : "");
  const [loading, setLoading] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  // Only the mock adapter returns the code (sample-data build); the real
  // backend never does, so nothing is shown or autofilled there.
  const [testCode, setTestCode] = useState<string | undefined>(undefined);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resending, setResending] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  // Real API: the email-code step also needs the staff phone, and SMS codes
  // may be shorter than 6 digits. The adapter says so per step.
  const [needsPhone, setNeedsPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [codeMinLength, setCodeMinLength] = useState(6);
  // Number of code boxes: the server's code_length when it sends one, else 6.
  const [codeLength, setCodeLength] = useState(6);
  const inputsRef = useRef<HTMLInputElement[]>([]);
  const code = digits.join("");
  const canSubmit = code.length >= codeMinLength && (!needsPhone || phone.trim().length > 0);

  useEffect(() => {
    if (phase !== "code" || resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, resendSeconds]);

  async function handleStart() {
    if (loading) return;
    setLoading(true);
    setIdentifierError(null);
    try {
      const res = await api.requestLogin(identifier);
      setRequestId(res.requestId);
      setDestination(res.maskedDestination);
      setTestCode(res.testCode);
      setResendSeconds(res.resendSeconds);
      setNeedsPhone(!!res.needsPhone);
      setCodeMinLength(res.codeMinLength ?? 6);
      setCodeLength(res.codeLength ?? 6);
      setDigits(Array(res.codeLength ?? 6).fill(""));
      setPhase("code");
      setTimeout(() => inputsRef.current[0]?.focus(), 0);
    } catch (e) {
      setIdentifierError(e instanceof Error ? e.message : "Foydalanuvchi topilmadi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(code: string) {
    if (!requestId || loading) return;
    setLoading(true);
    setCodeError(null);
    try {
      const res = await api.verifyLoginStep(requestId, code, needsPhone ? { phone: phone.trim() } : undefined);
      if (res.done) {
        setReviewId(res.reviewId);
        setPhase("review");
      } else {
        setRequestId(res.requestId);
        setDestination(res.maskedDestination);
        setTestCode(res.testCode);
        setResendSeconds(res.resendSeconds);
        setNeedsPhone(!!res.needsPhone);
        setCodeMinLength(res.codeMinLength ?? 6);
        setCodeLength(res.codeLength ?? 6);
        setDigits(Array(res.codeLength ?? 6).fill(""));
        setTimeout(() => inputsRef.current[0]?.focus(), 0);
      }
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Kod noto'g'ri.");
      setDigits(Array(codeLength).fill(""));
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!requestId || resendSeconds > 0) return;
    setResending(true);
    setCodeError(null);
    try {
      const res = await api.resendLoginCode(requestId);
      setTestCode(res.testCode);
      setResendSeconds(res.resendSeconds);
      if (res.codeLength && res.codeLength !== codeLength) {
        setCodeLength(res.codeLength);
        setDigits(Array(res.codeLength).fill(""));
      }
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Kodni qayta yuborib bo'lmadi.");
    } finally {
      setResending(false);
    }
  }

  function onDigitChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < next.length - 1) inputsRef.current[i + 1]?.focus();
    // Auto-submit once every box is filled, unless a phone is still needed.
    if (!needsPhone && next.every((d) => d) && next.join("").length === next.length) handleVerify(next.join(""));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-14 items-center rounded-box bg-ink px-3">
            <Logo height={28} />
          </span>
          <div>
            <p className="text-lg font-semibold text-ink">IZGO Admin</p>
            <p className="text-xs text-ink/50">Boshqaruv paneliga xush kelibsiz</p>
          </div>
        </div>

        {phase === "identifier" && (
          <div className="space-y-4">
            <Input
              label="Email yoki telefon"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              leftIcon={<IdCard className="h-4 w-4" />}
              error={identifierError ?? undefined}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              autoFocus
            />
            {DEMO_MODE && (
              <p className="text-xs text-ink/50">
                Sinov hisoblari: kamola@izgo.example (superadmin) · behzod@izgo.example (egasi) · javlon@izgo.example (menejer) ·
                shahnoza@izgo.example (marketolog) · +998 90 000 00 05 (operator, email yo'q)
              </p>
            )}
            <Button fullWidth loading={loading} disabled={!identifier.trim()} onClick={handleStart}>
              Davom etish
            </Button>
          </div>
        )}

        {phase === "code" && (
          <div className="space-y-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-button bg-accent-10 text-accent">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Tasdiqlash kodi</p>
              <p className="mt-1 text-xs text-ink/60">
                {destination} manziliga yuborilgan {codeMinLength < codeLength ? "tasdiqlash kodini" : `${codeLength} xonali kodni`} kiriting.
                {testCode && ` (Sinov kodi: ${testCode})`}
              </p>
            </div>
            {needsPhone && (
              <Input
                label="Telefon raqamingiz"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 000 00 00"
                hint="Keyingi qadamda shu raqamga SMS kod yuboriladi."
              />
            )}
            <div className="flex gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    if (el) inputsRef.current[i] = el;
                  }}
                  value={d}
                  onChange={(e) => onDigitChange(i, e.target.value)}
                  inputMode="numeric"
                  maxLength={1}
                  className={cn(
                    "h-12 w-11 rounded-button border bg-card text-center text-lg font-semibold tabular text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15",
                    codeError ? "border-danger" : "border-border"
                  )}
                />
              ))}
            </div>
            {codeError && <p className="text-xs font-semibold text-danger">{codeError}</p>}
            <div className="flex items-center justify-between text-xs">
              <button type="button"
                onClick={handleResend}
                disabled={resendSeconds > 0 || resending}
                className="font-semibold text-accent disabled:text-ink/40"
              >
                {resendSeconds > 0 ? `Qayta yuborish (${resendSeconds}s)` : "Kodni qayta yuborish"}
              </button>
              <button type="button" onClick={() => setPhase("identifier")} className="text-ink/50">
                Orqaga
              </button>
            </div>
            <Button fullWidth loading={loading} disabled={!canSubmit} onClick={() => handleVerify(code)}>
              Tasdiqlash
            </Button>
          </div>
        )}

        {phase === "review" && reviewId && (
          <ReviewStatus
            reviewId={reviewId}
            title="Tekshiruvga yuborildi"
            description="Kirish tasdiqlanmoqda. Bir necha soniya kutib turing."
            onApproved={() => {
              useMeStore.getState().clear();
              setAuthenticated(true);
              navigate("/", { replace: true });
            }}
          />
        )}
      </div>
    </div>
  );
}
