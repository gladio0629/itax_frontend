import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Phone } from "@/lib/icons";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n/provider";
import { useLiftFloatingControl } from "@/stores/floatingControlStore";
import { formatPhoneInput } from "@/lib/phone";


export function PhoneScreen() {
  const footerRef = useRef<HTMLDivElement>(null);
  useLiftFloatingControl(footerRef);
  const { t } = useT();
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
      navigate("/auth/otp", { state: { requestId: res.requestId, testCode: res.testCode, phone: fullPhone } });
    } catch {
      setError(t("auth.otpSendError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-bg px-6" style={{ paddingTop: "calc(var(--safe-top) + 48px)" }}>
      <div className="flex-1">
        <Logo size={40} className="mb-6" />
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl bg-accent-10 text-accent">
          <Phone className="h-7 w-7" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-ink">{t("auth.phoneTitle")}</h1>
        <p className="mb-8 text-sm text-ink/60">{t("auth.phoneDesc")}</p>
        <Input
          label={t("auth.phoneLabel")}
          type="tel"
          name="phone"
          autoComplete="tel-national"
          inputMode="numeric"
          autoFocus
          placeholder="90 123 45 67"
          value={value}
          onChange={(e) => setValue(formatPhoneInput(e.target.value))}
          leftIcon={<span className="text-sm font-normal text-ink/80">+998</span>}
          error={error ?? undefined}
        />
      </div>
      <div ref={footerRef} style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
        <Button fullWidth disabled={!isValid} loading={loading} onClick={handleSubmit}>
          {t("auth.continue")}
        </Button>
      </div>
    </div>
  );
}
