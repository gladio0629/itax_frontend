import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, FileCheck2, ShieldCheck, User, Upload } from "lucide-react";
import { api } from "@/api/client";
import type { City } from "@/api/types";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return parts.filter(Boolean).join(" ");
}

const STEPS = [
  { key: "info", label: "Shaxsiy", icon: User },
  { key: "car", label: "Avtomobil", icon: Car },
  { key: "docs", label: "Hujjatlar", icon: FileCheck2 },
  { key: "otp", label: "Tasdiqlash", icon: ShieldCheck },
] as const;

type DocState = { licensePhotoName: string; techPassportPhotoName: string };

export function RegistrationScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [cities, setCities] = useState<City[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cityId, setCityId] = useState("");

  const [carModel, setCarModel] = useState("");
  const [plate, setPlate] = useState("");

  const [docs, setDocs] = useState<DocState>({ licensePhotoName: "", techPassportPhotoName: "" });

  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [otpRequestId, setOtpRequestId] = useState<string | null>(null);
  const [otpDemoCode, setOtpDemoCode] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const inputsRef = useRef<HTMLInputElement[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [citiesError, setCitiesError] = useState(false);

  function loadCities() {
    setCitiesError(false);
    api
      .getCities()
      .then((list) => {
        setCities(list);
        setCityId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => setCitiesError(true));
  }

  useEffect(loadCities, []);

  const phoneDigits = phone.replace(/\D/g, "");
  const canNextInfo = name.trim().length >= 3 && phoneDigits.length === 9 && !!cityId;
  const canNextCar = carModel.trim().length >= 2 && plate.trim().length >= 5;
  const canNextDocs = !!docs.licensePhotoName && !!docs.techPassportPhotoName;

  async function startOtp() {
    setOtpError(null);
    try {
      const fullPhone = `+998 ${phone}`;
      const res = await api.requestOtp(fullPhone);
      setOtpRequestId(res.requestId);
      setOtpDemoCode(res.demoCode);
      setOtpDigits(["", "", "", ""]);
    } catch {
      setOtpError("Kod yuborilmadi. Qaytadan urinib ko'ring.");
    }
  }

  function goToOtpStep() {
    setStep(3);
    startOtp();
  }

  function onDigitChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[i] = v;
    setOtpDigits(next);
    if (v && i < 3) inputsRef.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === 4) {
      verifyAndSubmit(next.join(""));
    }
  }

  async function verifyAndSubmit(code: string) {
    if (!otpRequestId) return;
    setSubmitting(true);
    setOtpError(null);
    try {
      await api.verifyOtp(otpRequestId, code);
      const review = await api.submitRegistration({
        name: name.trim(),
        phone: `+998 ${phone}`,
        cityId,
        carModel: carModel.trim(),
        plate: plate.trim().toUpperCase(),
        licensePhotoName: docs.licensePhotoName,
        techPassportPhotoName: docs.techPassportPhotoName,
      });
      setReviewId(review.id);
    } catch {
      setOtpError("Kod noto'g'ri. Qaytadan urinib ko'ring.");
      setOtpDigits(["", "", "", ""]);
      inputsRef.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  function fakeUpload(field: keyof DocState, defaultName: string) {
    setDocs((prev) => ({ ...prev, [field]: defaultName }));
  }

  if (reviewId) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title="Ro'yxatdan o'tish" showBack={false} />
        <div className="flex flex-1 items-center justify-center">
          {done ? (
            <div className="flex flex-col items-center gap-4 px-6 text-center animate-fade-in">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-bg animate-check-pop">
                <ShieldCheck className="h-9 w-9" />
              </div>
              <p className="text-lg font-semibold text-ink">Hujjatlar qabul qilindi!</p>
              <p className="max-w-[280px] text-sm text-ink/60">
                Hujjatlaringiz tekshirildi. Endi buyurtmalar oqimini ko'rishingiz mumkin.
              </p>
              <Button fullWidth onClick={() => navigate("/offers", { replace: true })}>
                Buyurtmalarga o'tish
              </Button>
            </div>
          ) : (
            <ReviewStatus
              reviewId={reviewId}
              title="Hujjatlar tekshiruvga yuborildi"
              description="Haydovchilik guvohnomasi va texnik pasport tekshirilmoqda. Bir necha soniya kuting."
              onApproved={() => setDone(true)}
              onRejected={() => setDone(true)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title="Ro'yxatdan o'tish namunasi" />

      <div className="flex justify-center pb-1">
        <Logo size={36} />
      </div>

      <div className="flex items-center justify-between px-6 pb-2 pt-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isDone = i < step;
          const isActive = i === step;
          return (
            <div key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <span className={cn("h-0.5 flex-1 transition-colors", isDone || isActive ? "bg-accent" : "bg-border")} />
                )}
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                    isDone ? "bg-accent text-bg" : isActive ? "bg-accent-10 text-accent" : "bg-ink/5 text-ink/60"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {i === 0 && <span className="h-0.5 flex-1" />}
              </div>
              <span className="text-[11px] text-ink/60">{s.label}</span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4">
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-ink/60">Avval shaxsiy ma'lumotlaringizni kiriting.</p>
            <Input
              label="To'liq ism"
              placeholder="Ism Familiya"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Telefon raqam"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              leftIcon={<span className="text-sm font-semibold text-ink/80">+998</span>}
            />
            <div className="w-full">
              <label className="mb-2 block text-sm font-semibold text-ink/80">Shahar</label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                disabled={cities.length === 0}
                className="h-[52px] w-full rounded-xl border border-border bg-card px-4 text-sm text-ink outline-none focus:border-accent disabled:opacity-50"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {citiesError && (
                <button
                  type="button"
                  onClick={loadCities}
                  className="mt-1.5 text-xs font-semibold text-danger"
                >
                  Shaharlar ro'yxati yuklanmadi. Qayta urinish.
                </button>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-ink/60">Avtomobil ma'lumotlarini kiriting.</p>
            <Input label="Avtomobil modeli" placeholder="Masalan: Chevrolet Cobalt" value={carModel} onChange={(e) => setCarModel(e.target.value)} />
            <Input
              label="Davlat raqami"
              placeholder="01 A 123 BC"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-ink/60">Hujjatlar rasmini yuklang (namuna rejimi).</p>
            {(
              [
                { field: "licensePhotoName" as const, label: "Haydovchilik guvohnomasi", file: "guvohnoma.jpg" },
                { field: "techPassportPhotoName" as const, label: "Texnik pasport", file: "texpasport.jpg" },
              ]
            ).map((d) => (
              <button
                key={d.field}
                onClick={() => fakeUpload(d.field, d.file)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors hover:brightness-105",
                  docs[d.field] ? "border-accent bg-accent-5" : "border-border bg-card"
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                    docs[d.field] ? "bg-accent text-bg" : "bg-ink/5 text-ink/60"
                  )}
                >
                  {docs[d.field] ? <FileCheck2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{d.label}</p>
                  <p className="text-xs text-ink/60">{docs[d.field] || "Yuklash uchun bosing"}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-10 text-accent">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm text-ink/60">
                +998 {phone} raqamiga yuborilgan 4 xonali kodni kiriting.
              </p>
              {otpDemoCode && (
                <p className="mt-1 text-xs font-semibold text-accent">Demo kod: {otpDemoCode}</p>
              )}
            </div>
            <div className="flex gap-3">
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    if (el) inputsRef.current[i] = el;
                  }}
                  value={d}
                  onChange={(e) => onDigitChange(i, e.target.value)}
                  inputMode="numeric"
                  type="text"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Tasdiqlash kodi, ${i + 1}-xona`}
                  maxLength={1}
                  className={cn(
                    "h-14 w-14 rounded-xl border bg-card text-center text-lg font-semibold tabular text-ink outline-none transition-colors",
                    otpError ? "border-danger" : "border-border focus:border-accent"
                  )}
                />
              ))}
            </div>
            {otpError && <p className="text-xs font-semibold text-danger">{otpError}</p>}
          </div>
        )}
      </div>

      <div className="px-6" style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
        {step < 3 ? (
          <Button
            fullWidth
            disabled={step === 0 ? !canNextInfo : step === 1 ? !canNextCar : !canNextDocs}
            onClick={() => (step === 2 ? goToOtpStep() : setStep((s) => s + 1))}
          >
            Davom etish
          </Button>
        ) : (
          <Button
            fullWidth
            loading={submitting}
            disabled={otpDigits.some((d) => !d)}
            onClick={() => verifyAndSubmit(otpDigits.join(""))}
          >
            Tasdiqlash va yuborish
          </Button>
        )}
      </div>
    </div>
  );
}
