// Building blocks shared by the registration screens (redesign v2).
import { Fragment, useId, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { SITE_URL } from "@/config";
import type { DocSlot, LegalLinks } from "@/api/types";
import { Calendar, Camera, Check, ChevronLeft, ChevronRight, HelpCircle } from "@/lib/icons";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { HeaderButton, Screen, useKeyboardOpen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { Spinner } from "@/components/Spinner";

export const REG_TOTAL_STEPS = 4;

/**
 * Registration screen: Ink top with back / "N-qadam, 4 dan" / help, the
 * four-segment progress, title and hint; the form on the sheet and the main
 * button pinned under it. With the keyboard open only the title stays.
 */
export function RegShell({
  step,
  onBack,
  showHelp,
  title,
  desc,
  notice,
  footer,
  children,
}: {
  step?: number;
  onBack?: () => void;
  showHelp?: boolean;
  title: string;
  desc?: string;
  notice?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useT();
  const navigate = useNavigate();
  const compact = useKeyboardOpen();
  const spacer = <span className="h-11 w-11 shrink-0" aria-hidden="true" />;
  return (
    <Screen
      header={
        <div className="flex flex-col gap-[18px]">
          {(step || onBack || showHelp) && (
            <div className="flex items-center justify-between gap-3">
              {onBack ? (
                <HeaderButton label={t("common.back")} onClick={onBack}>
                  <ChevronLeft className="h-5 w-5" />
                </HeaderButton>
              ) : (
                spacer
              )}
              {step ? <span className="tabular text-13 font-bold text-night-muted">{t("reg.stepOf", { n: step, total: REG_TOTAL_STEPS })}</span> : <span />}
              {showHelp && api.capabilities.help ? (
                <HeaderButton label={t("help.title")} onClick={() => navigate("/register/help")}>
                  <HelpCircle className="h-5 w-5" />
                </HeaderButton>
              ) : (
                spacer
              )}
            </div>
          )}
          {step && !compact && (
            <div className="flex gap-1.5" aria-hidden="true">
              {Array.from({ length: REG_TOTAL_STEPS }, (_, i) => (
                <span key={i} className={cn("h-1 flex-1 rounded-full", i < step ? "bg-brand" : "bg-night-line")} />
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <h1 className={cn("font-extrabold", compact ? "text-xl" : "text-[28px] leading-[34px]")}>{title}</h1>
            {desc && !compact && <p className="text-sm leading-[21px] text-night-muted">{desc}</p>}
          </div>
        </div>
      }
      footer={footer}
    >
      <div className="flex flex-col gap-3 pb-2">
        {notice}
        {children}
      </div>
    </Screen>
  );
}

/** Red note at the top of the sheet (rejected application, form error). */
export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-field bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
      {children}
    </p>
  );
}

/** Small caps heading inside the form. */
export function FieldLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span id={id} className="label-caps pt-1 text-muted">
      {children}
    </span>
  );
}

/** Field-shaped button that opens a list in a bottom sheet (city, make, year…). */
export function PickerField<V extends string | number>({
  label,
  sheetTitle,
  value,
  options,
  onChange,
  placeholder,
  icon,
  disabled,
  error,
  className,
}: {
  label: string;
  sheetTitle?: string;
  value: V | undefined;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  placeholder?: string;
  icon?: ReactNode;
  disabled?: boolean;
  error?: string;
  className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  const current = options.find((o) => o.value === value);
  return (
    <div className={cn("min-w-0", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-labelledby={`${id}-l ${id}-v`}
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen(true)}
        className={cn(
          "press focus-inset flex min-h-[68px] w-full min-w-0 items-center gap-3 rounded-field border-2 bg-raised px-4 py-2.5 text-left disabled:opacity-50",
          error ? "border-danger" : "border-raised"
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span id={`${id}-l`} className="label-caps text-muted">
            {label}
          </span>
          <span id={`${id}-v`} className={cn("truncate text-base font-bold", current ? "text-ink" : "text-muted/70")}>
            {current?.label ?? placeholder ?? t("reg.choose")}
          </span>
        </span>
        <span className="flex shrink-0 text-muted">{icon ?? <ChevronRight className="h-[18px] w-[18px]" />}</span>
      </button>
      {error && (
        <p role="alert" className="mt-2 px-1 text-13 font-semibold text-danger">
          {error}
        </p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={sheetTitle ?? label}>
        <div className="flex flex-col pb-2" role="radiogroup" aria-label={sheetTitle ?? label}>
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="press focus-inset flex min-h-[56px] items-center justify-between gap-3 border-b border-line text-left last:border-b-0"
            >
              <span className="text-15 font-bold text-ink">{o.label}</span>
              {o.value === value && <Check className="h-5 w-5 text-brand-ink" />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/** Date field (YYYY-MM-DD value) in the field shape, calendar icon on the right. */
export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  error,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  error?: string;
  autoComplete?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "flex min-h-[68px] items-center gap-2 rounded-field border-2 bg-raised px-4 py-2.5",
          "focus-within:bg-surface focus-within:shadow-[0_0_0_4px_rgb(var(--color-brand-soft-rgb))]",
          error ? "border-danger" : "border-raised focus-within:border-[color:var(--color-focus)]"
        )}
        onClick={() => {
          ref.current?.focus();
          try {
            ref.current?.showPicker?.();
          } catch {
            /* not allowed here: typing still works */
          }
        }}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <label htmlFor={id} className="label-caps truncate text-muted">
            {label}
          </label>
          <input
            ref={ref}
            id={id}
            type="date"
            value={value}
            min={min}
            max={max}
            autoComplete={autoComplete}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange(e.target.value)}
            className="tabular h-6 w-full min-w-0 bg-transparent text-base font-bold text-ink outline-none focus-visible:outline-none [&::-webkit-calendar-picker-indicator]:hidden"
          />
        </span>
        <Calendar className="h-[18px] w-[18px] shrink-0 text-muted" />
      </div>
      {error && (
        <p role="alert" className="mt-2 px-1 text-13 font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- uploads

export type Upload = { ref: string; name: string; preview?: string };
type SlotState = { upload?: Upload; busy: boolean };

/**
 * Document photos for one screen. `real`: a hidden file input per slot
 * (camera first on phones); otherwise the sample-data adapter's simulated
 * picker. Done uploads are reported to `onUploaded` so going back to a step
 * keeps them.
 */
export function useDocUploads(
  slots: DocSlot[],
  initial: Partial<Record<DocSlot, Upload>>,
  real: boolean,
  onUploaded: (slot: DocSlot, upload: Upload) => void
) {
  const { t } = useT();
  const [state, setState] = useState<Partial<Record<DocSlot, SlotState>>>(() =>
    Object.fromEntries(slots.map((s) => [s, { upload: initial[s], busy: false }]))
  );
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<DocSlot, HTMLInputElement | null>>>({});

  async function upload(slot: DocSlot, file: File | null) {
    setError(null);
    setState((s) => ({ ...s, [slot]: { ...s[slot], busy: true } }));
    try {
      const r = await api.uploadDocument(slot, file);
      const u: Upload = { ref: r.ref, name: r.name, preview: file ? URL.createObjectURL(file) : undefined };
      setState((s) => ({ ...s, [slot]: { upload: u, busy: false } }));
      onUploaded(slot, u);
    } catch (e) {
      setState((s) => ({ ...s, [slot]: { ...s[slot], busy: false } }));
      setError(errorMessage(e, t));
    }
  }

  const pick = (slot: DocSlot) => (real ? inputs.current[slot]?.click() : upload(slot, null));

  const fileInputs = real ? (
    <>
      {slots.map((slot) => (
        <input
          key={slot}
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
      ))}
    </>
  ) : null;

  const busy = slots.some((s) => state[s]?.busy);
  const get = (slot: DocSlot) => state[slot] ?? { busy: false };
  return { get, pick, busy, error, fileInputs };
}

/** Sample picture for a "photo" taken with the simulated picker. */
function DocIllustration() {
  return (
    <span className="absolute inset-0 bg-gradient-to-br from-ph-1 to-ph-2" aria-hidden="true">
      <span className="absolute left-3 top-3.5 h-[38px] w-[30px] rounded-md bg-ph-3" />
      <span className="absolute left-[52px] top-[18px] h-1.5 w-[70px] max-w-[45%] rounded-full bg-ph-3" />
      <span className="absolute left-[52px] top-8 h-1.5 w-[50px] max-w-[35%] rounded-full bg-ph-3" />
    </span>
  );
}

/** A photo slot: dashed "Rasmga olish" until uploaded, then the picture with a green check. */
export function PhotoTile({
  label,
  status,
  upload,
  busy,
  onPick,
  disabled,
}: {
  label: string;
  /** Overrides the status line (e.g. "1 / 2 yuklandi"). */
  status?: { text: string; done: boolean };
  upload?: Upload;
  busy: boolean;
  onPick: () => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const done = status?.done ?? !!upload;
  const statusText = busy ? t("common.loading") : status?.text ?? (upload ? t("reg.photoUploaded") : t("reg.photoNeeded"));
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || busy}
      className="press focus-inset flex min-w-0 flex-1 flex-col gap-2.5 rounded-field bg-raised p-2.5 text-left disabled:opacity-60"
    >
      {upload || done ? (
        <span className="relative block h-[92px] overflow-hidden rounded-2xl">
          {upload?.preview ? <img src={upload.preview} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <DocIllustration />}
          <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-on-brand">
            {busy ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          </span>
        </span>
      ) : (
        <span className="flex h-[92px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-dash text-muted">
          {busy ? <Spinner className="h-5 w-5" /> : <Camera className="h-5 w-5 text-ink" />}
          <span className="text-xs font-bold">{t("reg.photoTake")}</span>
        </span>
      )}
      <span className="flex flex-col gap-0.5 px-1">
        <span className="text-sm font-bold text-ink">{label}</span>
        <span className={cn("text-xs font-semibold", done && !busy ? "text-brand-ink" : "text-muted")} aria-live="polite">
          {statusText}
        </span>
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ legal

/** Terms and privacy pages on the public website (VITE_SITE_URL); none when it isn't set. */
export function useLegalLinks(): LegalLinks {
  return SITE_URL ? { termsUrl: `${SITE_URL}/terms`, privacyUrl: `${SITE_URL}/privacy` } : {};
}

/**
 * A translated sentence with {{terms}} and {{privacy}} placeholders: each
 * becomes a link that opens in the system browser, or bold text when the
 * server gave no address.
 */
export function LegalSentence({
  template,
  termsKey,
  privacyKey,
  links,
  className,
}: {
  template: TranslationKey;
  termsKey: TranslationKey;
  privacyKey: TranslationKey;
  links: LegalLinks;
  className?: string;
}) {
  const { t } = useT();
  const parts = t(template).split(/(\{\{terms\}\}|\{\{privacy\}\})/);
  const link = (label: string, url?: string) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-ink underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
        {label}
      </a>
    ) : (
      <span className="font-bold text-ink">{label}</span>
    );
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <Fragment key={i}>{p === "{{terms}}" ? link(t(termsKey), links.termsUrl) : p === "{{privacy}}" ? link(t(privacyKey), links.privacyUrl) : p}</Fragment>
      ))}
    </span>
  );
}
