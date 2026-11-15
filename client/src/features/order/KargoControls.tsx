import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Info, Minus, Package, Plus, UserRound, Users, Warehouse as WarehouseIcon } from "@/lib/icons";
import { api } from "@/api/client";
import type { CargoInfo, CargoInfoTopic, CargoRules, RideAlong, Warehouse } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { Switch } from "@/components/Switch";
import { formatKm, formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

type SegOption<T extends string> = { id: T; label: string; disabled?: boolean };

/**
 * Equal-width segmented control (iOS look under data-platform="ios"), with
 * per-option disabled state — Kargo tabs, loaders, pricing mode.
 */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  ariaLabelledBy,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  function onKeyDown(e: KeyboardEvent) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const usable = options.filter((o) => !o.disabled);
    const i = usable.findIndex((o) => o.id === value);
    const next = usable[(i + d + usable.length) % usable.length];
    if (next) {
      onChange(next.id);
      refs.current.get(next.id)?.focus();
    }
  }
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onKeyDown={onKeyDown}
      className="grid gap-1 rounded-xl bg-ink/5 p-1 ios:rounded-[9px] ios:bg-[var(--ios-fill-tertiary)] ios:p-0.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              if (el) refs.current.set(o.id, el);
              else refs.current.delete(o.id);
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={o.disabled || undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => !o.disabled && onChange(o.id)}
            className={cn(
              "min-h-[40px] min-w-0 rounded-lg px-1 text-[13px] font-semibold leading-tight transition-colors ios:min-h-[32px] ios:rounded-[7px]",
              on ? "bg-card text-ink shadow-softer ios:shadow-[0_3px_8px_rgba(0,0,0,0.12)]" : "text-ink/70 hover:text-ink",
              o.disabled && "cursor-not-allowed text-ink/35 hover:text-ink/35"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Kargo tabs: Shahar ichi / Shaharlararo / Marketpleysga. */
export function CargoTabs({ rules, value, onChange }: { rules: CargoRules; value: string; onChange: (v: CargoRules["tabs"][number]["id"]) => void }) {
  const { t } = useT();
  return (
    <Seg
      ariaLabel={t("kargo.tabs.label")}
      value={value as CargoRules["tabs"][number]["id"]}
      onChange={onChange}
      options={rules.tabs.map((x) => ({ id: x.id, label: t(x.labelKey as TranslationKey) }))}
    />
  );
}

/** "Yukchilar": Yo'q / 1 / 2 with the adapter's rules and price. */
export function LoadersControl({ rules, value, onChange }: { rules: CargoRules; value: number; onChange: (n: number) => void }) {
  const { t, intlTag } = useT();
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-2 pt-1">
      <p id={id} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Users className="h-4 w-4 text-ink/60" /> {t("kargo.loaders.title")}
      </p>
      <Seg
        ariaLabelledBy={id}
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={rules.loaders.counts.map((n) => ({ id: String(n), label: n === 0 ? t("kargo.loaders.none") : String(n) }))}
      />
      <p className="flex gap-1.5 text-xs text-ink/60">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          {rules.loaders.infoLines.map((l) => t(l.key as TranslationKey, l.params)).join(" · ")}
          {" · "}
          <span className="tabular">{t("kargo.loaders.price", { price: formatSom(rules.loaders.pricePerLoader, intlTag) })}</span>
        </span>
      </p>
    </section>
  );
}

/** "Narx hisobi": Marshrut bo'yicha / Soatbay, and the hours stepper. */
export function PricingModeControl({
  rules,
  tab,
  mode,
  hours,
  onMode,
  onHours,
}: {
  rules: CargoRules;
  tab: CargoRules["tabs"][number]["id"];
  mode: "route" | "hourly";
  hours: number;
  onMode: (m: "route" | "hourly") => void;
  onHours: (h: number) => void;
}) {
  const { t } = useT();
  const id = useId();
  const modes = rules.pricingModes[tab];
  const blocked = modes.find((m) => !m.available);
  const { min, max } = rules.hours;
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full bg-accent-5 text-accent transition-colors hover:bg-accent-10 disabled:opacity-40 disabled:hover:bg-accent-5 ios:bg-card";
  return (
    <section aria-labelledby={id} className="space-y-2">
      <p id={id} className="text-sm font-semibold text-ink">
        {t("kargo.mode.title")}
      </p>
      <Seg
        ariaLabelledBy={id}
        value={mode}
        onChange={onMode}
        options={modes.map((m) => ({ id: m.id, label: t(m.labelKey as TranslationKey), disabled: !m.available }))}
      />
      {blocked && <p className="text-xs text-ink/60">{t(blocked.reasonKey as TranslationKey)}</p>}
      {mode === "hourly" && (
        <div className="flex min-h-[64px] items-center gap-3 rounded-xl border border-border px-3 py-2 animate-fade-in ios:border-0 ios:bg-[var(--ios-fill-quaternary)]">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{t("kargo.hours.title")}</span>
            <span className="block text-xs text-ink/60">{t("kargo.hours.range", { min, max })}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => onHours(Math.max(min, hours - 1))} disabled={hours <= min} aria-label={t("kargo.hours.decrease")} className={btn}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[56px] whitespace-nowrap px-1 text-center text-base font-semibold text-ink tabular" aria-live="polite">
              {t("kargo.hours.value", { n: hours })}
            </span>
            <button type="button" onClick={() => onHours(Math.min(max, hours + 1))} disabled={hours >= max} aria-label={t("kargo.hours.increase")} className={btn}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** "Yetkazish haqida", "Yukchilar haqida", "Kuzov haqida", "Sug'urta". */
export function CargoInfoChips({ rules, onOpen }: { rules: CargoRules; onOpen: (topic: CargoInfoTopic) => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {rules.infoTopics.map((x) => (
        <button
          key={x.id}
          type="button"
          onClick={() => onOpen(x.id)}
          className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-ink/80 transition-colors hover:border-accent/40 hover:text-ink ios:border-0 ios:bg-[var(--ios-fill-tertiary)]"
        >
          <Info className="h-3.5 w-3.5 text-accent" /> {t(x.labelKey as TranslationKey)}
        </button>
      ))}
    </div>
  );
}

export function CargoInfoSheet({ topic, onClose }: { topic: CargoInfoTopic; onClose: () => void }) {
  const { t } = useT();
  const [info, setInfo] = useState<CargoInfo | null>(null);
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    api.getCargoInfo(topic).then(setInfo).catch(() => setError(true));
  };
  useEffect(load, [topic]);
  return (
    <Sheet open onClose={onClose} ariaLabel={info ? t(info.titleKey as TranslationKey) : t("cargo.title")}>
      <div className="px-5 pb-2 pt-3">
        {error ? (
          <button onClick={load} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
            {t("common.loadFailedRetry")}
          </button>
        ) : !info ? (
          <div className="space-y-2 pb-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
              <Package className="h-5 w-5 text-accent" /> {t(info.titleKey as TranslationKey)}
            </h2>
            <div className="space-y-2 text-sm text-ink/80">
              {info.paragraphKeys.map((k) => (
                <p key={k}>{t(k as TranslationKey)}</p>
              ))}
            </div>
            <Button fullWidth variant="secondary" className="mt-5" onClick={onClose}>
              {t("common.close")}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** "Men ham birga ketaman": the adapter says whether the cab has a seat. */
export function RideAlongRow({
  state,
  value,
  onChange,
  onRetry,
}: {
  state: RideAlong | null;
  value: boolean;
  onChange: (v: boolean) => void;
  /** Set when the adapter check failed: shows a retry instead of the reason. */
  onRetry?: () => void;
}) {
  const { t } = useT();
  const available = !!state?.available;
  return (
    <div className={cn("flex min-h-[64px] items-center gap-3 rounded-xl border border-border px-3 py-2 ios:border-0 ios:bg-[var(--ios-fill-quaternary)]", state && !available && "opacity-70")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent ios:bg-card">
        <UserRound className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{t("kargo.rideAlong")}</span>
        {!state && onRetry ? (
          <button onClick={onRetry} className="inline-flex min-h-[32px] items-center text-xs font-semibold text-danger underline">
            {t("common.loadFailedRetry")}
          </button>
        ) : (
          <span className={cn("block text-xs", available ? "text-ink/60" : "font-semibold text-ink/70")}>
            {!state ? " " : available ? t("kargo.rideAlong.desc") : t(state.reasonKey as TranslationKey)}
          </span>
        )}
      </span>
      <Switch checked={available && value} disabled={!available} onChange={() => onChange(!value)} label={t("kargo.rideAlong")} />
    </div>
  );
}

/** Marketplace warehouses as drop-off choices (nearest first). */
export function WarehouseSheet({ fromAddressId, onSelect, onClose }: { fromAddressId: string; onSelect: (w: Warehouse) => void; onClose: () => void }) {
  const { t, intlTag } = useT();
  const [list, setList] = useState<Warehouse[] | null>(null);
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    api.getMarketplaceWarehouses(fromAddressId).then(setList).catch(() => setError(true));
  };
  useEffect(load, [fromAddressId]);
  return (
    <Sheet open onClose={onClose} ariaLabel={t("kargo.warehouses.title")}>
      <div className="px-5 pt-3">
        <h2 className="mb-2 text-sm font-semibold text-ink">{t("kargo.warehouses.title")}</h2>
        {error ? (
          <button onClick={load} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
            {t("common.loadFailedRetry")}
          </button>
        ) : !list ? (
          <div className="space-y-2 pb-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <div className="divide-y divide-border pb-2">
            {list.map((w) => (
              <button
                key={w.address.id}
                type="button"
                onClick={() => onSelect(w)}
                className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left hover:bg-ink/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent">
                  <WarehouseIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink" translate="no">
                    {w.address.label}
                  </span>
                  <span className="block text-xs text-ink/60 tabular">{formatKm(w.distanceKm, intlTag)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
