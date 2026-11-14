import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Info, Luggage, Minus, Plus, Tag, UserRound, X } from "@/lib/icons";
import { api } from "@/api/client";
import type { LuggageRules, Rider } from "@/api/types";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Segmented } from "@/components/ios/Segmented";
import { useIsIOS } from "@/lib/platform";
import { formatPhoneInput } from "@/lib/phone";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

/** "Bagaj" stepper, bounded by the adapter's rules for this route. */
export function LuggageStepper({ rules, value, onChange }: { rules: NonNullable<LuggageRules>; value: number; onChange: (n: number) => void }) {
  const { t } = useT();
  const step = (d: number) => onChange(Math.min(rules.max, Math.max(rules.min, value + d)));
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full bg-accent-5 text-accent transition-colors hover:bg-accent-10 disabled:opacity-40 disabled:hover:bg-accent-5 ios:bg-card";
  return (
    <section aria-labelledby="luggage-title" className="flex min-h-[64px] items-center gap-3 rounded-xl border border-border px-3 py-2 ios:border-0 ios:bg-[var(--ios-fill-quaternary)]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent ios:bg-card">
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

/**
 * "Kim ketadi?" — Men / Boshqa odam. For someone else: name and a +998
 * phone. The adapter validates (see OrderSheet: on leaving the step).
 */
export const RiderSection = forwardRef<
  { focus: (field: "name" | "phone") => void },
  { value: Rider; onChange: (r: Rider) => void; nameMaxLength?: number; error: RiderError }
>(function RiderSection({ value, onChange, nameMaxLength, error }, ref) {
  const { t } = useT();
  const ios = useIsIOS();
  const other = value.kind === "other" ? value : null;
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: (f) => (f === "name" ? nameRef : phoneRef).current?.focus() }), []);
  const kind = value.kind;
  const setKind = (k: "me" | "other") => onChange(k === "me" ? { kind: "me" } : { kind: "other", name: other?.name ?? "", phone: other?.phone ?? "" });
  const options = [
    { id: "me" as const, label: t("rider.me") },
    { id: "other" as const, label: t("rider.other") },
  ];

  return (
    <section aria-labelledby="rider-title" className="space-y-3">
      <p id="rider-title" className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <UserRound className="h-4 w-4 text-ink/60" /> {t("rider.title")}
      </p>
      {ios ? (
        <Segmented ariaLabel={t("rider.title")} value={kind} onChange={setKind} options={options} />
      ) : (
        <div role="radiogroup" aria-labelledby="rider-title" className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={kind === o.id}
              onClick={() => setKind(o.id)}
              className={cn(
                "min-h-[48px] rounded-xl border-2 text-sm font-semibold transition-colors",
                kind === o.id ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70 hover:border-accent/40"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {other && (
        <div className="space-y-3 animate-fade-in">
          <Input
            ref={nameRef}
            label={t("rider.name")}
            name="rider-name"
            autoComplete="off"
            maxLength={nameMaxLength}
            placeholder={t("rider.namePlaceholder")}
            value={other.name}
            onChange={(e) => onChange({ ...other, name: e.target.value })}
            error={error?.field === "name" ? error.message : undefined}
            aria-invalid={error?.field === "name" || undefined}
          />
          <Input
            ref={phoneRef}
            label={t("rider.phone")}
            type="tel"
            name="rider-phone"
            autoComplete="off"
            inputMode="numeric"
            placeholder="90 123 45 67"
            value={other.phone}
            onChange={(e) => onChange({ ...other, phone: formatPhoneInput(e.target.value) })}
            leftIcon={<span className="text-sm font-normal text-ink/80">+998</span>}
            error={error?.field === "phone" ? error.message : undefined}
            aria-invalid={error?.field === "phone" || undefined}
          />
          <p className="flex gap-2 rounded-xl bg-accent-5 px-3 py-2.5 text-xs text-ink/80 ios:bg-[var(--ios-fill-quaternary)]">
            <Info className="mt-px h-4 w-4 shrink-0 text-accent" />
            {t("rider.note")}
          </p>
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
      <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-accent/40 bg-accent-5 py-1.5 pl-3 pr-1 ios:border-0">
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
