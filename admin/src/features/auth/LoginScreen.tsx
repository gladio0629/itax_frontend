import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { ReviewStatus } from "@/components/ReviewStatus";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/cn";

type Phase = "credentials" | "code" | "review";

export function LoginScreen() {
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const [phase, setPhase] = useState<Phase>("credentials");
  const [email, setEmail] = useState("kamola@izgo.uz");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const inputsRef = useRef<HTMLInputElement[]>([]);

  async function handleLogin() {
    if (loading) return;
    setLoading(true);
    setCredError(null);
    try {
      await api.login(email, password);
      const res = await api.requestTwoFactor();
      setRequestId(res.requestId);
      setDemoCode(res.demoCode);
      setPhase("code");
    } catch {
      setCredError("Email yoki parol noto'g'ri.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(code: string) {
    if (!requestId || loading) return;
    setLoading(true);
    setCodeError(null);
    try {
      const review = await api.verifyTwoFactor(requestId, code);
      setReviewId(review.id);
      setPhase("review");
    } catch {
      setCodeError("Kod noto'g'ri. Qaytadan urinib ko'ring.");
      setDigits(["", "", "", ""]);
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  function onDigitChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 3) inputsRef.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === 4) handleVerify(next.join(""));
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

        {phase === "credentials" && (
          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              autoFocus
            />
            <Input
              label="Parol"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              error={credError ?? undefined}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <p className="text-xs text-ink/50">
              Demo: kamola@izgo.uz / javlon@izgo.uz / shahnoza@izgo.uz — parol: demo1234
            </p>
            <Button fullWidth loading={loading} disabled={!email || !password} onClick={handleLogin}>
              Kirish
            </Button>
          </div>
        )}

        {phase === "code" && (
          <div className="space-y-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-10 text-accent">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Ikki bosqichli tasdiqlash</p>
              <p className="mt-1 text-xs text-ink/60">
                Email manzilingizga yuborilgan 4 xonali kodni kiriting. (Demo kod: {demoCode})
              </p>
            </div>
            <div className="flex gap-3">
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
                    "h-14 w-14 rounded-xl border bg-card text-center text-lg font-semibold tabular text-ink outline-none transition-colors",
                    codeError ? "border-danger" : "border-border focus:border-accent"
                  )}
                />
              ))}
            </div>
            {codeError && <p className="text-xs font-medium text-danger">{codeError}</p>}
            <Button
              fullWidth
              loading={loading}
              disabled={digits.some((d) => !d)}
              onClick={() => handleVerify(digits.join(""))}
            >
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
              setAuthenticated(true);
              navigate("/dashboard", { replace: true });
            }}
          />
        )}
      </div>
    </div>
  );
}
