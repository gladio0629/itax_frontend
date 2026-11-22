import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { rich } from "@/lib/i18n/rich";
import { serverErrorKey } from "@/lib/apiError";
import { formatPhoneInput } from "@/lib/phone";
import { SITE_URL } from "@/config";
import { cn } from "@/lib/cn";
import { useLiftFloatingControl } from "@/stores/floatingControlStore";
import { Icon, Logo, PrimaryButton, useStatusBar } from "@/ui";

/** Route illustration of the login top (design: Main). */
function HeroArt({ from, to }: { from: string; to: string }) {
  return (
    <div aria-hidden className="relative min-h-[150px] flex-1 kb:hidden">
      <svg width="342" height="190" viewBox="0 0 342 190" className="absolute bottom-0 left-0 block max-w-full">
        <circle cx="56" cy="142" r="30" fill="none" stroke="#17273B" strokeWidth="2" />
        <circle cx="56" cy="142" r="52" fill="none" stroke="#132032" strokeWidth="2" />
        <path d="M56 142 C 110 10, 236 6, 292 66" fill="none" stroke="#2EDB85" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 10" />
        <circle cx="56" cy="142" r="14" fill="#2EDB85" fillOpacity="0.25" />
        <circle cx="56" cy="142" r="7" fill="#2EDB85" />
        <rect x="158" y="24" width="34" height="18" rx="7" fill="#FFFFFF" transform="rotate(-6 175 33)" />
        <rect x="164" y="28" width="12" height="10" rx="3" fill="#0B1524" transform="rotate(-6 175 33)" />
        <circle cx="292" cy="66" r="12" fill="#FFFFFF" />
        <circle cx="292" cy="66" r="4.5" fill="#0B1524" />
      </svg>
      <span className="absolute bottom-[18px] left-[82px] flex h-[30px] items-center rounded-[15px] bg-iz-head-card px-3 text-[12px] font-bold text-iz-head-text">
        {from}
      </span>
      <span className="absolute bottom-[70px] right-0 flex h-[30px] items-center rounded-[15px] bg-iz-head-card px-3 text-[12px] font-bold text-iz-head-text">
        {to}
      </span>
    </div>
  );
}

/** Uzbekistan flag chip in front of +998. */
function UzFlag() {
  return (
    <span aria-hidden className="flex h-4 w-6 flex-col overflow-hidden rounded-[3px] shadow-[0_0_0_1px_#D4DBE4]">
      <span className="h-[5px] bg-[#1EB0D8]" />
      <span className="h-px bg-[#CE1126]" />
      <span className="h-1 bg-white" />
      <span className="h-px bg-[#CE1126]" />
      <span className="h-[5px] bg-[#1EB53A]" />
    </span>
  );
}

function LegalLink({ path, children }: { path: string; children: string }) {
  if (!SITE_URL) return <span className="font-bold text-iz-ink">{children}</span>;
  return (
    <a href={`${SITE_URL}${path}`} target="_blank" rel="noopener noreferrer" className="font-bold text-iz-green-text underline-offset-2 hover:underline">
      {children}
    </a>
  );
}

/** Login, step 1 (design: Main / KbMain): phone number → SMS code. */
export function PhoneScreen() {
  useStatusBar("light");
  const formRef = useRef<HTMLFormElement>(null);
  useLiftFloatingControl(formRef);
  const { t, locale } = useT();
  const navigate = useNavigate();
  const setPhone = useAuthStore((s) => s.setPhone);
  const [value, setValue] = useState(() => formatPhoneInput(useAuthStore.getState().phone.replace(/^\+998/, "")));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = value.replace(/\D/g, "");
  const isValid = digits.length === 9;
  const { min, max } = api.otpLength;

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const fullPhone = `+998 ${value}`;
      const res = await api.requestOtp(fullPhone);
      setPhone(fullPhone);
      navigate("/auth/otp", {
        state: { requestId: res.requestId, testCode: res.testCode, resendAfterSec: res.resendAfterSec, codeLength: res.codeLength, phone: fullPhone },
      });
    } catch (err) {
      const key = serverErrorKey(err);
      setError(key ? t(key as TranslationKey) : t("auth.otpSendError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-iz-head">
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-7 pt-[calc(var(--safe-top)+12px)] kb:pb-5">
        <div className="flex items-center justify-between">
          <Logo />
          <button
            type="button"
            onClick={() => navigate("/language")}
            aria-label={`${t("language.title")}: ${t(`language.name.${locale}` as TranslationKey)}`}
            className="flex h-11 items-center gap-2 rounded-full border border-iz-head-border px-3.5 text-[13px] font-bold text-iz-head-text active:opacity-70"
          >
            <Icon name="globe" size={18} className="text-iz-green" />
            {t(`language.name.${locale}` as TranslationKey)}
          </button>
        </div>
        <HeroArt from={t("auth.heroFrom")} to={t("auth.heroTo")} />
        <h1 className="mt-auto text-[32px] font-extrabold leading-10 text-iz-head-text kb:text-[24px] kb:leading-8">
          {t("auth.heroTitle")} <span className="text-iz-green">{t("auth.heroAccent")}</span>
        </h1>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="flex shrink-0 flex-col gap-4 rounded-t-iz-sheet bg-iz-sheet px-6 pb-[calc(max(var(--safe-bottom),16px)+12px)] pt-7 kb:gap-3.5 kb:pb-[calc(var(--kb-inset)+16px)] kb:pt-5"
      >
        <div className="flex flex-col gap-2.5">
          <label htmlFor="phone" className="text-[14px] font-bold text-iz-ink">
            {t("auth.phoneTitle")}
          </label>
          <div
            className={cn(
              "group flex h-[72px] items-center gap-3 rounded-[22px] border-2 bg-iz-field px-3 transition-[background,box-shadow]",
              "focus-within:border-iz-ink focus-within:bg-iz-field-focus focus-within:shadow-[0_0_0_4px_var(--iz-focus-ring)]",
              error ? "border-iz-danger" : "border-transparent"
            )}
          >
            <span className="flex h-11 shrink-0 items-center gap-2 rounded-iz-tile bg-iz-sheet px-3 text-[16px] font-extrabold text-iz-ink group-focus-within:bg-iz-field">
              <UzFlag />
              +998
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              autoFocus
              placeholder="90 123 45 67"
              value={value}
              onChange={(e) => setValue(formatPhoneInput(e.target.value))}
              aria-invalid={error ? true : undefined}
              aria-describedby="phone-hint"
              className="iz-input h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[20px] font-extrabold tracking-[1px] text-iz-ink outline-none placeholder:font-bold placeholder:text-iz-muted placeholder:opacity-60"
            />
          </div>
          {error ? (
            <span id="phone-hint" role="alert" className="text-[13px] font-semibold text-iz-danger">
              {error}
            </span>
          ) : (
            <span id="phone-hint" className="text-[13px] text-iz-muted kb:hidden">
              {min === max ? t("auth.phoneHint", { count: max }) : t("auth.phoneHintAny")}
            </span>
          )}
        </div>
        <PrimaryButton type="submit" disabled={!isValid} loading={loading}>
          {t("auth.getCode")}
        </PrimaryButton>
        <p className="text-center text-[12px] leading-[18px] text-iz-muted kb:hidden">
          {rich(t("auth.legal"), {
            terms: <LegalLink path="/terms">{t("auth.legalTerms")}</LegalLink>,
            privacy: <LegalLink path="/privacy">{t("auth.legalPrivacy")}</LegalLink>,
          })}
        </p>
      </form>
    </div>
  );
}
