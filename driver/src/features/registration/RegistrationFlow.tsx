import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { RegistrationOptions, SessionStage } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/stores/sessionStore";
import { Camera, Check, ChevronLeft, IdCard, FileText } from "@/lib/icons";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { ReviewStatus } from "@/components/ReviewStatus";
import { DemoBadge } from "@/components/DemoBadge";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

const STEP_OF: Record<SessionStage, number> = { signed_out: 1, personal: 2, car: 3, documents: 4, review: 4, active: 4 };
const STEP_KEYS = ["reg.step1", "reg.step2", "reg.step3", "reg.step4"] as const;

export default function RegistrationFlow() {
  const { t } = useT();
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
          <DemoBadge />
        </div>
        <ol className="mt-3 grid grid-cols-4 gap-2" aria-label={t("reg.title")}>
          {STEP_KEYS.map((k, i) => {
            const n = i + 1;
            const state = n < step || welcome ? "done" : n === step ? "active" : "todo";
            return (
              <li key={k} aria-current={state === "active" ? "step" : undefined}>
                <span className="relative block h-1.5 overflow-hidden rounded-full bg-ink/10">
                  <span
                    className="absolute inset-0 origin-left bg-yellow transition-transform duration-[400ms]"
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
          {welcome ? (
            <Welcome onDone={() => navigate("/", { replace: true })} />
          ) : session.stage === "signed_out" ? (
            <PhoneStep onVerified={() => refresh()} />
          ) : !options.data ? (
            <Skeleton className="h-64 rounded-card" />
          ) : session.stage === "personal" ? (
            <PersonalStep options={options.data} onSaved={setSession} />
          ) : session.stage === "car" ? (
            <CarStep options={options.data} onSaved={setSession} />
          ) : session.stage === "documents" ? (
            <DocsStep onSubmitted={() => refresh()} />
          ) : session.stage === "review" && session.documentsReviewId ? (
            <div className="flex flex-1 flex-col justify-center">
              <ReviewStatus
                reviewId={session.documentsReviewId}
                title={t("reg.reviewTitle")}
                description={t("reg.reviewDesc")}
                onApproved={() => {
                  setWelcome(true);
                  refresh();
                }}
              />
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

function PhoneStep({ onVerified }: { onVerified: () => void }) {
  const { t } = useT();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<{ requestId: string; demoCode: string; resendInSec: number } | null>(null);
  const [code, setCode] = useState(["", "", "", ""]);
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
      setCode(["", "", "", ""]);
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
      setCode(["", "", "", ""]);
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Paste: spread across boxes.
      const next = clean.slice(0, 4).split("");
      while (next.length < 4) next.push("");
      setCode(next);
      if (next.every(Boolean)) verify(next.join(""));
      return;
    }
    const next = [...code];
    next[i] = clean;
    setCode(next);
    if (clean && i < 3) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(""));
  }

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
        <div className="flex justify-center gap-3" role="group" aria-label={t("reg.codeTitle")}>
          {code.map((d, i) => (
            <input
              key={i}
              ref={(el) => (boxes.current[i] = el)}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={4}
              aria-label={t("reg.codeDigit", { n: i + 1 })}
              aria-invalid={error ? true : undefined}
              disabled={busy}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus();
              }}
              className={cn(
                "tabular h-16 w-14 rounded-button bg-raised text-center text-2xl font-bold text-ink outline-none focus-visible:outline-none focus:ring-2 focus:ring-inset",
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
        <p className="tabular mt-6 text-center text-sm text-gold">{t("reg.demoCode", { code: otp.demoCode })}</p>
        <BottomAction>
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
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={digits.length !== 9}>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; msg: string } | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.savePersonal({ name, cityId }));
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
      />
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
      {error && error.code !== "NAME_INVALID" && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.msg}
        </p>
      )}
      <BottomAction>
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={!name.trim() || !cityId}>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; msg: string } | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.saveCar({ model, colorKey, plate, year }));
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
              className={cn("press flex h-12 items-center gap-2 rounded-full pl-2 pr-4 text-sm", colorKey === c.key ? "bg-yellow text-on-yellow" : "bg-raised text-ink")}
            >
              <span aria-hidden="true" className="h-8 w-8 rounded-full ring-2 ring-inset ring-black/15" style={{ background: c.hex }} />
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
      {error && error.code !== "PLATE_INVALID" && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.msg}
        </p>
      )}
      <BottomAction>
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={!model || !colorKey || !plate.trim()}>
          {t("common.continue")}
        </Button>
      </BottomAction>
    </form>
  );
}

// ---------- Step 4: documents ----------

type Upload = { name: string | null; progress: number };

function DocsStep({ onSubmitted }: { onSubmitted: () => void }) {
  const { t } = useT();
  const [files, setFiles] = useState<Record<"license" | "registration", Upload>>({
    license: { name: null, progress: 0 },
    registration: { name: null, progress: 0 },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearInterval), []);

  function pick(kind: "license" | "registration") {
    // Simulated picker: a fake file "uploads" locally in under a second.
    const name = `${kind === "license" ? "guvohnoma" : "texpasport"}_${Math.floor(1000 + Math.random() * 9000)}.jpg`;
    setFiles((f) => ({ ...f, [kind]: { name: null, progress: 0.05 } }));
    let p = 0.05;
    const id = window.setInterval(() => {
      p = Math.min(1, p + 0.2);
      setFiles((f) => ({ ...f, [kind]: { name: p >= 1 ? name : null, progress: p } }));
      if (p >= 1) clearInterval(id);
    }, 140);
    timers.current.push(id);
  }

  async function submit() {
    if (!files.license.name || !files.registration.name) return;
    setBusy(true);
    setError(null);
    try {
      await api.submitDocuments({ licenseFile: files.license.name, registrationFile: files.registration.name });
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
        {(["license", "registration"] as const).map((kind) => {
          const f = files[kind];
          const Icon = kind === "license" ? IdCard : FileText;
          const uploading = !f.name && f.progress > 0;
          return (
            <div key={kind} className="rounded-card bg-surface p-4 shadow-1">
              <div className="flex items-center gap-3">
                <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-button", f.name ? "bg-success text-bg" : "bg-raised text-muted")}>
                  {f.name ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-ink">{t(`personal.doc.${kind}`)}</p>
                  <p className="truncate text-sm text-muted" aria-live="polite">
                    {f.name ? t("reg.uploaded", { name: f.name }) : uploading ? t("common.loading") : t("personal.docStatus.none")}
                  </p>
                </div>
              </div>
              {uploading && (
                <span className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                  <span className="absolute inset-0 origin-left bg-yellow transition-transform duration-150" style={{ transform: `scaleX(${f.progress})` }} />
                </span>
              )}
              <Button variant="secondary" fullWidth className="mt-3" disabled={uploading || busy} onClick={() => pick(kind)}>
                <Camera className="h-5 w-5" />
                {f.name ? t("reg.replace") : t("reg.upload")}
              </Button>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <BottomAction>
        <Button size="lg" fullWidth loading={busy} disabled={!files.license.name || !files.registration.name} onClick={submit}>
          {t("reg.submitDocs")}
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
