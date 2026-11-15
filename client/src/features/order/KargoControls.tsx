import { useEffect, useId, useState } from "react";
import { Info, Minus, Package, Plus, UserRound, Warehouse as WarehouseIcon } from "@/lib/icons";
import { api } from "@/api/client";
import type { CargoInfo, CargoInfoTopic, CargoRules, RideAlong, Warehouse } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { Switch } from "@/components/Switch";
import { Segmented } from "@/components/ui/Segmented";
import { TextTabs } from "@/components/ui/TextTabs";
import { Chip } from "@/components/ui/Chip";
import { formatKm, formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

/** Kargo's segmented controls are the shared gray-track Segmented. */
export const Seg = Segmented;

/** Kargo tabs: text tabs with the thick underline. */
export function CargoTabs({ rules, value, onChange }: { rules: CargoRules; value: string; onChange: (v: CargoRules["tabs"][number]["id"]) => void }) {
  const { t } = useT();
  return (
    <TextTabs
      ariaLabel={t("kargo.tabs.label")}
      value={value as CargoRules["tabs"][number]["id"]}
      onChange={onChange}
      options={rules.tabs.map((x) => ({ id: x.id, label: t(x.labelKey as TranslationKey) }))}
    />
  );
}

/** "Yukchilar": label and the selected rule on the left, Yo'q / 1 / 2 on the
 * right (as the reference lays it out); price and the other rule below. */
export function LoadersControl({ rules, value, onChange }: { rules: CargoRules; value: number; onChange: (n: number) => void }) {
  const { t, intlTag } = useT();
  const id = useId();
  const rule = rules.loaders.infoLines.find((l) => l.params?.n === value);
  return (
    <section aria-labelledby={id} className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span id={id} className="block text-control text-ink">
            {t("kargo.loaders.title")}
          </span>
          <span className="block text-sub text-ink/60">{rule ? t(rule.key as TranslationKey, rule.params) : t("kargo.loaders.noneDesc")}</span>
        </span>
        <Segmented
          size="sm"
          className="w-[148px] shrink-0"
          ariaLabelledBy={id}
          value={String(value)}
          onChange={(v) => onChange(Number(v))}
          options={rules.loaders.counts.map((n) => ({ id: String(n), label: n === 0 ? t("kargo.loaders.none") : String(n) }))}
        />
      </div>
      <p className="text-sub text-ink/60 tabular">{t("kargo.loaders.price", { price: formatSom(rules.loaders.pricePerLoader, intlTag) })}</p>
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
    "flex h-11 w-11 items-center justify-center rounded-full bg-fill text-ink transition-colors hover:bg-ink/10 disabled:opacity-40 disabled:hover:bg-fill";
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h3 id={id} className="text-section font-bold text-ink">
        {t("kargo.mode.title")}
      </h3>
      <Segmented
        ariaLabelledBy={id}
        value={mode}
        onChange={onMode}
        options={modes.map((m) => ({ id: m.id, label: t(m.labelKey as TranslationKey), disabled: !m.available }))}
      />
      {blocked && <p className="text-sub text-ink/60">{t(blocked.reasonKey as TranslationKey)}</p>}
      {mode === "hourly" && (
        <div className="flex min-h-[var(--size-row)] items-center gap-3 border-b border-hairline py-2 animate-fade-in">
          <span className="min-w-0 flex-1">
            <span className="block text-control text-ink">{t("kargo.hours.title")}</span>
            <span className="block text-sub text-ink/60">{t("kargo.hours.range", { min, max })}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => onHours(Math.max(min, hours - 1))} disabled={hours <= min} aria-label={t("kargo.hours.decrease")} className={btn}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[56px] whitespace-nowrap px-1 text-center text-body font-semibold text-ink tabular" aria-live="polite">
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

/** "Yetkazish haqida ⓘ", … — gray capsule chips. */
export function CargoInfoChips({ rules, onOpen }: { rules: CargoRules; onOpen: (topic: CargoInfoTopic) => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {rules.infoTopics.map((x) => (
        <Chip key={x.id} onClick={() => onOpen(x.id)} trailing={<Info className="h-4 w-4" />}>
          {t(x.labelKey as TranslationKey)}
        </Chip>
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
    <div className={cn("flex min-h-[var(--size-row)] items-center gap-3 py-2", state && !available && "opacity-70")}>
      <span className="flex h-[var(--size-tile)] w-[var(--size-tile)] shrink-0 items-center justify-center rounded-tile bg-fill text-ink/70">
        <UserRound className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-control text-ink">{t("kargo.rideAlong")}</span>
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
