import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { DEMO_MODE } from "@/config";
import { TEST_PANEL_PATH } from "@/features/testPanel/paths";
import { testPanelText } from "@/features/testPanel/strings";
import type { CarClass, DocSlot, RegistrationOptions, SessionStage } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/stores/sessionStore";
import { Camera, Check, ChevronLeft, FileText, FlaskConical, IdCard } from "@/lib/icons";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { ReviewStatus } from "@/components/ReviewStatus";
import { Skeleton } from "@/components/Skeleton";
import { RoutesEditor } from "@/features/routes/RoutesEditor";
import { toast } from "@/lib/toast";
import type { Session } from "@/api/types";
import { cn } from "@/lib/cn";

const STEP_OF: Record<SessionStage, number> = { signed_out: 1, personal: 2, car: 3, documents: 4, review: 4, routes: 5, active: 5, blocked: 1 };
const ALL_STEP_KEYS = ["reg.step1", "reg.step2", "reg.step3", "reg.step4", "reg.step5"] as const;
// Without a routes endpoint there is no 5th step.
const STEP_KEYS = api.capabilities.routes ? ALL_STEP_KEYS : ALL_STEP_KEYS.slice(0, 4);

export default function RegistrationFlow() {
  const { t, locale } = useT();
  const session = useSession((s) => s.session);
  const setSession = useSession((s) => s.set);
  const refresh = useSession((s) => s.refresh);
  const navigate = useNavigate();
  const options = useQuery(() => api.getRegistrationOptions(), []);
  const [welcome, setWelcome] = useState(false);

  if (!session) return null;
  if (session.stage === "active" && !welcome) return <Navigate to="/" replace />;
  const step = STEP_OF[session.stage];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4" style={{ paddingTop: "calc(var(--safe-top) + 16px)" }}>
        <div className="flex items-center justify-between">
          <p className="tabular text-sm text-muted">{t("reg.step", { n: step })}</p>
          {DEMO_MODE && (
            <Link to={TEST_PANEL_PATH} className="press focus-inset -my-2 -mr-2 flex h-12 items-center gap-2 rounded-button px-3 text-sm font-medium text-muted">
              <FlaskConical className="h-5 w-5" />
              {testPanelText(locale, "title")}
            </Link>
          )}
        </div>
        <ol className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${STEP_KEYS.length}, minmax(0, 1fr))` }} aria-label={t("reg.title")}>
          {STEP_KEYS.map((k, i) => {
            const n = i + 1;
            const state = n < step || (welcome && n < 5) ? "done" : n === step ? "active" : "todo";
            return (
              <li key={k} aria-current={state === "active" ? "step" : undefined}>
                <span className="relative block h-1.5 overflow-hidden rounded-full bg-ink/10">
                  <span
                    className="absolute inset-0 origin-left bg-yellow transition-transform duration-[280ms]"
                    style={{ transform: `scaleX(${state === "todo" ? 0 : state === "active" ? 0.5 : 1})` }}
                  />
                </span>
                <span className={cn("mt-1.5 block truncate text-xs", state === "active" ? "font-bold text-ink" : "text-muted")}>{t(k)}</span>
              </li>
            );
          })}
        </ol>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div key={session.stage + String(welcome)} className="flex min-h-full animate-fade-up flex-col px-4 pb-6 pt-6">
          {session.notice === "rejected" && !welcome && session.stage !== "review" && (
            <p role="alert" className="mb-5 rounded-button bg-danger/10 px-3 py-2 text-sm text-ink">
              {t("reg.rejectedNotice")}
            </p>
          )}
          {welcome ? (
            <Welcome onDone={() => (session.stage === "routes" ? setWelcome(false) : navigate("/", { replace: true }))} />
          ) : session.stage === "blocked" ? (
            <Blocked onSignedOut={setSession} />
          ) : session.stage === "signed_out" ? (
            <PhoneStep onVerified={() => refresh()} />
          ) : !options.data ? (
            <Skeleton className="h-64 rounded-card" />
          ) : session.stage === "personal" ? (
            <PersonalStep options={options.data} onSaved={setSession} />
          ) : session.stage === "car" ? (
            <CarStep options={options.data} onSaved={setSession} />
          ) : session.stage === "documents" ? (
            <DocsStep real={!!options.data.realDocuments} onSubmitted={() => refresh()} />
          ) : session.stage === "routes" ? (
            <RoutesStep
              onDone={(next) => {
                setSession(next);
                navigate("/", { replace: true });
              }}
            />
          ) : session.stage === "review" && session.documentsReviewId ? (
            <div className="flex flex-1 flex-col justify-center">
              <ReviewStatus
                reviewId={session.documentsReviewId}
                title={t("reg.reviewTitle")}
                description={options.data?.realDocuments ? t("reg.pendingDesc") : t("reg.reviewDesc")}
                onApproved={() => {
                  setWelcome(true);
                  refresh();
                }}
                onRejected={() => refresh()}
              />
            </div>
          ) : session.stage === "review" ? (
            <div className="flex flex-1 flex-col justify-center">
              <StepTitle title={t("reg.reviewTitle")} desc={t("reg.pendingDesc")} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {desc && <p className="mt-2 text-base text-muted">{desc}</p>}
    </div>
  );
}

function BottomAction({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto space-y-1 pt-8">{children}</div>;
}

// ---------- Step 1: phone + OTP ----------

// SMS code length: fixed 4 with sample data; 4–6 with the real backend (the
// confirm button works from CODE_MIN, typing all CODE_MAX digits submits).
const { min: CODE_MIN, max: CODE_MAX } = api.otpLength;
const emptyCode = () => Array<string>(CODE_MAX).fill("");

function PhoneStep({ onVerified }: { onVerified: () => void }) {
  const { t } = useT();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<{ requestId: string; testCode?: string; resendInSec: number } | null>(null);
  const [code, setCode] = useState<string[]>(emptyCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const digits = phone.replace(/\D/g, "");

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  function formatPhone(d: string) {
    const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
    return p.join(" ");
  }

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await api.requestOtp(digits);
      setOtp(r);
      setResendIn(r.resendInSec);
      setCode(emptyCode());
      setTimeout(() => boxes.current[0]?.focus(), 50);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function verify(full: string) {
    if (!otp) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await api.verifyOtp(otp.requestId, full);
      setReviewId(r.id);
    } catch (e) {
      setError(errorMessage(e, t));
      setCode(emptyCode());
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Paste: spread across boxes.
      const next = clean.slice(0, CODE_MAX).split("");
      while (next.length < CODE_MAX) next.push("");
      setCode(next);
      if (next.every(Boolean)) verify(next.join(""));
      return;
    }
    const next = [...code];
    next[i] = clean;
    setCode(next);
    if (clean && i < CODE_MAX - 1) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(""));
  }

  const entered = code.join("");
  // Valid when the filled boxes are an unbroken prefix of at least CODE_MIN digits.
  const firstEmpty = code.indexOf("");
  const codeReady = entered.length >= CODE_MIN && (firstEmpty === -1 || entered.length === firstEmpty);

  if (reviewId) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <ReviewStatus reviewId={reviewId} title={t("reg.verifying")} description={t("reg.verifyingDesc")} onApproved={onVerified} onRejected={() => setReviewId(null)} />
      </div>
    );
  }

  if (otp) {
    return (
      <>
        <button type="button" onClick={() => setOtp(null)} className="press -ml-3 mb-2 flex h-12 items-center gap-1 rounded-button px-2 text-sm font-medium text-muted">
          <ChevronLeft className="h-5 w-5" />
          {t("reg.changePhone")}
        </button>
        <StepTitle title={t("reg.codeTitle")} desc={t("reg.codeDesc", { phone: formatPhone(digits) })} />
        <div className={cn("flex justify-center", CODE_MAX > 4 ? "gap-2" : "gap-3")} role="group" aria-label={t("reg.codeTitle")}>
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
              disabled={busy}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus();
              }}
              className={cn(
                CODE_MAX > 4 ? "w-11" : "w-14",
                "tabular h-16 rounded-button bg-raised text-center text-2xl font-bold text-ink outline-none focus-visible:outline-none focus:ring-2 focus:ring-inset",
                error ? "ring-2 ring-inset ring-danger" : "focus:ring-yellow"
              )}
            />
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-danger">
            {error}
          </p>
        )}
        {otp.testCode && <p className="tabular mt-6 text-center text-sm text-gold">{t("reg.testCode", { code: otp.testCode })}</p>}
        <BottomAction>
          {CODE_MIN < CODE_MAX && (
            <Button fullWidth className="mb-2" loading={busy} disabled={!codeReady} onClick={() => verify(entered)}>
              {t("common.confirm")}
            </Button>
          )}
          <Button variant="ghost" fullWidth disabled={resendIn > 0 || busy} onClick={send}>
            {resendIn > 0 ? t("reg.resendIn", { n: resendIn }) : t("reg.resend")}
          </Button>
        </BottomAction>
      </>
    );
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <StepTitle title={t("reg.welcome")} desc={t("reg.welcomeDesc")} />
      <TextField
        label={t("reg.phone")}
        prefix="+998"
        name="tel"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="90 123 45 67"
        value={formatPhone(digits)}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
        error={error}
        className="[&_input]:tabular"
      />
      <BottomAction>
        <Button type="submit" size="lg" fullWidth loading={busy}>
          {t("reg.sendCode")}
        </Button>
      </BottomAction>
    </form>
  );
}

// ---------- Step 2: personal ----------

function PersonalStep({ options, onSaved }: { options: RegistrationOptions; onSaved: (s: Awaited<ReturnType<typeof api.savePersonal>>) => void }) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; msg: string } | null>(null);
  const fieldCodes = ["NAME_INVALID", "BIRTH_DATE_INVALID"];

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.savePersonal({ name, cityId, birthDate: options.askBirthDate ? birthDate : undefined }));
    } catch (e) {
      setError({ code: (e as { code?: string }).code, msg: errorMessage(e, t) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <StepTitle title={t("reg.personalTitle")} desc={t("reg.personalDesc")} />
      <TextField
        label={t("personal.name")}
        name="name"
        autoComplete="name"
        placeholder={t("reg.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error?.code === "NAME_INVALID" ? error.msg : undefined}
        hint={options.askBirthDate ? t("reg.lastNameHint") : undefined}
      />
      {options.askBirthDate && (
        <TextField
          className="mt-5"
          label={t("reg.birthDate")}
          name="bday"
          type="date"
          autoComplete="bday"
          max={new Date().toISOString().slice(0, 10)}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          error={error?.code === "BIRTH_DATE_INVALID" ? error.msg : undefined}
        />
      )}
      <fieldset className="mt-6">
        <legend className="mb-2 text-sm text-muted">{t("reg.city")}</legend>
        <div className="flex flex-wrap gap-2">
          {options.cities.map((c) => (
            <Chip key={c.id} selected={cityId === c.id} onClick={() => setCityId(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      </fieldset>
      {error && !fieldCodes.includes(error.code ?? "") && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.msg}
        </p>
      )}
      <BottomAction>
        <Button type="submit" size="lg" fullWidth loading={busy}>
          {t("common.continue")}
        </Button>
      </BottomAction>
    </form>
  );
}

// ---------- Step 3: car ----------

function CarStep({ options, onSaved }: { options: RegistrationOptions; onSaved: (s: Awaited<ReturnType<typeof api.saveCar>>) => void }) {
  const { t } = useT();
  const [model, setModel] = useState("");
  const [colorKey, setColorKey] = useState("");
  const [plate, setPlate] = useState("");
  const [year, setYear] = useState(options.years[3]);
  const [carClass, setCarClass] = useState<CarClass | undefined>(undefined);
  const [seats, setSeats] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; msg: string } | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.saveCar({ model, colorKey, plate, year, carClass, seats }));
    } catch (e) {
      setError({ code: (e as { code?: string }).code, msg: errorMessage(e, t) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <StepTitle title={t("reg.carTitle")} desc={t("reg.carDesc")} />
      <label htmlFor="car-model" className="mb-2 block text-sm text-muted">
        {t("personal.carModel")}
      </label>
      <select
        id="car-model"
        name="model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="h-14 w-full appearance-none rounded-button bg-raised px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow focus-visible:outline-none"
      >
        <option value="" disabled>
          —
        </option>
        {options.carModels.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm text-muted">{t("personal.carColor")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {options.carColors.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={colorKey === c.key}
              onClick={() => setColorKey(c.key)}
              className={cn("press flex h-12 items-center gap-2 rounded-button pl-2 pr-4 text-sm", colorKey === c.key ? "bg-yellow text-on-yellow" : "bg-raised text-ink")}
            >
              <span aria-hidden="true" className="h-8 w-8 rounded-button ring-2 ring-inset ring-black/15" style={{ background: c.hex }} />
              {t(`color.${c.key}` as never)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <TextField
          label={t("personal.plate")}
          name="plate"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t("reg.platePlaceholder")}
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase().slice(0, 11))}
          error={error?.code === "PLATE_INVALID" ? error.msg : undefined}
          className="[&_input]:tabular [&_input]:uppercase"
        />
        <div>
          <label htmlFor="car-year" className="mb-2 block text-sm text-muted">
            {t("personal.year")}
          </label>
          <select
            id="car-year"
            name="year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="tabular h-14 w-24 appearance-none rounded-button bg-raised px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow focus-visible:outline-none"
          >
            {options.years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {options.carClasses && (
        <fieldset className="mt-5">
          <legend className="mb-2 text-sm text-muted">{t("reg.carClass")}</legend>
          <div className="flex flex-wrap gap-2">
            {options.carClasses.map((c) => (
              <Chip key={c} selected={carClass === c} onClick={() => setCarClass(c)}>
                {t(`carClass.${c}`)}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
      {options.seatCounts && (
        <fieldset className="mt-5">
          <legend className="mb-2 text-sm text-muted">{t("reg.seats")}</legend>
          <div className="flex flex-wrap gap-2">
            {options.seatCounts.map((n) => (
              <Chip key={n} selected={seats === n} onClick={() => setSeats(n)} className="tabular min-w-12 justify-center">
                {n}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
      {error && error.code !== "PLATE_INVALID" && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.msg}
        </p>
      )}
      <BottomAction>
        <Button type="submit" size="lg" fullWidth loading={busy}>
          {t("common.continue")}
        </Button>
      </BottomAction>
    </form>
  );
}

// ---------- Step 4: documents ----------

type Upload = { name: string | null; ref: string | null; uploading: boolean };
const EMPTY_UPLOAD: Upload = { name: null, ref: null, uploading: false };

/**
 * `real`: the backend needs real photos (jpeg/png ≤ 10 MB, uploaded to a
 * signed URL), a selfie and the terms checkbox. Otherwise the sample-data
 * adapter "uploads" a placeholder without a file picker.
 */
function DocsStep({ real, onSubmitted }: { real: boolean; onSubmitted: () => void }) {
  const { t } = useT();
  const slots: DocSlot[] = real ? ["license", "registration", "selfie"] : ["license", "registration"];
  const [files, setFiles] = useState<Record<DocSlot, Upload>>({ license: EMPTY_UPLOAD, registration: EMPTY_UPLOAD, selfie: EMPTY_UPLOAD });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<DocSlot, HTMLInputElement | null>>>({});

  async function upload(slot: DocSlot, file: File | null) {
    setError(null);
    setFiles((f) => ({ ...f, [slot]: { ...f[slot], uploading: true } }));
    try {
      const r = await api.uploadDocument(slot, file);
      setFiles((f) => ({ ...f, [slot]: { name: r.name, ref: r.ref, uploading: false } }));
    } catch (e) {
      setFiles((f) => ({ ...f, [slot]: { ...f[slot], uploading: false } }));
      setError(errorMessage(e, t));
    }
  }

  function pick(slot: DocSlot) {
    if (real) inputs.current[slot]?.click();
    else upload(slot, null);
  }

  const uploadingAny = slots.some((s) => files[s].uploading);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.submitDocuments({
        licenseFile: files.license.ref ?? "",
        registrationFile: files.registration.ref ?? "",
        selfieFile: real ? files.selfie.ref ?? "" : undefined,
        acceptTerms: real ? terms : undefined,
      });
      onSubmitted();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <StepTitle title={t("reg.docsTitle")} desc={t("reg.docsDesc")} />
      <div className="space-y-3">
        {slots.map((slot) => {
          const f = files[slot];
          const Icon = slot === "license" ? IdCard : slot === "selfie" ? Camera : FileText;
          const label = slot === "selfie" ? t("reg.selfie") : t(`personal.doc.${slot}`);
          return (
            <div key={slot} className="rounded-card bg-surface p-4 shadow-1">
              <div className="flex items-center gap-3">
                <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-button", f.name ? "bg-success text-bg" : "bg-raised text-muted")}>
                  {f.name ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-ink">{label}</p>
                  <p className="truncate text-sm text-muted" aria-live="polite">
                    {f.uploading ? t("common.loading") : f.name ? t("reg.uploaded", { name: f.name }) : real ? t("reg.pickFile") : t("personal.docStatus.none")}
                  </p>
                </div>
              </div>
              {f.uploading && (
                <span className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 w-1/3 animate-shimmer rounded-full bg-yellow" />
                </span>
              )}
              {real && (
                <input
                  ref={(el) => (inputs.current[slot] = el)}
                  type="file"
                  accept="image/jpeg,image/png"
                  capture={slot === "selfie" ? "user" : "environment"}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (file) upload(slot, file);
                  }}
                />
              )}
              <Button variant="secondary" fullWidth className="mt-3" disabled={f.uploading || busy} onClick={() => pick(slot)}>
                <Camera className="h-5 w-5" />
                {f.name ? t("reg.replace") : t("reg.upload")}
              </Button>
            </div>
          );
        })}
      </div>
      {real && (
        <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 text-base text-ink">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="h-6 w-6 shrink-0 accent-yellow" />
          {t("reg.terms")}
        </label>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <BottomAction>
        <Button size="lg" fullWidth loading={busy} disabled={uploadingAny || (real && !terms)} onClick={submit}>
          {t("reg.submitDocs")}
        </Button>
      </BottomAction>
    </div>
  );
}

// ---------- Step 5: Yo'nalishlarim (first run) ----------

function RoutesStep({ onDone }: { onDone: (s: Session) => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  async function finish() {
    setBusy(true);
    try {
      onDone(await api.completeRoutesSetup());
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <StepTitle title={t("routes.setupTitle")} desc={t("routes.setupDesc")} />
      <RoutesEditor />
      <BottomAction>
        <Button size="lg" fullWidth loading={busy} onClick={finish}>
          {t("routes.setupDone")}
        </Button>
      </BottomAction>
    </>
  );
}

/** The server says the account is blocked: nothing to do here but sign out. */
function Blocked({ onSignedOut }: { onSignedOut: (s: Session) => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-1 flex-col" role="alert">
      <StepTitle title={t("reg.blockedTitle")} desc={t("reg.blockedDesc")} />
      <BottomAction>
        <Button
          size="lg"
          variant="secondary"
          fullWidth
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              onSignedOut(await api.logout());
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("profile.logout")}
        </Button>
      </BottomAction>
    </div>
  );
}

function Welcome({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  useEffect(() => {
    const id = setTimeout(onDone, 2200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center" role="status">
      <span className="mb-6 flex h-24 w-24 animate-check-pop items-center justify-center rounded-full bg-yellow text-on-yellow shadow-2">
        <Check className="h-11 w-11" />
      </span>
      <h1 className="text-2xl font-bold text-ink">{t("reg.approvedTitle")}</h1>
      <p className="mt-2 max-w-[280px] text-base text-muted">{t("reg.approvedDesc")}</p>
      <BottomAction>
        <Button size="lg" fullWidth onClick={onDone} className="min-w-[280px]">
          {t("common.continue")}
        </Button>
      </BottomAction>
    </div>
  );
}
