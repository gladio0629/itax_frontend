import { useEffect, useId, useState } from "react";
import { api } from "@/api/client";
import type { Address, AddressDetails, OrderDetailsRules, SavedAddressInfo, SavedPlaceKind } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { Chip, Field, Icon, PrimaryButton, Screen, SectionLabel, Switch, TextAreaField, TextButton } from "@/ui";

type Form = Required<AddressDetails>;
const KINDS: SavedPlaceKind[] = ["home", "work", "other"];

/** Compact 68px box with a 20px value (Podyezd / Qavat / Kvartira). */
function SmallField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (v: string) => void; maxLength?: number }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex h-[68px] min-w-0 cursor-text flex-col justify-center gap-0.5 rounded-iz-field border-2 border-transparent bg-iz-field px-3.5 focus-within:border-iz-ink focus-within:bg-iz-field-focus focus-within:shadow-[0_0_0_4px_var(--iz-focus-ring)]"
    >
      <span className="truncate text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{label}</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        placeholder="—"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="iz-input h-[26px] w-full min-w-0 border-0 bg-transparent p-0 text-[20px] font-extrabold text-iz-ink outline-none placeholder:text-iz-muted placeholder:opacity-60"
      />
    </label>
  );
}

/**
 * Address details (design: AddressDetails / KbDetails): Podyezd, Qavat,
 * Kvartira, Domofon kodi, a note for the driver — all optional — and
 * "Manzilni saqlash" with Uy / Ish / Boshqa.
 *
 * mode "point": details of a point of the current order; the adapter
 * validates them (saveAddressDetails) and the switch can also keep the
 * place. mode "save": the place is being saved (Home "+"), so saving is
 * the point and there is no switch.
 */
export function AddressDetailsScreen({
  address,
  value,
  rules: rulesProp,
  mode,
  onDone,
  onClose,
}: {
  address: Address;
  value: AddressDetails;
  rules?: OrderDetailsRules | null;
  mode: "point" | "save";
  onDone: (details: AddressDetails, saved?: SavedAddressInfo) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [form, setForm] = useState<Form>({
    entrance: value.entrance ?? "",
    floor: value.floor ?? "",
    apartment: value.apartment ?? "",
    intercom: value.intercom ?? "",
    note: value.note ?? "",
  });
  const [rules, setRules] = useState<OrderDetailsRules | null>(rulesProp ?? null);
  /** null until known; the switch is offered only for places not saved yet. */
  const [alreadySaved, setAlreadySaved] = useState<boolean | null>(mode === "save" ? false : null);
  const [saveOn, setSaveOn] = useState(mode === "save");
  const [kind, setKind] = useState<SavedPlaceKind>("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = Object.values(form).some((v) => v.trim());

  useEffect(() => {
    if (rulesProp) return;
    api.getOrderDetailsRules().then(setRules).catch(() => setRules(null));
  }, [rulesProp]);

  useEffect(() => {
    if (mode === "save") return;
    api
      .getSavedAddresses("")
      .then((list) => setAlreadySaved(list.some((s) => s.address.id === address.id)))
      .catch(() => setAlreadySaved(true)); // unknown: don't offer to save twice
  }, [mode, address.id]);

  const set = (key: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setError(null);
  };

  /** Home and work keep the kind (the label follows the language); the
   * name is still sent for a backend that stores only names. */
  const nameFor = (k: SavedPlaceKind) => (k === "other" ? undefined : t(`details.kind.${k}` as TranslationKey));

  async function done() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "save") {
        const saved = await api.saveAddress({ addressId: address.id, name: nameFor(kind), kind, details: form });
        onDone(saved.details ?? {}, saved);
        return;
      }
      const details = api.capabilities.addressDetails ? await api.saveAddressDetails(address.id, form) : {};
      let saved: SavedAddressInfo | undefined;
      if (saveOn && alreadySaved === false) saved = await api.saveAddress({ addressId: address.id, name: nameFor(kind), kind, details });
      onDone(details, saved);
    } catch (err) {
      // Validation errors carry a translation key; anything else is generic.
      const e = err as { code?: string; message?: string };
      setError(e.code === "TOO_LONG" && e.message ? t(e.message as TranslationKey) : t("details.saveError"));
    } finally {
      setBusy(false);
    }
  }

  const fieldMax = rules?.addressFieldMaxLength;
  const noteMax = rules?.addressNoteMaxLength;
  const showSave = mode === "save" || alreadySaved === false;

  return (
    <div className="absolute inset-0 z-[60] animate-fade-in" role="dialog" aria-modal="true" aria-label={t("details.title")}>
      <Screen
        // Keyboard open (KbDetails): the card hides and the title becomes the address.
        title={
          <>
            <span className="kb:hidden">{mode === "save" ? t("home.saveAddress") : t("details.title")}</span>
            <span className="hidden kb:inline">{address.label}</span>
          </>
        }
        onBack={onClose}
        top={
          <div className="flex items-center gap-3.5 rounded-iz-card bg-iz-head-card px-4 py-3.5">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-iz-green text-iz-on-green">
              <Icon name="pin" />
            </span>
            <span className="min-w-0 truncate text-[16px] font-extrabold text-white">{address.label}</span>
          </div>
        }
        footer={
          <>
            {error && (
              <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
                {error}
              </p>
            )}
            <PrimaryButton loading={busy} onClick={done}>
              {t("details.done")}
            </PrimaryButton>
            {filled && (
              <TextButton className="kb:hidden" onClick={() => setForm({ entrance: "", floor: "", apartment: "", intercom: "", note: "" })}>
                {t("details.clear")}
              </TextButton>
            )}
          </>
        }
      >
        <SectionLabel className="kb:hidden">{t("details.building")}</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5">
          <SmallField label={t("details.entrance")} value={form.entrance} onChange={set("entrance")} maxLength={fieldMax} />
          <SmallField label={t("details.floor")} value={form.floor} onChange={set("floor")} maxLength={fieldMax} />
          <SmallField label={t("details.apartment")} value={form.apartment} onChange={set("apartment")} maxLength={fieldMax} />
        </div>
        <Field
          label={t("details.intercom")}
          icon="keypad"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          placeholder={t("details.intercomPlaceholder")}
          maxLength={rules?.intercomMaxLength}
          value={form.intercom}
          onChange={(e) => set("intercom")(e.target.value)}
        />
        <TextAreaField
          label={t("details.driverNote")}
          placeholder={t("details.driverNotePlaceholder")}
          maxLength={noteMax}
          counter={noteMax ? t("comment.count", { n: form.note.length, max: noteMax }) : undefined}
          value={form.note}
          onChange={(e) => set("note")(e.target.value)}
        />
        {showSave && (
          <div className="flex flex-col gap-2 rounded-iz-field border border-iz-border pb-3 pl-4 pr-2 pt-1.5">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-[15px] font-extrabold text-iz-ink">{t("details.saveToggle")}</span>
              {mode === "point" ? <Switch checked={saveOn} onChange={setSaveOn} label={t("details.saveToggle")} /> : <span className="h-11" />}
            </div>
            {saveOn && (
              <div role="group" aria-label={t("details.kind")} className={cn("flex flex-wrap gap-2")}>
                {KINDS.map((k) => (
                  <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>
                    {t(`details.kind.${k}` as TranslationKey)}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}
      </Screen>
    </div>
  );
}
