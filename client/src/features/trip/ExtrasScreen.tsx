import { useRef, useState } from "react";
import { api } from "@/api/client";
import type { LuggageRules, OrderDetailsRules, Rider } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { formatPhoneInput } from "@/lib/phone";
import { cn } from "@/lib/cn";
import { Icon, PrimaryButton, Screen, Switch, TextAreaField } from "@/ui";

export type ExtrasValue = { luggage: number; comment: string; rider: Rider };

/** Small 62–68px field used in pairs (Ismi / Telefoni). */
function PairField({
  label,
  value,
  onChange,
  error,
  prefix,
  inputRef,
  ...input
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  prefix?: string;
  inputRef?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label
      className={cn(
        "flex h-[68px] min-w-0 cursor-text flex-col justify-center gap-0.5 rounded-iz-field border-2 bg-iz-field px-3.5 focus-within:border-iz-ink focus-within:bg-iz-field-focus focus-within:shadow-[0_0_0_4px_var(--iz-focus-ring)]",
        error ? "border-iz-danger" : "border-transparent"
      )}
    >
      <span className="truncate text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        {prefix && <span className="shrink-0 text-[15px] font-extrabold text-iz-ink">{prefix}</span>}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="iz-input h-[22px] w-full min-w-0 border-0 bg-transparent p-0 text-[16px] font-extrabold text-iz-ink outline-none placeholder:font-semibold placeholder:text-iz-muted placeholder:opacity-70"
          {...input}
        />
      </span>
    </label>
  );
}

/**
 * "Bagaj va izoh" (design: Extras / KbExtras): bag count (bounds from the
 * server, hidden where bags aren't counted), a note for the driver and
 * "Boshqa odam uchun" with name and phone. Changes apply on "Tayyor";
 * the adapter validates the other person (validateRider).
 */
export function ExtrasScreen({
  value,
  luggageRules,
  rules,
  onDone,
  onBack,
}: {
  value: ExtrasValue;
  luggageRules: LuggageRules;
  rules: OrderDetailsRules | null;
  onDone: (v: ExtrasValue) => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const [luggage, setLuggage] = useState(value.luggage);
  const [comment, setComment] = useState(value.comment);
  const [other, setOther] = useState(value.rider.kind === "other");
  const [name, setName] = useState(value.rider.kind === "other" ? value.rider.name : "");
  const [phone, setPhone] = useState(value.rider.kind === "other" ? value.rider.phone : "");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [riderFocused, setRiderFocused] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const riderOn = api.capabilities.rider;

  async function done() {
    setErrors({});
    let rider: Rider = { kind: "me" };
    if (riderOn && other) {
      rider = { kind: "other", name, phone };
      setBusy(true);
      try {
        rider = await api.validateRider(rider);
      } catch (err) {
        const e = err as { code?: string; message?: string };
        const msg = e.message ? t(e.message as TranslationKey) : t("common.errorMessage");
        if (e.code === "RIDER_NAME") {
          setErrors({ name: msg });
          nameRef.current?.focus();
        } else if (e.code === "RIDER_PHONE") {
          setErrors({ phone: msg });
          phoneRef.current?.focus();
        } else setErrors({ form: t("common.errorMessage") });
        return;
      } finally {
        setBusy(false);
      }
    }
    onDone({ luggage: luggageRules ? luggage : 0, comment: comment.trim(), rider });
  }

  const max = rules?.commentMaxLength;
  const fieldError = errors.name ?? errors.phone ?? errors.form;

  return (
    <div className="absolute inset-0 z-50 animate-fade-in" role="dialog" aria-modal="true" aria-label={t("trip.extrasTitle")}>
      <Screen
        // Keyboard in the other person's fields (KbExtras): the title follows them.
        title={riderFocused ? t("extras.other") : t("trip.extrasTitle")}
        onBack={onBack}
        bodyClassName="gap-3.5 pt-[22px]"
        footer={
          <>
            {fieldError && (
              <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
                {fieldError}
              </p>
            )}
            <PrimaryButton loading={busy} onClick={done}>
              {t("details.done")}
            </PrimaryButton>
          </>
        }
      >
        {luggageRules && (
          <div className="kb-collapse flex h-[68px] shrink-0 items-center gap-3.5 rounded-iz-field bg-iz-field pl-3.5 pr-3">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-sheet text-iz-ink">
              <Icon name="luggage" />
            </span>
            <span id="bags-label" className="flex-1 text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">
              {t("extras.bags")}
            </span>
            <div role="group" aria-labelledby="bags-label" className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t("extras.bagsLess")}
                disabled={luggage <= luggageRules.min}
                onClick={() => setLuggage((n) => n - 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-iz-chip-border bg-iz-sheet text-iz-ink disabled:opacity-40"
              >
                <Icon name="minus" size={16} />
              </button>
              <span aria-live="polite" className="w-5 text-center text-[20px] font-extrabold tabular-nums text-iz-ink">
                {luggage}
              </span>
              <button
                type="button"
                aria-label={t("extras.bagsMore")}
                disabled={luggage >= luggageRules.max}
                onClick={() => setLuggage((n) => n + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-iz-selected text-iz-on-selected disabled:opacity-40"
              >
                <Icon name="plusSmall" size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="kb-collapse">
          <TextAreaField
            label={t("extras.note")}
            placeholder={t("extras.notePlaceholder")}
            maxLength={max}
            counter={max ? t("comment.count", { n: comment.length, max }) : undefined}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        {riderOn && (
          <div
            className="kb-collapse flex flex-col gap-1.5 rounded-[22px] border border-iz-border pb-2 pl-4 pr-2 pt-1.5"
            onFocus={() => setRiderFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRiderFocused(false);
            }}
          >
            <div className="flex items-center gap-3 kb:hidden">
              <span className="flex flex-1 flex-col gap-px">
                <span className="text-[15px] font-extrabold text-iz-ink">{t("extras.other")}</span>
                <span className="text-[12px] text-iz-muted">{t("extras.otherHint")}</span>
              </span>
              <Switch
                checked={other}
                label={t("extras.other")}
                onChange={(on) => {
                  setOther(on);
                  setErrors({});
                }}
              />
            </div>
            {other && (
              <>
                <div className="-ml-2 grid grid-cols-2 gap-2">
                  <PairField
                    inputRef={nameRef}
                    label={t("extras.name")}
                    value={name}
                    error={errors.name}
                    autoComplete="name"
                    maxLength={rules?.riderNameMaxLength}
                    onChange={(v) => {
                      setName(v);
                      setErrors({});
                    }}
                  />
                  <PairField
                    inputRef={phoneRef}
                    label={t("extras.phone")}
                    prefix="+998"
                    value={phone}
                    error={errors.phone}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="90 123 45 67"
                    onChange={(v) => {
                      setPhone(formatPhoneInput(v));
                      setErrors({});
                    }}
                  />
                </div>
                <span className="-ml-2 hidden pb-1 text-[13px] leading-[19px] text-iz-muted kb:block">{t("extras.otherNote")}</span>
              </>
            )}
          </div>
        )}
      </Screen>
    </div>
  );
}
