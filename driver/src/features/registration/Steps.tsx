// Registration steps 1–4 of the redesign: personal → licence → car → selfie.
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/api/client";
import type { CarClass, CarInput, DocSlot, LicenseInput, PersonalInput, RegistrationOptions, ServiceType, Session } from "@/api/types";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { errorMessage } from "@/lib/errors";
import { Armchair, Check, Gift, Package, ScanFace, Sun, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { Sheet } from "@/components/Sheet";
import { DateField, FieldLabel, FormNotice, LegalSentence, PhotoTile, PickerField, RegShell, useDocUploads, useLegalLinks, type Upload } from "./parts";

/** Referral, licence details and service types: only where the server stores them. */
const details = api.capabilities.registrationDetails;

/** What the driver typed, kept while moving back and forth between steps. */
export type RegDraft = {
  personal?: Partial<PersonalInput>;
  license?: Partial<Omit<LicenseInput, "frontRef" | "backRef">>;
  car?: Partial<Omit<CarInput, "techPassportFrontRef" | "techPassportBackRef" | "carPhotoRef">>;
  uploads: Partial<Record<DocSlot, Upload>>;
};

type StepProps = {
  options: RegistrationOptions;
  draft: RegDraft;
  setDraft: (fn: (d: RegDraft) => RegDraft) => void;
  onSaved: (s: Session) => void;
  onBack: () => void;
  notice?: ReactNode;
};

type FieldError = { code?: string; msg: string } | null;
const toError = (e: unknown, t: (k: TranslationKey) => string): FieldError => ({ code: (e as { code?: string }).code, msg: errorMessage(e, t) });
const fieldMsg = (err: FieldError, ...codes: string[]) => (err && err.code && codes.includes(err.code) ? err.msg : undefined);

function useSubmit(t: (k: TranslationKey) => string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FieldError>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(toError(e, t));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------ 1. personal

export function PersonalStep({ options, draft, setDraft, onSaved, onBack, notice }: StepProps) {
  const { t } = useT();
  const d = draft.personal;
  const [firstName, setFirstName] = useState(d?.firstName ?? "");
  const [lastName, setLastName] = useState(d?.lastName ?? "");
  const [birthDate, setBirthDate] = useState(d?.birthDate ?? "");
  const [cityId, setCityId] = useState(d?.cityId ?? "");
  const [referralCode, setReferralCode] = useState(d?.referralCode ?? "");
  const { busy, error, run } = useSubmit(t);
  const shown = ["NAME_INVALID", "BIRTH_DATE_INVALID", "CITY_REQUIRED", "REFERRAL_INVALID"];
  // Every change goes to the draft, so leaving the step (help, camera, reload) keeps it.
  useEffect(() => {
    setDraft((x) => ({ ...x, personal: { firstName, lastName, birthDate, cityId, referralCode } }));
  }, [firstName, lastName, birthDate, cityId, referralCode, setDraft]);

  const save = () =>
    run(async () => {
      const input: PersonalInput = { firstName, lastName, birthDate, cityId, referralCode: referralCode.trim() || undefined };
      onSaved(await api.savePersonal(input));
    });

  return (
    <RegShell
      step={1}
      onBack={onBack}
      showHelp
      title={t("reg.personalTitle")}
      desc={t("reg.personalDesc")}
      notice={notice}
      footer={
        <Button size="lg" fullWidth loading={busy} onClick={save} disabled={!firstName.trim() || !lastName.trim() || !birthDate || !cityId}>
          {t("common.continue")}
        </Button>
      }
    >
      <TextField label={t("reg.firstName")} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={fieldMsg(error, "NAME_INVALID")} />
      <TextField label={t("reg.lastName")} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <DateField label={t("reg.birthDateShort")} value={birthDate} onChange={setBirthDate} max={today()} autoComplete="bday" error={fieldMsg(error, "BIRTH_DATE_INVALID")} />
        <PickerField
          label={t("reg.cityShort")}
          sheetTitle={t("reg.pickCity")}
          value={cityId || undefined}
          options={options.cities.map((c) => ({ value: c.id, label: c.name }))}
          onChange={setCityId}
          error={fieldMsg(error, "CITY_REQUIRED")}
        />
      </div>
      {details && (
      <TextField
        label={t("reg.referral")}
        placeholder={t("reg.referralPlaceholder")}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        value={referralCode}
        onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
        trailing={<Gift className="h-[18px] w-[18px] text-muted" />}
        error={fieldMsg(error, "REFERRAL_INVALID")}
      />
      )}
      {error && !shown.includes(error.code ?? "") && <FormNotice>{error.msg}</FormNotice>}
    </RegShell>
  );
}

// ------------------------------------------------------------- 2. licence

export function LicenseStep({ options, draft, setDraft, onSaved, onBack }: StepProps) {
  const { t } = useT();
  const d = draft.license;
  const [number, setNumber] = useState(d?.number ?? "");
  const [issuedAt, setIssuedAt] = useState(d?.issuedAt ?? "");
  const [expiresAt, setExpiresAt] = useState(d?.expiresAt ?? "");
  const [categories, setCategories] = useState<string[]>(d?.categories ?? []);
  const uploads = useDocUploads(["license_front", "license_back"], draft.uploads, !!options.realDocuments, (slot, u) =>
    setDraft((x) => ({ ...x, uploads: { ...x.uploads, [slot]: u } }))
  );
  const { busy, error, run } = useSubmit(t);
  const shown = ["LICENSE_NUMBER_INVALID", "LICENSE_DATES_REQUIRED", "LICENSE_CATEGORY_REQUIRED"];
  const front = uploads.get("license_front").upload;
  const back = uploads.get("license_back").upload;

  useEffect(() => {
    setDraft((x) => ({ ...x, license: { number, issuedAt, expiresAt, categories } }));
  }, [number, issuedAt, expiresAt, categories, setDraft]);

  const save = () =>
    run(async () => {
      onSaved(await api.saveLicense({ number, issuedAt, expiresAt, categories, frontRef: front?.ref ?? "", backRef: back?.ref ?? "" }));
    });

  const toggle = (c: string) => setCategories((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));
  // Without the licence endpoint only the photos are asked (registrationDetails).
  const ready = !!front && !!back && (!details || (!!number.trim() && !!issuedAt && !!expiresAt && categories.length > 0));

  return (
    <RegShell
      step={2}
      onBack={onBack}
      showHelp
      title={t("reg.licenseTitle")}
      desc={t("reg.licenseDesc")}
      footer={
        <Button size="lg" fullWidth loading={busy} disabled={!ready || uploads.busy} onClick={save}>
          {t("common.continue")}
        </Button>
      }
    >
      <div className="flex gap-2.5">
        <PhotoTile label={t("reg.sideFront")} upload={front} busy={uploads.get("license_front").busy} onPick={() => uploads.pick("license_front")} />
        <PhotoTile label={t("reg.sideBack")} upload={back} busy={uploads.get("license_back").busy} onPick={() => uploads.pick("license_back")} />
      </div>
      {uploads.fileInputs}
      {uploads.error && <FormNotice>{uploads.error}</FormNotice>}
      {details && (
      <>
      <TextField
        label={t("reg.licenseNumber")}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        value={number}
        onChange={(e) => setNumber(e.target.value.toUpperCase().slice(0, 16))}
        error={fieldMsg(error, "LICENSE_NUMBER_INVALID")}
        className="[&_input]:tabular"
      />
      <div className="grid grid-cols-2 gap-3">
        <DateField label={t("reg.issued")} value={issuedAt} onChange={setIssuedAt} max={today()} error={fieldMsg(error, "LICENSE_DATES_REQUIRED")} />
        <DateField label={t("reg.expires")} value={expiresAt} onChange={setExpiresAt} min={issuedAt || undefined} />
      </div>
      <div className="flex flex-col gap-2.5" role="group" aria-labelledby="lic-cat">
        <FieldLabel id="lic-cat">{t("reg.category")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {options.licenseCategories.map((c) => (
            <Chip key={c} selected={categories.includes(c)} onClick={() => toggle(c)} className="min-w-[44px]">
              {c}
            </Chip>
          ))}
        </div>
        {fieldMsg(error, "LICENSE_CATEGORY_REQUIRED") && <p role="alert" className="text-13 font-semibold text-danger">{error?.msg}</p>}
      </div>
      </>
      )}
      {error && !shown.includes(error.code ?? "") && <FormNotice>{error.msg}</FormNotice>}
    </RegShell>
  );
}

// ----------------------------------------------------------------- 3. car

/** "01" + "A 123 BC" on a plate-shaped box, kept as two parts (joined when saved). */
type PlateParts = { region: string; rest: string };
const splitPlate = (plate?: string): PlateParts => {
  const m = /^(\d{2})\s+(.*)$/.exec(plate ?? "");
  return m ? { region: m[1], rest: m[2] } : { region: "", rest: plate ?? "" };
};
const joinPlate = (p: PlateParts) => `${p.region} ${p.rest}`.trim();

function PlateField({ value, onChange, error }: { value: PlateParts; onChange: (v: PlateParts) => void; error?: string }) {
  const { t } = useT();
  return (
    <div>
      <div className={cn("flex min-h-[68px] items-center justify-between gap-3 rounded-field border-2 bg-raised px-4 py-2.5", error ? "border-danger" : "border-raised")}>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="label-caps text-muted">{t("reg.plateLabel")}</span>
          <span className="text-xs font-semibold text-muted">{t("reg.plateHint")}</span>
        </span>
        <span className="flex h-11 shrink-0 items-stretch overflow-hidden rounded-lg border-2 border-night bg-white text-night focus-within:shadow-[0_0_0_4px_rgb(var(--color-brand-soft-rgb))]">
          <input
            aria-label={t("reg.plateRegion")}
            inputMode="numeric"
            autoComplete="off"
            placeholder="01"
            value={value.region}
            onChange={(e) => onChange({ ...value, region: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            className="tabular w-9 border-r-2 border-night bg-transparent text-center text-17 font-extrabold outline-none placeholder:text-night/30 focus-visible:outline-none"
          />
          <input
            aria-label={t("reg.plateRest")}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="A 123 BC"
            value={value.rest}
            onChange={(e) => onChange({ ...value, rest: e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").slice(0, 9) })}
            className="tabular w-[108px] bg-transparent px-2 text-lg font-extrabold tracking-[1.5px] outline-none placeholder:text-night/30 focus-visible:outline-none"
          />
          <span className="flex flex-col items-center justify-center gap-0.5 px-1.5 text-[9px] font-extrabold text-[#1EB0D8]" aria-hidden="true">
            <span className="h-[9px] w-3.5 rounded-[1px]" style={{ background: "linear-gradient(#1EB0D8 0 33%, #FFFFFF 33% 66%, #1EB53A 66%)" }} />
            UZ
          </span>
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 px-1 text-13 font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const SERVICE_ICON: Record<ServiceType, typeof Armchair> = { passengers: Armchair, delivery: Package };

export function CarStep({ options, draft, setDraft, onSaved, onBack }: StepProps) {
  const { t } = useT();
  const d = draft.car;
  const [brand, setBrand] = useState(d?.brand ?? "");
  const [model, setModel] = useState(d?.model ?? "");
  const [plate, setPlate] = useState<PlateParts>(() => splitPlate(d?.plate));
  const [year, setYear] = useState<number | undefined>(d?.year);
  const [seats, setSeats] = useState<number | undefined>(d?.seats);
  const [colorKey, setColorKey] = useState(d?.colorKey ?? "");
  const [carClass, setCarClass] = useState<CarClass | undefined>(d?.carClass);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>(d?.serviceTypes ?? []);
  const [passportOpen, setPassportOpen] = useState(false);
  const uploads = useDocUploads(["tech_passport_front", "tech_passport_back", "car_photo"], draft.uploads, !!options.realDocuments, (slot, u) =>
    setDraft((x) => ({ ...x, uploads: { ...x.uploads, [slot]: u } }))
  );
  const { busy, error, run } = useSubmit(t);
  const shown = ["MODEL_REQUIRED", "PLATE_INVALID", "COLOR_REQUIRED", "SERVICE_TYPE_REQUIRED"];
  const models = options.carBrands.find((b) => b.brand === brand)?.models ?? [];
  const tpFront = uploads.get("tech_passport_front");
  const tpBack = uploads.get("tech_passport_back");
  const photo = uploads.get("car_photo");
  const tpCount = (tpFront.upload ? 1 : 0) + (tpBack.upload ? 1 : 0);

  useEffect(() => {
    setDraft((x) => ({ ...x, car: { brand, model, plate: joinPlate(plate), year, seats, colorKey, carClass, serviceTypes } }));
  }, [brand, model, plate, year, seats, colorKey, carClass, serviceTypes, setDraft]);

  const save = () =>
    run(async () => {
      if (!year || !seats) throw { code: "SEATS_REQUIRED" };
      if (!carClass) throw { code: "CAR_CLASS_REQUIRED" };
      const info = { brand, model, plate: joinPlate(plate), year, seats, colorKey, carClass, serviceTypes };
      onSaved(
        await api.saveCar({
          ...info,
          techPassportFrontRef: tpFront.upload?.ref ?? "",
          techPassportBackRef: tpBack.upload?.ref ?? "",
          carPhotoRef: photo.upload?.ref ?? "",
        })
      );
    });

  const ready = !!brand && !!model && !!plate.region && !!plate.rest.trim() && !!year && !!seats && !!colorKey && !!carClass && (!details || serviceTypes.length > 0) && tpCount === 2 && !!photo.upload;
  const colorName = colorKey ? t(`color.${colorKey}` as TranslationKey) : "";

  return (
    <RegShell
      step={3}
      onBack={onBack}
      showHelp
      title={t("reg.carTitle")}
      desc={t("reg.carDesc")}
      footer={
        <Button size="lg" fullWidth loading={busy} disabled={!ready || uploads.busy} onClick={save}>
          {t("common.continue")}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <PickerField
          label={t("reg.brand")}
          value={brand || undefined}
          options={options.carBrands.map((b) => ({ value: b.brand, label: b.brand }))}
          onChange={(b) => {
            setBrand(b);
            if (b !== brand) setModel("");
          }}
          error={fieldMsg(error, "MODEL_REQUIRED")}
        />
        <PickerField
          label={t("reg.model")}
          value={model || undefined}
          options={models.map((m) => ({ value: m, label: m }))}
          onChange={setModel}
          disabled={!brand}
          placeholder={brand ? undefined : t("reg.pickBrandFirst")}
        />
      </div>
      <PlateField value={plate} onChange={setPlate} error={fieldMsg(error, "PLATE_INVALID")} />
      <div className="grid grid-cols-2 gap-3">
        <PickerField label={t("reg.year")} value={year} options={options.years.map((y) => ({ value: y, label: String(y) }))} onChange={setYear} />
        <PickerField
          label={t("reg.seatsShort")}
          value={seats}
          options={options.seatCounts.map((n) => ({ value: n, label: t("reg.seatsValue", { n }) }))}
          onChange={setSeats}
          icon={<Armchair className="h-[18px] w-[18px]" />}
        />
      </div>

      <div className="flex flex-col gap-2.5" role="radiogroup" aria-labelledby="car-color">
        <FieldLabel id="car-color">{colorName ? t("reg.colorLabel", { color: colorName }) : t("personal.carColor")}</FieldLabel>
        <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 py-1.5">
          {options.carColors.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={colorKey === c.key}
              aria-label={t(`color.${c.key}` as TranslationKey)}
              onClick={() => setColorKey(c.key)}
              className={cn(
                "press h-11 w-11 shrink-0 rounded-full",
                colorKey === c.key ? "shadow-[0_0_0_3px_rgb(var(--color-bg-rgb)),0_0_0_5px_rgb(var(--color-text-rgb))]" : "shadow-[inset_0_0_0_1px_var(--color-control-off)]"
              )}
              style={{ background: c.hex }}
            />
          ))}
        </div>
        {fieldMsg(error, "COLOR_REQUIRED") && <p role="alert" className="text-13 font-semibold text-danger">{error?.msg}</p>}
      </div>

      {details && (
      <div className="flex flex-col gap-2.5" role="group" aria-labelledby="car-service">
        <FieldLabel id="car-service">{t("reg.serviceType")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {options.serviceTypes.map((s) => {
            const Icon = SERVICE_ICON[s];
            const on = serviceTypes.includes(s);
            return (
              <Chip key={s} selected={on} onClick={() => setServiceTypes((xs) => (on ? xs.filter((x) => x !== s) : [...xs, s]))}>
                <Icon className={cn("h-4 w-4", on && "text-brand dark:text-brand-ink")} />
                {t(`service.${s}`)}
              </Chip>
            );
          })}
        </div>
        {fieldMsg(error, "SERVICE_TYPE_REQUIRED") && <p role="alert" className="text-13 font-semibold text-danger">{error?.msg}</p>}
      </div>
      )}

      <div className="flex flex-col gap-2.5" role="radiogroup" aria-labelledby="car-class">
        <FieldLabel id="car-class">{t("reg.carClass")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {options.carClasses.map((c) => (
            <Chip key={c} role="radio" aria-pressed={undefined} aria-checked={carClass === c} selected={carClass === c} onClick={() => setCarClass(c)}>
              {t(`carClass.${c}`)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex gap-2.5 pt-1">
        <PhotoTile
          label={t("reg.techPassport")}
          status={{ text: tpCount === 0 ? t("reg.bothSides") : tpCount === 2 ? t("reg.photoUploaded") : t("reg.sidesDone", { n: tpCount }), done: tpCount === 2 }}
          upload={tpFront.upload}
          busy={tpFront.busy || tpBack.busy}
          onPick={() => setPassportOpen(true)}
        />
        <PhotoTile label={t("reg.carPhoto")} upload={photo.upload} busy={photo.busy} onPick={() => uploads.pick("car_photo")} />
      </div>
      {uploads.fileInputs}
      {uploads.error && <FormNotice>{uploads.error}</FormNotice>}
      {(fieldMsg(error, "SEATS_REQUIRED", "CAR_CLASS_REQUIRED") || (error && !shown.includes(error.code ?? ""))) && <FormNotice>{error?.msg}</FormNotice>}

      <Sheet open={passportOpen} onClose={() => setPassportOpen(false)} title={t("reg.techPassport")}>
        <div className="flex gap-2.5 pb-2">
          <PhotoTile label={t("reg.sideFront")} upload={tpFront.upload} busy={tpFront.busy} onPick={() => uploads.pick("tech_passport_front")} />
          <PhotoTile label={t("reg.sideBack")} upload={tpBack.upload} busy={tpBack.busy} onPick={() => uploads.pick("tech_passport_back")} />
        </div>
        <Button size="md" fullWidth className="mb-1 mt-3" variant="secondary" onClick={() => setPassportOpen(false)}>
          {t("common.done")}
        </Button>
      </Sheet>
    </RegShell>
  );
}

// -------------------------------------------------------------- 4. selfie

export function SelfieStep({ options, draft, setDraft, onSaved, onBack }: StepProps & { onSubmitted?: () => void }) {
  const { t } = useT();
  const links = useLegalLinks();
  const uploads = useDocUploads(["selfie"], draft.uploads, !!options.realDocuments, (slot, u) => setDraft((x) => ({ ...x, uploads: { ...x.uploads, [slot]: u } })));
  const selfie = uploads.get("selfie");
  const [terms, setTerms] = useState(false);
  const { busy, error, run } = useSubmit(t);

  const submit = () =>
    run(async () => {
      const review = await api.submitRegistration({ selfieRef: selfie.upload?.ref ?? "", acceptTerms: terms });
      onSaved({ stage: "review", documentsReviewId: review.id });
    });

  const tips = [
    { key: "reg.selfieTip1", icon: Check },
    { key: "reg.selfieTip2", icon: X },
    { key: "reg.selfieTip3", icon: Sun },
  ] as const;

  return (
    <RegShell
      step={4}
      onBack={onBack}
      showHelp
      title={t("reg.selfieTitle")}
      desc={t("reg.selfieDesc")}
      footer={
        selfie.upload ? (
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-field bg-raised p-3.5">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-brand-ink" />
              <span className="text-13 leading-[19px] text-ink">
                <LegalSentence template="reg.accept" termsKey="reg.acceptTerms" privacyKey="reg.acceptPrivacy" links={links} />
              </span>
            </label>
            <Button size="lg" fullWidth loading={busy} disabled={!terms || uploads.busy} onClick={submit}>
              {t("reg.submitDocs")}
            </Button>
          </div>
        ) : (
          <Button size="lg" fullWidth loading={selfie.busy} onClick={() => uploads.pick("selfie")}>
            {t("reg.takeSelfie")}
          </Button>
        )
      }
    >
      <div className="flex justify-center py-1">
        <button
          type="button"
          onClick={() => uploads.pick("selfie")}
          disabled={selfie.busy}
          aria-label={selfie.upload ? t("reg.retake") : t("reg.takeSelfie")}
          className="press relative h-[276px] w-[224px] shrink-0 rounded-[50%] bg-brand-soft p-2.5"
        >
          <span className="relative flex h-full w-full items-end justify-center overflow-hidden rounded-[50%] border-[3px] border-brand bg-ph-1">
            {selfie.upload?.preview ? (
              <img src={selfie.upload.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center" aria-hidden="true">
                <span className="mb-3 h-[92px] w-[92px] rounded-full bg-ph-2" />
                <span className="h-[86px] w-[150px] rounded-t-full bg-ph-2" />
              </span>
            )}
            {selfie.upload && !selfie.upload.preview && (
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <ScanFace className="h-12 w-12 text-brand-ink" />
              </span>
            )}
          </span>
        </button>
      </div>
      {uploads.fileInputs}
      {selfie.upload && (
        <button type="button" onClick={() => uploads.pick("selfie")} className="press mx-auto flex h-11 items-center px-3 text-sm font-bold text-brand-ink">
          {t("reg.retake")}
        </button>
      )}
      <ul className="flex flex-col gap-2.5">
        {tips.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-center gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-brand-soft text-brand-ink" aria-hidden="true">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="text-sm font-bold text-ink">{t(key)}</span>
          </li>
        ))}
      </ul>
      {uploads.error && <FormNotice>{uploads.error}</FormNotice>}
      {error && <FormNotice>{error.msg}</FormNotice>}
    </RegShell>
  );
}
