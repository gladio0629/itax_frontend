import { forwardRef, useId, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { Info, Luggage, Minus, Plus, Tag, UserRound, X } from "@/lib/icons";
import { api } from "@/api/client";
import type { LuggageRules, Rider } from "@/api/types";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Segmented } from "@/components/ui/Segmented";
import { formatPhoneInput } from "@/lib/phone";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

/** "Bagaj" stepper, bounded by the adapter's rules for this route. */
export function LuggageStepper({ rules, value, onChange }: { rules: NonNullable<LuggageRules>; value: number; onChange: (n: number) => void }) {
  const { t } = useT();
  const step = (d: number) => onChange(Math.min(rules.max, Math.max(rules.min, value + d)));
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full bg-accent-5 text-accent transition-colors hover:bg-accent-10 disabled:opacity-40 disabled:hover:bg-accent-5";
  return (
    <section aria-labelledby="luggage-title" className="flex min-h-[64px] items-center gap-3 rounded-xl border border-border px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent">
        <Luggage className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span id="luggage-title" className="block text-sm font-semibold text-ink">
          {t("luggage.title")}
        </span>
        <span className="block text-xs text-ink/60">{t("luggage.desc")}</span>
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => step(-1)} disabled={value <= rules.min} aria-label={t("luggage.decrease")} className={btn}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center text-base font-semibold text-ink tabular" aria-live="polite" aria-label={t("luggage.count", { n: value })}>
          {value}
        </span>
        <button type="button" onClick={() => step(1)} disabled={value >= rules.max} aria-label={t("luggage.increase")} className={btn}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

export type RiderError = { field: "name" | "phone" | "form"; message: string } | null;

/** Name + +998 phone. `prefix` keeps input names unique when two people sit
 * on one panel (Kargo sender and receiver). */
export const ContactFields = forwardRef<
  { focus: (field: "name" | "phone") => void },
  {
    prefix: string;
    value: { name: string; phone: string };
    onChange: (v: { name: string; phone: string }) => void;
    nameMaxLength?: number;
    errors?: { name?: string; phone?: string };
    onBlurField?: (field: "name" | "phone") => void;
  }
>(function ContactFields({ prefix, value, onChange, nameMaxLength, errors, onBlurField }, ref) {
  const { t } = useT();
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: (f) => (f === "name" ? nameRef : phoneRef).current?.focus() }), []);
  return (
    <>
      <Input
        ref={nameRef}
        label={t("rider.name")}
        name={`${prefix}-name`}
        autoComplete="off"
        maxLength={nameMaxLength}
        placeholder={t("rider.namePlaceholder")}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        onBlur={() => onBlurField?.("name")}
        error={errors?.name}
        aria-invalid={!!errors?.name || undefined}
      />
      <Input
        ref={phoneRef}
        label={t("rider.phone")}
        type="tel"
        name={`${prefix}-phone`}
        autoComplete="off"
        inputMode="numeric"
        placeholder="90 123 45 67"
        value={value.phone}
        onChange={(e) => onChange({ ...value, phone: formatPhoneInput(e.target.value) })}
        onBlur={() => onBlurField?.("phone")}
        leftIcon={<span className="text-sm font-normal text-ink/80">+998</span>}
        error={errors?.phone}
        aria-invalid={!!errors?.phone || undefined}
      />
    </>
  );
});

/** An info note under contact fields (SMS goes to this number…). */
export function ContactNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl bg-accent-5 px-3 py-2.5 text-xs text-ink/80">
      <Info className="mt-px h-4 w-4 shrink-0 text-accent" />
      {children}
    </p>
  );
}

/**
 * "Kim ketadi?" — Men / Boshqa odam; for someone else, name and a +998
 * phone. Kargo reuses it as "Jo'natuvchi" (title, prefix and note change).
 * The adapter validates.
 */
export const RiderSection = forwardRef<
  { focus: (field: "name" | "phone") => void },
  {
    value: Rider;
    onChange: (r: Rider) => void;
    nameMaxLength?: number;
    error: RiderError;
    title?: string;
    prefix?: string;
    /** null hides the note. */
    note?: string | null;
    errors?: { name?: string; phone?: string };
    onBlurField?: (field: "name" | "phone") => void;
  }
>(function RiderSection({ value, onChange, nameMaxLength, error, title, prefix = "rider", note, errors, onBlurField }, ref) {
  const { t } = useT();
  const titleId = useId();
  const other = value.kind === "other" ? value : null;
  const heading = title ?? t("rider.title");
  const kind = value.kind;
  const setKind = (k: "me" | "other") => onChange(k === "me" ? { kind: "me" } : { kind: "other", name: other?.name ?? "", phone: other?.phone ?? "" });
  const options = [
    { id: "me" as const, label: t("rider.me") },
    { id: "other" as const, label: t("rider.other") },
  ];
  const fieldErrors = errors ?? {
    name: error?.field === "name" ? error.message : undefined,
    phone: error?.field === "phone" ? error.message : undefined,
  };

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <p id={titleId} className="flex items-center gap-1.5 text-control font-semibold text-ink">
        <UserRound className="h-4 w-4 text-ink/60" /> {heading}
      </p>
      <Segmented ariaLabelledBy={titleId} value={kind} onChange={setKind} options={options} />
      {other && (
        <div className="space-y-3 animate-fade-in">
          <ContactFields
            ref={ref}
            prefix={prefix}
            value={other}
            onChange={(v) => onChange({ kind: "other", ...v })}
            nameMaxLength={nameMaxLength}
            errors={fieldErrors}
            onBlurField={onBlurField}
          />
          {note !== null && <ContactNote>{note ?? t("rider.note")}</ContactNote>}
        </div>
      )}
      {error?.field === "form" && (
        <p role="alert" className="text-xs text-danger">
          {error.message}
        </p>
      )}
    </section>
  );
});

/**
 * "Promo kod" in the payment section. The adapter checks the code; once
 * applied, its discount shows as a price line (from the quote) and the code
 * can be removed.
 */
export function PromoRow({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.applyPromoCode(code);
      if (res.valid) {
        onChange(res.code);
        setPct(res.discountPct);
        setOpen(false);
        setCode("");
      } else setError(t(res.messageKey as TranslationKey));
    } catch {
      setError(t("common.errorMessage"));
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-accent/40 bg-accent-5 py-1.5 pl-3 pr-1">
        <Tag className="h-4 w-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink" translate="no">
            {value}
          </span>
          {pct != null && <span className="block text-xs text-accent">{t("promo.applied", { pct })}</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setPct(null);
          }}
          aria-label={t("promo.remove")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/60 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-dashed border-accent/40 px-3 text-sm font-semibold text-accent hover:bg-accent-5"
      >
        <Tag className="h-4 w-4" /> {t("promo.add")}
      </button>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            aria-label={t("promo.title")}
            name="promo"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="done"
            placeholder={t("promo.placeholder")}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            error={error ?? undefined}
            leftIcon={<Tag className="h-4 w-4" />}
          />
        </div>
        <Button className="h-[52px] shrink-0" loading={busy} disabled={!code.trim()} onClick={apply}>
          {t("promo.apply")}
        </Button>
      </div>
    </div>
  );
}
