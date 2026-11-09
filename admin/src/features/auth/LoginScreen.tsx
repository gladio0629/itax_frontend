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

type Phase = "identifier" | "code" | "review";

export function LoginScreen() {
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const [phase, setPhase] = useState<Phase>("identifier");
  const [identifier, setIdentifier] = useState("kamola@izgo.example");
  const [loading, setLoading] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resending, setResending] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const inputsRef = useRef<HTMLInputElement[]>([]);

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
      setDemoCode(res.demoCode);
      setResendSeconds(res.resendSeconds);
      setDigits(Array(6).fill(""));
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
      const res = await api.verifyLoginStep(requestId, code);
      if (res.done) {
        setReviewId(res.reviewId);
        setPhase("review");
      } else {
        setRequestId(res.requestId);
        setDestination(res.maskedDestination);
        setDemoCode(res.demoCode);
        setResendSeconds(res.resendSeconds);
        setDigits(Array(6).fill(""));
        setTimeout(() => inputsRef.current[0]?.focus(), 0);
      }
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Kod noto'g'ri.");
      setDigits(Array(6).fill(""));
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!requestId || resendSeconds > 0) return;
    setResending(true);
    try {
      const res = await api.resendLoginCode(requestId);
      setDemoCode(res.demoCode);
      setResendSeconds(res.resendSeconds);
    } finally {
      setResending(false);
    }
  }

  function onDigitChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === 6) handleVerify(next.join(""));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[420px] rounded-2xl bg-card p-8 shadow-softer">
        <div className="mb-8 flex items-center gap-3">
          <Logo size={44} />
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
            <p className="text-xs text-ink/50">
              Demo: kamola@izgo.example (superadmin) · behzod@izgo.example (egasi) · javlon@izgo.example (menejer) ·
              shahnoza@izgo.example (marketolog) · dilnoza@izgo.example (operator)
            </p>
            <Button fullWidth loading={loading} disabled={!identifier.trim()} onClick={handleStart}>
              Davom etish
            </Button>
          </div>
        )}

        {phase === "code" && (
          <div className="space-y-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-10 text-accent">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Tasdiqlash kodi</p>
              <p className="mt-1 text-xs text-ink/60">
                {destination} manziliga yuborilgan 6 xonali kodni kiriting. (Demo kod: {demoCode})
              </p>
            </div>
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
                    "h-12 w-11 rounded-xl border bg-card text-center text-lg font-semibold tabular text-ink outline-none transition-colors",
                    codeError ? "border-danger" : "border-border focus:border-accent"
                  )}
                />
              ))}
            </div>
            {codeError && <p className="text-xs font-medium text-danger">{codeError}</p>}
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={handleResend}
                disabled={resendSeconds > 0 || resending}
                className="font-semibold text-accent disabled:text-ink/40"
              >
                {resendSeconds > 0 ? `Qayta yuborish (${resendSeconds}s)` : "Kodni qayta yuborish"}
              </button>
              <button onClick={() => setPhase("identifier")} className="text-ink/50">
                Orqaga
              </button>
            </div>
            <Button fullWidth loading={loading} disabled={digits.some((d) => !d)} onClick={() => handleVerify(digits.join(""))}>
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
