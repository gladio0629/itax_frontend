import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Info, Pencil, SlidersHorizontal } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Card, CardTitle } from "@/components/Card";
import { IconButton } from "@/components/Button";
import { FilterSelect } from "@/components/FilterSelect";
import { FormDrawer } from "@/components/FormDrawer";
import { ChangeConfirmModal, type ChangeRow } from "@/components/ChangeConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { InfoNote } from "@/components/Cells";
import { NumberField } from "@/components/NumberField";
import { cn } from "@/lib/cn";
import { formatLongDate, formatNumber } from "@/lib/format";
import {
  ExampleValue,
  FUEL_SHORT,
  FuelTag,
  LEVEL_DOT,
  LEVEL_NAME,
  MARKUP_KIND,
  MiniToggle,
  SectionActions,
  extraText,
  levelCondition,
  markupText,
  som,
} from "./tariffParts";
import type { FuelKind, MarkupKind, TariffSettings, TariffSettingsPatch } from "@/api/types";

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
type Section = TariffSettingsPatch["section"];
const SECTION_TITLE: Record<Section, string> = {
  fuel: "Yoqilg'i narxlari",
  classes: "Yo'lovchi klasslari",
  bodies: "Dostavka kuzovlari",
  extras: "Qo'shimcha to'lovlar",
  levels: "Haydovchi komissiyasi",
};
const FUEL_OPTIONS: { key: FuelKind; label: string }[] = [
  { key: "gas", label: "Gaz" },
  { key: "petrol", label: "Benzin" },
];
const MARKUP_OPTIONS: { key: MarkupKind; label: string }[] = [
  { key: "percent", label: "Foiz" },
  { key: "sum", label: "Summa" },
];

type Drafts = {
  fuel: TariffSettings["fuel"];
  classes: TariffSettings["classes"];
  bodies: TariffSettings["bodies"];
  extras: TariffSettings["extras"];
  levels: TariffSettings["levels"];
};
const draftsOf = (s: TariffSettings): Drafts => structuredClone({ fuel: s.fuel, classes: s.classes, bodies: s.bodies, extras: s.extras, levels: s.levels });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Tariflar (design Tariffs, doc 2.5 tariff model 2026-11-22). The admin only
 * edits inputs; every price, example and total comes from the server.
 * Each section: edit → "Saqlash" → confirm modal (old → new) → "Tasdiqlash"
 * sends one request; "Bekor qilish" discards the section's edits.
 */
