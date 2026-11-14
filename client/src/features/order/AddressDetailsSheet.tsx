import { useId, useState, type ReactNode } from "react";
import { api } from "@/api/client";
import type { Address, AddressDetails, OrderDetailsRules } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ListSection } from "@/components/ios/List";
import { useIsIOS } from "@/lib/platform";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

type Field = keyof AddressDetails;
const SHORT_FIELDS: { key: Exclude<Field, "note" | "intercom">; label: TranslationKey }[] = [
  { key: "entrance", label: "details.entrance" },
  { key: "floor", label: "details.floor" },
  { key: "apartment", label: "details.apartment" },
];

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
  const ios = useIsIOS();
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
  const inputProps = (key: Field) => ({
    name: `details-${key}`,
    autoComplete: "off",
    spellCheck: false,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
  });

  if (ios) {
    return (
      <Sheet open onClose={onClose} ariaLabel={t("details.title")} panelClassName="ios:bg-bg">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pb-1 pt-1">
          <button type="button" onClick={onClose} className="ios-body min-h-[44px] justify-self-start text-accent">
            {t("common.cancel")}
          </button>
          <h2 className="ios-headline text-ink">{t("details.button")}</h2>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="ios-headline min-h-[44px] justify-self-end text-accent disabled:opacity-40"
          >
            {t("common.save")}
          </button>
        </div>
        <p className="ios-footnote mb-4 truncate px-8 text-center text-[color:var(--ios-label-secondary)]">{address.label}</p>

        <ListSection footer={t("details.optional")} className="mb-[35px]">
          {SHORT_FIELDS.map((f) => (
            <IosField key={f.key} label={t(f.label)}>
              <input {...inputProps(f.key)} maxLength={fieldMax} className="ios-body w-full bg-transparent text-right text-ink outline-none" />
            </IosField>
          ))}
          <IosField label={t("details.intercom")}>
            <input
              {...inputProps("intercom")}
              autoCapitalize="characters"
              maxLength={rules?.intercomMaxLength}
              className="ios-body w-full bg-transparent text-right text-ink outline-none"
            />
          </IosField>
        </ListSection>

        <ListSection header={<label htmlFor={noteId}>{t("details.note")}</label>} footer={counter} className="mb-[35px]">
          <textarea
            id={noteId}
            name="details-note"
            autoComplete="off"
            rows={3}
            value={form.note}
            maxLength={noteMax}
            onChange={(e) => set("note", e.target.value)}
            placeholder={t("details.notePlaceholder")}
            className="ios-body block w-full resize-none bg-card px-4 py-[11px] text-ink outline-none transition-colors placeholder:text-[color:var(--ios-label-tertiary)] focus:bg-[var(--ios-fill-quaternary)]"
          />
        </ListSection>

        {filled && (
          <ListSection>
            <button
              type="button"
              onClick={() => setForm({ entrance: "", floor: "", apartment: "", intercom: "", note: "" })}
              className="ios-body flex min-h-[44px] w-full items-center justify-center bg-card text-danger active:bg-[var(--ios-row-pressed)]"
            >
              {t("details.clear")}
            </button>
          </ListSection>
        )}

        {error && (
          <p role="alert" aria-live="polite" className="ios-footnote mx-8 mt-3 text-danger">
            {error}
          </p>
        )}
        <div className="h-4" />
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} ariaLabel={t("details.title")}>
      <div className="px-5 pt-3">
        <h2 className="text-sm font-semibold text-ink">{t("details.title")}</h2>
        <p className="mt-0.5 truncate text-xs text-ink/60">{address.label}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {SHORT_FIELDS.map((f) => (
            <Input key={f.key} label={t(f.label)} {...inputProps(f.key)} maxLength={fieldMax} />
          ))}
        </div>
        <div className="mt-3">
          <Input
            label={t("details.intercom")}
            {...inputProps("intercom")}
            autoCapitalize="characters"
            maxLength={rules?.intercomMaxLength}
          />
        </div>
        <div className="mt-3">
          <label htmlFor={noteId} className="mb-2 block text-sm font-semibold text-ink/80">
            {t("details.note")}
          </label>
          <textarea
            id={noteId}
            name="details-note"
            autoComplete="off"
            rows={3}
            value={form.note}
            maxLength={noteMax}
            onChange={(e) => set("note", e.target.value)}
            placeholder={t("details.notePlaceholder")}
            className="block w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink/60 focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
          <div className="mt-1.5 flex justify-between gap-3 text-xs text-ink/60">
            <span>{t("details.optional")}</span>
            {counter && <span className="tabular">{counter}</span>}
          </div>
        </div>

        {error && (
          <p role="alert" aria-live="polite" className="mt-3 text-xs font-normal text-danger">
            {error}
          </p>
        )}

        <div className={cn("sticky bottom-0 -mx-5 mt-4 grid gap-3 border-t border-border bg-card px-5 pt-3", filled ? "grid-cols-2" : "grid-cols-1")}>
          {filled && (
            <Button
              variant="secondary"
              fullWidth
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

function IosField({ label, children }: { label: string; children: ReactNode }) {
  return (
    // Focus shows as the row's pressed fill (the inputs drop the outline).
    <label className="ios-sep relative flex min-h-[44px] items-center gap-4 bg-card pl-4 pr-4 transition-colors focus-within:bg-[var(--ios-fill-quaternary)]" style={{ ["--sep-inset" as string]: "16px" }}>
      <span className="ios-body shrink-0 text-ink">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
