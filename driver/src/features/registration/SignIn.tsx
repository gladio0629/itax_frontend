// Main (phone) and Otp (SMS code) screens of the redesign.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { DEMO_MODE } from "@/config";
import { TEST_PANEL_PATH } from "@/features/testPanel/paths";
import { testPanelText } from "@/features/testPanel/strings";
import { useT } from "@/lib/i18n/provider";
import { errorMessage } from "@/lib/errors";
import { waitReview } from "@/lib/waitReview";
import { ChevronLeft, Clock, FlaskConical, Globe, MessageSquare, Navigation } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "@/components/Button";
import { HeaderButton, useKeyboardOpen } from "@/components/Screen";
import { LanguageSheet } from "@/components/LanguageSheet";
import logoOnDark from "@/assets/izgo-logo-on-dark.png";
import { LegalSentence, useLegalLinks } from "./parts";

type OtpRequest = { requestId: string; testCode?: string; resendInSec: number; codeLength?: number };

/** Phone entry, then the code. `onVerified`: the session is signed in. */
/** The code screen is its own history entry (?otp=1): the phone's back button returns to the phone number. */
export function SignIn({ onVerified }: { onVerified: () => void }) {
  const [digits, setDigits] = useState("");
  const [otp, setOtp] = useState<OtpRequest | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const inOtp = new URLSearchParams(location.search).get("otp") === "1";
  useEffect(() => {
    // Reloaded on the code screen: the request is gone, start from the number.
    if (inOtp && !otp) navigate("/register", { replace: true });
  }, [inOtp, otp, navigate]);
  return otp && inOtp ? (
    <OtpScreen digits={digits} otp={otp} onResent={setOtp} onChangePhone={() => navigate(-1)} onVerified={onVerified} />
  ) : (
    <PhoneScreen
      digits={digits}
      setDigits={setDigits}
      onSent={(o) => {
        setOtp(o);
        navigate("/register?otp=1");
      }}
    />
  );
}

const formatPhone = (d: string) => [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
const maskPhone = (d: string) => `+998 ${d.slice(0, 2)} *** ** ${d.slice(7, 9)}`;
const TOP_PAD = "max(calc(var(--safe-top) + 12px), 56px)";

/** Uzbekistan flag chip in front of +998 (decorative). */
function UzFlag() {
  return (
    <span className="flex h-4 w-6 flex-col overflow-hidden rounded-[3px] shadow-[0_0_0_1px_#D4DBE4]" aria-hidden="true">
      <span className="h-[5px] bg-[#1EB0D8]" />
      <span className="h-px bg-[#CE1126]" />
      <span className="h-1 bg-white" />
      <span className="h-px bg-[#CE1126]" />
      <span className="h-[5px] bg-[#1EB53A]" />
    </span>
  );
}

/** Decorative route sketch on the Main screen (no data in it). Shrinks on short screens. */
function HeroSketch({ you }: { you: string }) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden" aria-hidden="true">
      {/* Short screens: an empty Ink area instead of a squeezed sketch. */}
      <div className="absolute bottom-0 left-0 aspect-[350/200] [@media(max-height:700px)]:hidden h-full max-h-[200px] max-w-full">
        <svg viewBox="0 0 350 200" preserveAspectRatio="xMinYMax meet" className="absolute inset-0 block h-full w-full">
          <circle cx="60" cy="150" r="32" fill="none" stroke="#17273B" strokeWidth="2" />
          <circle cx="60" cy="150" r="56" fill="none" stroke="#132032" strokeWidth="2" />
          <path d="M60 150 C 120 20, 240 10, 296 70" fill="none" stroke="#2EDB85" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 10" />
          <circle cx="60" cy="150" r="15" fill="#2EDB85" fillOpacity="0.25" />
          <circle cx="60" cy="150" r="7" fill="#2EDB85" />
          <g transform="rotate(-8 178 36)">
            <rect x="160" y="26" width="38" height="20" rx="8" fill="#FFFFFF" />
            <rect x="167" y="30" width="13" height="12" rx="3" fill="#0B1524" />
          </g>
          <circle cx="296" cy="70" r="13" fill="#FFFFFF" />
          <circle cx="296" cy="70" r="5" fill="#0B1524" />
        </svg>
        <span className="absolute bottom-[10%] left-[25%] flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full bg-night-2 px-3 text-13 font-bold text-white">
          <Navigation className="h-3.5 w-3.5 text-brand" />
          {you}
        </span>
      </div>
    </div>
  );
}