export function TariffsScreen() {
  const [cityId, setCityId] = useState<string>("");
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [saved, setSaved] = useState<TariffSettings | null>(null);
  const [draft, setDraft] = useState<Drafts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<"bodies" | "extras" | "levels" | null>(null);
  const [pending, setPending] = useState<{ section: Section; rows: ChangeRow[]; patch: TariffSettingsPatch } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!caps.tariffSettings) return;
    let live = true;
    setLoading(true);
    setError(null);
    api
      .getTariffSettings(cityId || null)
      .then((s) => {
        if (!live) return;
        setSaved(s);
        setDraft(draftsOf(s));
      })
      .catch((e) => live && setError(errorText(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [cityId]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    if (caps.tariffSettings && caps.tariffCities) api.getTariffCities().then(setCities).catch(() => setCities([]));
  }, []);

  const header = (
    <PageHeader
      subtitle="Yoqilg'i narxi va ustamalar"
      title="Tariflar"
      actions={
        caps.tariffCities && cities.length > 0 ? (
          <FilterSelect
            label="Shahar"
            aria-label="Shahar"
            value={cityId}
            onChange={setCityId}
            options={[{ value: "", label: "Hamma viloyatlar" }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
          />
        ) : undefined
      }
    />
  );

  if (!caps.tariffSettings) {
    return (
      <>
        {header}
        <EmptyState
          icon={<SlidersHorizontal />}
          title="Yangi tarif modeli serverda hali yo'q"
          description="Yoqilg'i narxi, ustamalar va daraja komissiyalari backend tayyor bo'lgach shu yerda tahrirlanadi."
        />
      </>
    );
  }
  if (error && !saved) {
    return (
      <>
        {header}
        <ErrorState message={error} onRetry={load} retrying={loading} />
      </>
    );
  }
  if (!saved || !draft) {
    return (
      <>
        {header}
        <Skeleton className="h-[170px] rounded-card" />
        <div className="grid gap-4 xl:grid-cols-[1fr_2.2fr]">
          <Skeleton className="h-[300px] rounded-card" />
          <Skeleton className="h-[300px] rounded-card" />
        </div>
      </>
    );
  }

  const dirty = (s: Section) => !same(draft[s], saved[s]);
  const reset = (s: Section) => setDraft((d) => (d ? { ...d, [s]: structuredClone(saved[s]) } : d));
  const set = <S extends Section>(s: S, value: Drafts[S]) => setDraft((d) => (d ? { ...d, [s]: value } : d));

  // --- old → new rows per section (only what changed, with units) -------
  function rowsFor(s: Section): ChangeRow[] {
    const rows: ChangeRow[] = [];
    if (s === "fuel")
      draft!.fuel.forEach((f, i) => {
        const o = saved!.fuel[i];
        if (f.pricePerLitre !== o.pricePerLitre) rows.push({ label: `${o.label}, 1 litr`, before: som(o.pricePerLitre), after: som(f.pricePerLitre) });
      });
    const markupRows = (name: string, o: { fuel: FuelKind; markupKind: MarkupKind; markupValue: number }, n: typeof o) => {
      if (o.fuel !== n.fuel) rows.push({ label: `${name}: yoqilg'i`, before: FUEL_SHORT[o.fuel], after: FUEL_SHORT[n.fuel] });
      // A kind switch is its own row, so "60" can't silently turn into 60 so'm.
      if (o.markupKind !== n.markupKind) rows.push({ label: `${name}: ustama turi`, before: MARKUP_KIND[o.markupKind], after: MARKUP_KIND[n.markupKind] });
      if (o.markupKind !== n.markupKind || o.markupValue !== n.markupValue)
        rows.push({ label: `${name}: ustama`, before: markupText(o.markupKind, o.markupValue), after: markupText(n.markupKind, n.markupValue) });
    };
    if (s === "classes") draft!.classes.forEach((c, i) => markupRows(c.label, saved!.classes[i], c));
    if (s === "bodies") draft!.bodies.forEach((b, i) => markupRows(`Kuzov ${b.size}`, saved!.bodies[i], b));
    if (s === "extras")
      draft!.extras.forEach((e, i) => {
        const o = saved!.extras[i];
        if (e.value !== o.value) rows.push({ label: o.label, before: extraText(o.unit, o.value), after: extraText(e.unit, e.value) });
      });
    if (s === "levels")
      draft!.levels.forEach((l, i) => {
        const o = saved!.levels[i];
        const name = LEVEL_NAME[l.level];
        if (l.commissionPct !== o.commissionPct) rows.push({ label: `${name}: komissiya`, before: `${o.commissionPct}%`, after: `${l.commissionPct}%` });
        if (levelCondition(l) !== levelCondition(o)) rows.push({ label: `${name}: shart`, before: levelCondition(o), after: levelCondition(l) });
      });
    return rows;
  }

  function patchFor(s: Section): TariffSettingsPatch {
    const d = draft!;
    switch (s) {
      case "fuel":
        return { section: "fuel", fuel: d.fuel.map((f) => ({ kind: f.kind, pricePerLitre: f.pricePerLitre })) };
      case "classes":
        return { section: "classes", classes: d.classes.map((c) => ({ key: c.key, fuel: c.fuel, markupKind: c.markupKind, markupValue: c.markupValue })) };
      case "bodies":
        return { section: "bodies", bodies: d.bodies.map((b) => ({ size: b.size, fuel: b.fuel, markupKind: b.markupKind, markupValue: b.markupValue })) };
      case "extras":
        return { section: "extras", extras: d.extras.map((e) => ({ key: e.key, value: e.value, unit: e.unit })) };
      case "levels":
        return { section: "levels", levels: d.levels.map((l) => ({ ...l })) };
    }
  }

  // Inputs must be numbers (NaN marks an empty/invalid box); ranges are the server's call.
  const validNum = (n: number) => Number.isFinite(n) && n >= 0;
  function valid(s: Section): boolean {
    const d = draft!;
    if (s === "fuel") return d.fuel.every((f) => validNum(f.pricePerLitre));
    if (s === "classes") return d.classes.every((c) => validNum(c.markupValue));
    if (s === "bodies") return d.bodies.every((b) => validNum(b.markupValue));
    if (s === "extras") return d.extras.every((e) => validNum(e.value));
    return d.levels.every((l) => validNum(l.commissionPct));
  }

  function askSave(s: Section) {
    if (!dirty(s) || !valid(s)) return;
    setSaveError(null);
    setPending({ section: s, rows: rowsFor(s), patch: patchFor(s) });
  }

  async function confirmSave() {
    if (!pending || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await api.updateTariffSettings(cityId || null, pending.patch);
      // Keep other sections' unsaved edits; take the saved section from the server.
      setSaved(next);
      setDraft((d) => (d ? { ...d, [pending.section]: structuredClone(next[pending.section]) } : draftsOf(next)));
      setToast(`${SECTION_TITLE[pending.section]}: saqlandi`);
      setPending(null);
      setEditor(null);
    } catch (e) {
      // Keep the modal and the draft.
      setSaveError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  function cancelSave() {
    if (!pending) return;
    // "Bekor qilish" discards the section's edits.
    reset(pending.section);
    setPending(null);
    setEditor(null);
  }

  const pricingStale = dirty("fuel") || dirty("classes");
  const km = saved.exampleDistanceKm;

  return (
    <>
      {header}

      {saved.example && <ExampleCard example={saved.example} stale={pricingStale} />}

      <InfoNote icon={<Info className="h-[18px] w-[18px]" aria-hidden />}>
        O'zgarish "Tasdiqlash" bosilgandan keyin yangi buyurtmalarga qo'llanadi va <b className="text-ink">audit jurnaliga</b> yoziladi. Oldindan berilgan
        buyurtmalarda narx qotirilgan.
      </InfoNote>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_2.2fr]">
        {/* Fuel */}
        <Card className="flex flex-col gap-2.5">
          <CardTitle sub="1 litr uchun, hamma hisob shundan">{SECTION_TITLE.fuel}</CardTitle>
          {draft.fuel.map((f, i) => (
            <div key={f.kind} className="flex items-center gap-3 border-b border-line py-3">
              <FuelTag kind={f.kind} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold">{f.label}</span>
                {f.updatedAt !== null && <span className="text-xs font-semibold text-muted">Yangilandi: {formatLongDate(f.updatedAt).split(",")[0]}</span>}
              </span>
              <NumberField
                label={`${f.label}, 1 litr narxi`}
                value={Number.isFinite(f.pricePerLitre) ? f.pricePerLitre : null}
                onChange={(v) => set("fuel", draft.fuel.map((x, j) => (j === i ? { ...x, pricePerLitre: v ?? NaN } : x)))}
                unit="so'm"
                width={130}
                changed={f.pricePerLitre !== saved.fuel[i].pricePerLitre}
              />
            </div>
          ))}
          <p className="flex items-start gap-2 text-xs leading-[18px] text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Narx o'zgarsa, faqat shu yerni yangilang: hamma klass va kuzov narxini server qayta hisoblaydi.
          </p>
          <SectionActions dirty={dirty("fuel")} valid={valid("fuel")} onSave={() => askSave("fuel")} onReset={() => reset("fuel")} />
        </Card>

        {/* Classes */}
        <Card className="flex min-w-0 flex-col gap-2">
          <CardTitle right={<span className="inline-flex h-[26px] items-center rounded-lg bg-surface px-2.5 text-xs font-bold">Ustama: foiz yoki summa</span>}>
            {SECTION_TITLE.classes}
          </CardTitle>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Klass", "Yoqilg'i", "Ustama turi", "Ustama", km ? `Misol, ${km} km` : "Misol"].map((h, i) => (
                    <th key={h} scope="col" className={cn("pb-2 pr-3 text-2xs font-bold uppercase tracking-[0.6px] text-muted", i === 4 && "pr-0 text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.classes.map((c, i) => {
                  const o = saved.classes[i];
                  const upd = (patch: Partial<typeof c>) => set("classes", draft.classes.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <tr key={c.key} className="border-b border-line last:border-0">
                      <th scope="row" className="h-16 pr-3">
                        <span className="flex flex-col gap-0.5">
                          <span className="text-15 font-extrabold">{c.label}</span>
                          {c.seats !== null && <span className="text-xs font-semibold text-muted">{c.seats} o'rin</span>}
                        </span>
                      </th>
                      <td className="pr-3">
                        <MiniToggle label={`${c.label} yoqilg'isi`} value={c.fuel} options={FUEL_OPTIONS} onChange={(fuel) => upd({ fuel })} changed={c.fuel !== o.fuel} />
                      </td>
                      <td className="pr-3">
                        <MiniToggle
                          label={`${c.label} ustama turi`}
                          value={c.markupKind}
                          options={MARKUP_OPTIONS}
                          onChange={(markupKind) => upd({ markupKind })}
                          changed={c.markupKind !== o.markupKind}
                        />
                      </td>
                      <td className="pr-3">
                        <NumberField
                          size="row"
                          label={`${c.label} ustamasi, ${c.markupKind === "percent" ? "%" : "so'm"}`}
                          value={Number.isFinite(c.markupValue) ? c.markupValue : null}
                          onChange={(v) => upd({ markupValue: v ?? NaN })}
                          unit={c.markupKind === "percent" ? "%" : "so'm"}
                          changed={c.markupValue !== o.markupValue || c.markupKind !== o.markupKind}
                        />
                      </td>
                      <td className="text-right">
                        <ExampleValue value={c.examplePrice} stale={pricingStale} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SectionActions dirty={dirty("classes")} valid={valid("classes")} onSave={() => askSave("classes")} onReset={() => reset("classes")} />
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* Bodies (view; edited in a drawer) */}
        <Card className="flex min-w-0 flex-col gap-4">
          <CardTitle sub="Har kuzov uchun yoqilg'i va ustama" right={<EditButton label="Kuzov ustamalarini o'zgartirish" onClick={() => setEditor("bodies")} />}>
            {SECTION_TITLE.bodies}
          </CardTitle>
          <div className="min-w-0 overflow-x-auto rounded-box shadow-hairline">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-surface">
                  {["Kuzov", "Yoqilg'i", "Ustama turi", "Ustama", km ? `Asosiy, ${km} km` : "Asosiy", km ? `Misol, ${km} km` : "Misol"].map((h, i) => (
                    <th key={h} scope="col" className={cn("h-11 whitespace-nowrap px-3 text-2xs font-bold uppercase tracking-[0.6px] text-muted", i >= 3 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {saved.bodies.map((b) => (
                  <tr key={b.size} className="border-b border-line last:border-0">
                    <td className="h-12 px-3">
                      <span className="inline-flex h-[26px] items-center rounded-lg bg-ink px-2.5 text-xs font-bold text-white">{b.size}</span>
                    </td>
                    <td className="px-3">
                      <FuelTag kind={b.fuel} />
                    </td>
                    <td className="px-3 font-semibold">{MARKUP_KIND[b.markupKind]}</td>
                    <td className="tabular whitespace-nowrap px-3 text-right font-bold">{markupText(b.markupKind, b.markupValue)}</td>
                    <td className="tabular whitespace-nowrap px-3 text-right font-semibold text-muted">{b.exampleBase !== null ? formatNumber(b.exampleBase) : "—"}</td>
                    <td className="tabular whitespace-nowrap px-3 text-right font-extrabold">{b.examplePrice !== null ? formatNumber(b.examplePrice) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Extras */}
          <Card className="flex flex-col gap-2">
            <CardTitle right={<EditButton label="Qo'shimcha to'lovlarni o'zgartirish" onClick={() => setEditor("extras")} />}>{SECTION_TITLE.extras}</CardTitle>
            <dl className="flex flex-col">
              {saved.extras.map((e, i) => (
                <div key={e.key} className={cn("flex min-h-[42px] items-center justify-between gap-3", i < saved.extras.length - 1 && "border-b border-line")}>
                  <dt className="text-sm font-semibold text-muted">{e.label}</dt>
                  <dd className="tabular text-right text-sm font-extrabold">{extraText(e.unit, e.value)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Levels */}
          <Card className="flex flex-col gap-1.5">
            <CardTitle right={<EditButton label="Daraja komissiyalarini o'zgartirish" onClick={() => setEditor("levels")} />}>{SECTION_TITLE.levels}</CardTitle>
            <ul className="flex flex-col">
              {saved.levels.map((l, i) => (
                <li key={l.level} className={cn("flex min-h-[52px] items-center gap-3", i < saved.levels.length - 1 && "border-b border-line")}>
                  <span aria-hidden className={cn("h-3.5 w-3.5 shrink-0 rounded-full", LEVEL_DOT[l.level])} />
                  <span className="flex-1 text-sm font-bold">{LEVEL_NAME[l.level]}</span>
                  <span className="text-right text-xs font-semibold text-muted">{levelCondition(l)}</span>
                  <span className="tabular w-14 text-right text-base font-extrabold">{l.commissionPct}%</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Drawer editors for bodies / extras / levels */}
      <FormDrawer
        open={editor === "bodies"}
        onClose={() => {
          reset("bodies");
          setEditor(null);
        }}
        title={SECTION_TITLE.bodies}
        onSubmit={() => askSave("bodies")}
        disabled={!dirty("bodies") || !valid("bodies")}
      >
        {draft.bodies.map((b, i) => {
          const o = saved.bodies[i];
          const upd = (patch: Partial<typeof b>) => set("bodies", draft.bodies.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <fieldset key={b.size} className="flex flex-col gap-2 border-b border-line pb-3">
              <legend className="mb-2 inline-flex h-[26px] items-center rounded-lg bg-ink px-2.5 text-xs font-bold text-white">Kuzov {b.size}</legend>
              <div className="flex flex-wrap items-center gap-2">
                <MiniToggle label={`Kuzov ${b.size} yoqilg'isi`} value={b.fuel} options={FUEL_OPTIONS} onChange={(fuel) => upd({ fuel })} changed={b.fuel !== o.fuel} />
                <MiniToggle
                  label={`Kuzov ${b.size} ustama turi`}
                  value={b.markupKind}
                  options={MARKUP_OPTIONS}
                  onChange={(markupKind) => upd({ markupKind })}
                  changed={b.markupKind !== o.markupKind}
                />
                <NumberField
                  label={`Kuzov ${b.size} ustamasi, ${b.markupKind === "percent" ? "%" : "so'm"}`}
                  value={Number.isFinite(b.markupValue) ? b.markupValue : null}
                  onChange={(v) => upd({ markupValue: v ?? NaN })}
                  unit={b.markupKind === "percent" ? "%" : "so'm"}
                  changed={b.markupValue !== o.markupValue || b.markupKind !== o.markupKind}
                />
              </div>
            </fieldset>
          );
        })}
      </FormDrawer>

      <FormDrawer
        open={editor === "extras"}
        onClose={() => {
          reset("extras");
          setEditor(null);
        }}
        title={SECTION_TITLE.extras}
        onSubmit={() => askSave("extras")}
        disabled={!dirty("extras") || !valid("extras")}
      >
        {draft.extras.map((e, i) => (
          <EditorRow key={e.key} label={e.label}>
            <NumberField
              label={`${e.label}, ${e.unit === "min" ? "daqiqa" : "so'm"}`}
              value={Number.isFinite(e.value) ? e.value : null}
              onChange={(v) => set("extras", draft.extras.map((x, j) => (j === i ? { ...x, value: v ?? NaN } : x)))}
              unit={e.unit === "min" ? "daqiqa" : "so'm"}
              width={160}
              changed={e.value !== saved.extras[i].value}
            />
          </EditorRow>
        ))}
      </FormDrawer>

      <FormDrawer
        open={editor === "levels"}
        onClose={() => {
          reset("levels");
          setEditor(null);
        }}
        title={SECTION_TITLE.levels}
        onSubmit={() => askSave("levels")}
        disabled={!dirty("levels") || !valid("levels")}
      >
        <p className="px-1 text-xs font-medium text-muted">Bo'sh shart = shart yo'q (boshlang'ich daraja). Daraja va komissiyani server hisoblaydi.</p>
        {draft.levels.map((l, i) => {
          const o = saved.levels[i];
          const upd = (patch: Partial<typeof l>) => set("levels", draft.levels.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          const name = LEVEL_NAME[l.level];
          return (
            <fieldset key={l.level} className="flex flex-col gap-1 border-b border-line pb-3">
              <legend className="mb-2 flex items-center gap-2 text-sm font-extrabold">
                <span aria-hidden className={cn("h-3.5 w-3.5 rounded-full", LEVEL_DOT[l.level])} /> {name}
              </legend>
              <EditorRow label="Komissiya">
                <NumberField
                  label={`${name}: komissiya, %`}
                  value={Number.isFinite(l.commissionPct) ? l.commissionPct : null}
                  onChange={(v) => upd({ commissionPct: v ?? NaN })}
                  unit="%"
                  decimals={1}
                  width={120}
                  changed={l.commissionPct !== o.commissionPct}
                />
              </EditorRow>
              <EditorRow label="Kamida safar, haftasiga">
                <NumberField
                  label={`${name}: kamida safar haftasiga`}
                  value={l.minTripsWeek}
                  onChange={(v) => upd({ minTripsWeek: v })}
                  unit="ta"
                  width={120}
                  changed={l.minTripsWeek !== o.minTripsWeek}
                />
              </EditorRow>
              <EditorRow label="Eng kam reyting">
                <NumberField
                  label={`${name}: eng kam reyting`}
                  value={l.minRating}
                  onChange={(v) => upd({ minRating: v })}
                  decimals={1}
                  width={120}
                  changed={l.minRating !== o.minRating}
                />
              </EditorRow>
              <EditorRow label="Bekor qilish chegarasi, haftasiga">
                <NumberField
                  label={`${name}: bekor qilish chegarasi haftasiga`}
                  value={l.maxCancelsWeek}
                  onChange={(v) => upd({ maxCancelsWeek: v })}
                  unit="ta"
                  width={120}
                  changed={l.maxCancelsWeek !== o.maxCancelsWeek}
                />
              </EditorRow>
            </fieldset>
          );
        })}
      </FormDrawer>

      <ChangeConfirmModal
        open={!!pending}
        title={pending ? `${SECTION_TITLE[pending.section]}: tasdiqlang` : ""}
        rows={pending?.rows ?? []}
        loading={saving}
        error={saveError}
        onConfirm={confirmSave}
        onCancel={cancelSave}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconButton label={label} onClick={onClick}>
      <Pencil className="h-4 w-4" aria-hidden />
    </IconButton>
  );
}

function EditorRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

/** The dark "Narx qanday hisoblanadi" card: the server's own example. */
function ExampleCard({ example, stale }: { example: NonNullable<TariffSettings["example"]>; stale: boolean }) {
  const cell = (label: string, value: string, accent?: boolean) => (
    <span className={cn("flex min-w-[120px] flex-1 flex-col gap-1 rounded-field px-4 py-3.5", accent ? "bg-green text-ink" : "bg-ink-2 text-white")}>
      <span className={cn("label-caps", accent ? "text-ink" : "text-ink-muted")}>{label}</span>
      {/* Wraps instead of running into the next cell on narrow screens. */}
      <span className="tabular break-words text-xl font-extrabold xl:text-22">{value}</span>
    </span>
  );
  const op = (s: string) => (
    <span aria-hidden className="shrink-0 text-[26px] font-extrabold text-ink-muted">
      {s}
    </span>
  );
  return (
    <section className={cn("flex flex-col gap-4 rounded-card bg-ink px-6 py-[22px] transition-opacity", stale && "opacity-70")} aria-label="Narx qanday hisoblanadi">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col gap-1">
          <h2 className="text-lg font-extrabold text-white">Narx qanday hisoblanadi</h2>
          <span className="text-13 font-semibold text-ink-muted">
            Asosiy narx = masofa × 1 litr yoqilg'i narxi. Ustiga har klass uchun ustama qo'shiladi: foiz yoki aniq summa.
          </span>
        </span>
        <span className="inline-flex h-[26px] items-center rounded-lg bg-ink-2 px-2.5 text-xs font-bold text-white">
          {stale ? "Saqlangan qiymatlar bo'yicha" : `Misol: ${example.title}`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {cell("Masofa", `${formatNumber(example.distanceKm)} km`)}
        {op("×")}
        {cell(example.fuelLabel, som(example.fuelPrice))}
        {op("=")}
        {cell("Asosiy narx", som(example.base))}
        {op("+")}
        {cell(example.markupLabel, som(example.markup))}
        {op("=")}
        {cell("Yo'lovchi to'laydi", som(example.total), true)}
      </div>
    </section>
  );
}
