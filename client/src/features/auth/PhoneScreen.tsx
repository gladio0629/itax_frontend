import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return parts.filter(Boolean).join(" ");
}

export function PhoneScreen() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const setPhone = useAuthStore((s) => s.setPhone);
  const digits = value.replace(/\D/g, "");
  const isValid = digits.length === 9;

  async function handleSubmit() {
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const fullPhone = `+998 ${value}`;
      const res = await api.requestOtp(fullPhone);
      setPhone(fullPhone);
      navigate("/auth/otp", { state: { requestId: res.requestId, demoCode: res.demoCode, phone: fullPhone } });
    } catch {
      setError("Kod yuborilmadi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-bg px-6" style={{ paddingTop: "calc(var(--safe-top) + 48px)" }}>
      <div className="flex-1">
        <Logo size={40} className="mb-6" />
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-10 text-accent">
          <Phone className="h-7 w-7" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-ink">Telefon raqamingiz</h1>
        <p className="mb-8 text-sm text-ink/60">
          Tasdiqlash kodini yuborishimiz uchun raqamingizni kiriting.
        </p>
        <Input
          label="Telefon raqam"
          inputMode="numeric"
          autoFocus
          placeholder="90 123 45 67"
          value={value}
          onChange={(e) => setValue(formatPhoneInput(e.target.value))}
          leftIcon={<span className="text-sm font-medium text-ink/80">+998</span>}
          error={error ?? undefined}
        />
      </div>
      <div style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
        <Button fullWidth disabled={!isValid} loading={loading} onClick={handleSubmit}>
          Davom etish
        </Button>
      </div>
    </div>
  );
}