function PhoneScreen({ digits, setDigits, onSent }: { digits: string; setDigits: (d: string) => void; onSent: (o: OtpRequest) => void }) {
  const { t, locale } = useT();
  const compact = useKeyboardOpen();
  const links = useLegalLinks();
  const [langOpen, setLangOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      onSent(await api.requestOtp(digits));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-night">
      <div className="on-night flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 pb-7 text-white" style={{ paddingTop: compact ? "calc(var(--safe-top) + 12px)" : TOP_PAD }}>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <img src={logoOnDark} alt="IZGO" width={84} height={36} className="block h-9 w-[84px]" />
            <span className="flex h-[26px] items-center rounded-full bg-brand px-2.5 text-2xs font-extrabold tracking-[1px] text-on-brand">{t("reg.driverBadge")}</span>
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLangOpen(true)}
              className="press flex h-11 items-center gap-2 rounded-full border border-night-line px-3.5 text-13 font-bold"
            >
              <Globe className="h-[18px] w-[18px] text-brand" />
              {t(`settings.languageName.${locale}`)}
            </button>
          </span>
        </div>
        {compact ? <div className="flex-1" /> : <HeroSketch you={t("reg.heroYou")} />}
        <h1 className={cn("shrink-0 font-extrabold", compact ? "text-2xl" : "text-[32px] leading-10")}>
          {t("reg.heroLine1")} <span className="text-brand">{t("reg.heroLine2")}</span>
        </h1>
      </div>

      <form
        className="flex shrink-0 flex-col gap-4 rounded-t-sheet bg-bg px-6 pt-7"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 28px)" }}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex flex-col gap-2.5">
          <label htmlFor="phone" className="text-sm font-bold text-ink">
            {t("reg.phoneLabel")}
          </label>
          <div
            className={cn(
              "flex h-[72px] items-center gap-3 rounded-[22px] border-2 bg-raised px-3 transition-[background-color,border-color,box-shadow]",
              "focus-within:bg-surface focus-within:shadow-[0_0_0_4px_rgb(var(--color-brand-soft-rgb))]",
              error ? "border-danger" : "border-raised focus-within:border-[color:var(--color-focus)]"
            )}
          >
            <span className="flex h-11 shrink-0 items-center gap-2 rounded-tile bg-raised px-3 text-base font-extrabold text-ink ring-1 ring-line">
              <UzFlag />
              +998
            </span>
            <input
              id="phone"
              name="tel"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="90 123 45 67"
              value={formatPhone(digits)}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 9))}
              aria-invalid={error ? true : undefined}
              aria-describedby="phone-msg"
              className="tabular h-12 min-w-0 flex-1 bg-transparent text-xl font-extrabold tracking-[1px] text-ink outline-none placeholder:text-muted/60 focus-visible:outline-none"
            />
          </div>
          <span id="phone-msg" role={error ? "alert" : undefined} className={cn("text-13", error ? "font-semibold text-danger" : "text-muted")}>
            {error ?? t("reg.phoneHint")}
          </span>
        </div>
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={digits.length !== 9}>
          {t("reg.getCode")}
        </Button>
        {!compact && (
          <p className="text-center text-xs leading-[18px] text-muted">
            <LegalSentence template="reg.consent" termsKey="reg.consentTerms" privacyKey="reg.consentPrivacy" links={links} />
          </p>
        )}
        {DEMO_MODE && !compact && (
          <Link to={TEST_PANEL_PATH} className="press -my-2 mx-auto flex h-11 items-center gap-1.5 px-3 text-xs font-bold text-muted">
            <FlaskConical className="h-4 w-4" />
            {testPanelText(locale, "title")}
          </Link>
        )}
      </form>
      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />
    </div>
  );
}

// it, api.otpLength (fixed 4 with sample data; 4–6 with the real backend):
// the confirm button works from the minimum, typing all boxes submits.
const codeRange = (codeLength?: number) => (codeLength ? { min: codeLength, max: codeLength } : api.otpLength);
const emptyCode = (n: number) => Array<string>(n).fill("");

