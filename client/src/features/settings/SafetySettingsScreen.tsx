import { useEffect, useRef, useState } from "react";
import { Trash2, UserPlus, Users } from "@/lib/icons";
import { api } from "@/api/client";
import type { EmergencyContact, EmergencyContacts } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { SkeletonList } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Alert } from "@/components/ios/Alert";
import { ListSection } from "@/components/ios/List";
import { useIsIOS } from "@/lib/platform";
import { formatPhoneInput } from "@/lib/phone";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";

/**
 * Sozlamalar > Xavfsizlik: emergency contacts (limit from the adapter) that
 * the safety sheet offers during a trip. Removing asks first.
 */
export function SafetySettingsScreen() {
  const { t } = useT();
  const ios = useIsIOS();
  const [data, setData] = useState<EmergencyContacts | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field: "name" | "phone" | "form"; message: string } | null>(null);
  const [removing, setRemoving] = useState<EmergencyContact | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoadError(false);
    api.getEmergencyContacts().then(setData).catch(() => setLoadError(true));
  }
  useEffect(load, []);

  async function add() {
    setSaving(true);
    setError(null);
    try {
      const created = await api.addEmergencyContact({ name, phone });
      setData((d) => (d ? { ...d, contacts: [...d.contacts, created] } : d));
      setName("");
      setPhone("");
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const field = e.code === "RIDER_NAME" ? "name" : e.code === "RIDER_PHONE" || e.code === "CONTACT_EXISTS" ? "phone" : "form";
      const known = e.code && e.code !== "NETWORK_ERROR" && e.message;
      setError({ field, message: known ? t(e.message as TranslationKey) : t("safety.contacts.saveError") });
      if (field === "name") nameRef.current?.focus();
      if (field === "phone") phoneRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    const c = removing;
    setRemoving(null);
    if (!c) return;
    try {
      await api.removeEmergencyContact(c.id);
      setData((d) => (d ? { ...d, contacts: d.contacts.filter((x) => x.id !== c.id) } : d));
    } catch {
      setError({ field: "form", message: t("safety.contacts.saveError") });
    }
  }

  if (!data) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title={t("settings.safety")} />
        {loadError ? <ErrorState onRetry={load} /> : <div className="px-4 pt-4"><SkeletonList count={2} /></div>}
      </div>
    );
  }

  const full = data.contacts.length >= data.max;
  const footer = t("safety.contacts.footer", { max: data.max });

  const list = data.contacts.length ? (
    data.contacts.map((c) => (
      <div key={c.id} className="ios-sep relative flex min-h-[60px] items-center gap-3 bg-card py-2 pl-4 pr-1" style={{ ["--sep-inset" as string]: "16px" }}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-10 text-sm font-semibold text-accent" aria-hidden="true">
          {c.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
          <span className="block text-xs text-ink/60 tabular">{c.phone}</span>
        </span>
        <button
          type="button"
          onClick={() => setRemoving(c)}
          aria-label={t("safety.contacts.remove", { name: c.name })}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/60 hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ))
  ) : (
    <p className="flex min-h-[60px] items-center gap-3 bg-card px-4 text-sm text-ink/60">
      <Users className="h-4 w-4" /> {t("safety.contacts.empty")}
    </p>
  );

  const form = !full && (
    <div className="space-y-3 bg-card p-4">
      <Input
        ref={nameRef}
        label={t("rider.name")}
        name="contact-name"
        autoComplete="off"
        placeholder={t("rider.namePlaceholder")}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        error={error?.field === "name" ? error.message : undefined}
      />
      <Input
        ref={phoneRef}
        label={t("rider.phone")}
        type="tel"
        name="contact-phone"
        autoComplete="off"
        inputMode="numeric"
        placeholder="90 123 45 67"
        value={phone}
        onChange={(e) => {
          setPhone(formatPhoneInput(e.target.value));
          setError(null);
        }}
        leftIcon={<span className="text-sm font-normal text-ink/80">+998</span>}
        error={error?.field === "phone" ? error.message : undefined}
      />
      <Button fullWidth variant="secondary" loading={saving} onClick={add}>
        <UserPlus className="h-4 w-4" /> {t("safety.contacts.add")}
      </Button>
    </div>
  );

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <ScreenHeader title={t("settings.safety")} />
      <div className="scroll-pb flex-1 overflow-y-auto overscroll-contain px-4 pt-2 ios:px-0">
        {ios ? (
          <>
            <ListSection header={`${t("safety.contacts")} · ${data.contacts.length}/${data.max}`} footer={footer}>
              {list}
            </ListSection>
            {form && <ListSection header={t("safety.contacts.add")}>{form}</ListSection>}
          </>
        ) : (
          <>
            <p className="mb-2 flex items-center justify-between text-sm font-semibold text-ink">
              {t("safety.contacts")}
              <span className="text-xs font-normal text-ink/60 tabular">
                {data.contacts.length}/{data.max}
              </span>
            </p>
            <Card padded={false} className="mb-2 overflow-hidden">{list}</Card>
            <p className="mb-5 text-xs text-ink/60">{footer}</p>
            {form && <Card padded={false} className="overflow-hidden">{form}</Card>}
          </>
        )}
        {error?.field === "form" && (
          <p role="alert" className="mx-4 mt-3 text-xs text-danger">
            {error.message}
          </p>
        )}
      </div>

      {ios ? (
        <Alert
          open={!!removing}
          title={t("safety.contacts.removeTitle")}
          message={removing ? t("safety.contacts.removeDesc", { name: removing.name }) : undefined}
          onCancel={() => setRemoving(null)}
          actions={[
            { label: t("common.cancel"), style: "cancel", onPress: () => setRemoving(null) },
            { label: t("common.delete"), style: "destructive", onPress: confirmRemove },
          ]}
        />
      ) : (
        <Sheet open={!!removing} onClose={() => setRemoving(null)} ariaLabel={t("safety.contacts.removeTitle")}>
          <div className="px-5 pb-3 pt-3">
            <h2 className="mb-2 text-sm font-semibold text-ink">{t("safety.contacts.removeTitle")}</h2>
            <p className="mb-5 text-sm text-ink/70">{removing && t("safety.contacts.removeDesc", { name: removing.name })}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" fullWidth onClick={() => setRemoving(null)}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" fullWidth onClick={confirmRemove}>
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
