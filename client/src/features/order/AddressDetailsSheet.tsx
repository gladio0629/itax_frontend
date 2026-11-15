import { useId, useState } from "react";
import { api } from "@/api/client";
import type { Address, AddressDetails, OrderDetailsRules } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { FieldGrid, FormField } from "@/components/ui/FormField";
import { CloseButton } from "@/components/ui/CloseButton";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

type Field = keyof AddressDetails;

/**
 * "Tafsilotlar" for one route point: Podyezd, Qavat, Kvartira, Domofon kodi,
 * Izoh — all optional. The adapter validates and normalizes on save (and
 * remembers them when the address is a saved one); the limits shown here
 * are the adapter's rules.
 */
export function AddressDetailsSheet({
  address,
  value,
  rules,
  onSave,
  onClose,
}: {
  address: Address;
  value: AddressDetails;
  rules: OrderDetailsRules | null;
  onSave: (details: AddressDetails) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const noteId = useId();
  const [form, setForm] = useState<Required<AddressDetails>>({
    entrance: value.entrance ?? "",
    floor: value.floor ?? "",
    apartment: value.apartment ?? "",
    intercom: value.intercom ?? "",
    note: value.note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = Object.values(form).some((v) => v.trim());

  function set(key: Field, v: string) {
    setForm((f) => ({ ...f, [key]: v }));
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.saveAddressDetails(address.id, form);
      onSave(saved);
      onClose();
    } catch (err) {
      // Validation errors carry a translation key; anything else is generic.
      const e = err as { code?: string; message?: string };
      setError(e.code === "TOO_LONG" && e.message ? t(e.message as TranslationKey) : t("details.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const fieldMax = rules?.addressFieldMaxLength;
  const noteMax = rules?.addressNoteMaxLength;
  const counter = noteMax ? t("comment.count", { n: form.note.length, max: noteMax }) : null;
  const field = (key: Field, label: TranslationKey, max?: number, extra?: Partial<React.InputHTMLAttributes<HTMLInputElement>>) => (
    <FormField
      label={t(label)}
      name={`details-${key}`}
      autoComplete="off"
      spellCheck={false}
      maxLength={max}
      value={form[key]}
      onChange={(e) => set(key, e.target.value)}
      {...extra}
    />
  );

  return (
    <Sheet open onClose={onClose} ariaLabel={t("details.title")}>
      <div className="px-6 pt-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="text-display font-bold text-ink">{t("details.button")}</h2>
            <p className="truncate text-sub text-ink/60">{address.label}</p>
          </div>
          <CloseButton onClick={onClose} label={t("common.close")} className="-mr-2" />
        </div>

        {/* Two columns as in the reference: Podyezd | Kvartira, Qavat | Domofon. */}
        <div className="mt-2">
          <FieldGrid>
            {field("entrance", "details.entrance", fieldMax)}
            {field("apartment", "details.apartment", fieldMax)}
            {field("floor", "details.floor", fieldMax)}
            {field("intercom", "details.intercom", rules?.intercomMaxLength, { autoCapitalize: "characters" })}
          </FieldGrid>
          <div className="mt-1">
            <label htmlFor={noteId} className="sr-only">
              {t("details.note")}
            </label>
            <textarea
              id={noteId}
              name="details-note"
              autoComplete="off"
              rows={2}
              value={form.note}
              maxLength={noteMax}
              onChange={(e) => set("note", e.target.value)}
              placeholder={t("details.note")}
              className="block w-full resize-none border-b border-hairline bg-transparent py-4 text-body text-ink outline-none placeholder:text-ink/60 focus:border-accent"
            />
            <div className="mt-1.5 flex justify-between gap-3 text-sub text-ink/60">
              <span>{t("details.optional")}</span>
              {counter && <span className="tabular">{counter}</span>}
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" aria-live="polite" className="mt-3 text-sub text-danger">
            {error}
          </p>
        )}

        <div className={cn("sticky bottom-0 -mx-6 mt-4 grid gap-2 bg-card px-2 pt-2", filled ? "grid-cols-[auto_1fr]" : "grid-cols-1")}>
          {filled && (
            <Button
              variant="secondary"
              onClick={() => setForm({ entrance: "", floor: "", apartment: "", intercom: "", note: "" })}
            >
              {t("details.clear")}
            </Button>
          )}
          <Button fullWidth loading={saving} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