function OtpScreen({
  digits,
  otp,
  onResent,
  onChangePhone,
  onVerified,
}: {
  digits: string;
  otp: OtpRequest;
  onResent: (o: OtpRequest) => void;
  onChangePhone: () => void;
  onVerified: () => void;
}) {
  const { t } = useT();
  const compact = useKeyboardOpen();
  const { min: CODE_MIN, max: CODE_MAX } = codeRange(otp.codeLength);
  const [code, setCode] = useState<string[]>(() => emptyCode(CODE_MAX));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [resendIn, setResendIn] = useState(otp.resendInSec);
  const [focused, setFocused] = useState(0);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setCode(emptyCode(CODE_MAX));
    setResendIn(otp.resendInSec);
    const id = setTimeout(() => boxes.current[0]?.focus(), 50);
    return () => clearTimeout(id);
  }, [otp, CODE_MAX]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function verify(full: string) {
    setBusy(true);
    setError(undefined);
    try {
      const r = await waitReview(await api.verifyOtp(otp.requestId, full));
      if (r.status === "approved") return onVerified();
      throw { code: r.resultKey ?? "CODE_INVALID" };
    } catch (e) {
      setError(errorMessage(e, t));
      setCode(emptyCode(CODE_MAX));
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(undefined);
    try {
      onResent(await api.requestOtp(digits));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Paste / SMS autofill: spread across the boxes.
      const next = clean.slice(0, CODE_MAX).split("");
      while (next.length < CODE_MAX) next.push("");
      setCode(next);
      if (next.every(Boolean)) verify(next.join(""));
      else boxes.current[Math.min(clean.length, CODE_MAX - 1)]?.focus();
      return;
    }
    const next = [...code];
    next[i] = clean;
    setCode(next);
    if (clean && i < CODE_MAX - 1) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(""));
  }

  const entered = code.join("");
  const firstEmpty = code.indexOf("");
  const codeReady = entered.length >= CODE_MIN && (firstEmpty === -1 || entered.length === firstEmpty);
  const mmss = `${String(Math.floor(resendIn / 60)).padStart(2, "0")}:${String(resendIn % 60).padStart(2, "0")}`;

  return (
    <div className="flex h-full flex-col bg-night">
      <div className="on-night flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 pb-7 text-white" style={{ paddingTop: compact ? "calc(var(--safe-top) + 12px)" : TOP_PAD }}>
        <HeaderButton label={t("common.back")} onClick={onChangePhone}>
          <ChevronLeft className="h-5 w-5" />
        </HeaderButton>
        <div className="flex-1" />
        {!compact && (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-night-2 text-brand [@media(max-height:700px)]:hidden" aria-hidden="true">
            <MessageSquare className="h-7 w-7" />
          </span>
        )}
        <h1 className={cn("font-extrabold", compact ? "text-2xl" : "text-[32px] leading-10")}>{t("reg.codeTitle")}</h1>
        <p className={cn("text-15 leading-[23px] text-night-muted", compact && "sr-only")}>
          {t("reg.codeSent", { phone: "\u0000" })
            .split("\u0000")
            .map((part, i) =>
              i === 0 ? (
                <span key={i}>
                  {part}
                  <span className="tabular font-bold text-white">{maskPhone(digits)}</span>
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}{" "}
          <button type="button" onClick={onChangePhone} className="font-bold text-brand underline underline-offset-2">
            {t("common.edit")}
          </button>
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-[18px] rounded-t-sheet bg-bg px-6 pt-7" style={{ paddingBottom: "calc(var(--safe-bottom) + 28px)" }}>
        <div className="flex flex-col gap-2.5">
          <span id="otp-label" className="text-sm font-bold text-ink">
            {t("reg.codeLen", { n: CODE_MAX })}
          </span>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${CODE_MAX}, minmax(0, 1fr))` }} role="group" aria-labelledby="otp-label">
            {code.map((d, i) => (
              <input
                key={i}
                ref={(el) => (boxes.current[i] = el)}
                value={d}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={CODE_MAX}
                spellCheck={false}
                aria-label={t("reg.codeDigit", { n: i + 1 })}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "otp-msg" : undefined}
                disabled={busy}
                onFocus={() => setFocused(i)}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus();
                }}
                className={cn(
                  "tabular h-16 min-w-0 rounded-[18px] border-2 text-center text-2xl font-extrabold outline-none transition-colors focus-visible:outline-none",
                  d
                    ? "border-night bg-night text-white dark:border-night-line"
                    : focused === i
                      ? "border-[color:var(--color-focus)] bg-surface text-ink shadow-[0_0_0_4px_rgb(var(--color-brand-soft-rgb))]"
                      : "border-raised bg-raised text-ink",
                  error && "border-danger"
                )}
              />
            ))}
          </div>
          {error && (
            <p id="otp-msg" role="alert" className="text-13 font-semibold text-danger">
              {error}
            </p>
          )}
          {otp.testCode && <p className="tabular text-13 font-semibold text-brand-ink">{t("reg.testCode", { code: otp.testCode })}</p>}
        </div>
        <button
          type="button"
          onClick={resend}
          disabled={resendIn > 0 || busy}
          className="press flex h-14 items-center gap-3 rounded-[18px] bg-raised px-4 text-left disabled:cursor-default disabled:active:scale-100"
        >
          <Clock className="h-[18px] w-[18px] shrink-0 text-muted" />
          <span className={cn("flex-1 text-sm font-semibold", resendIn > 0 ? "text-muted" : "font-bold text-ink")}>{t("reg.resend")}</span>
          {resendIn > 0 && <span className="tabular text-15 font-extrabold text-ink">{mmss}</span>}
        </button>
        <Button size="lg" fullWidth loading={busy} disabled={!codeReady} onClick={() => verify(entered)}>
          {t("common.confirm")}
        </Button>
      </div>
    </div>
  );
}
