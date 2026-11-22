import type { CargoInput, CargoRules, Quote, RideAlong } from "@/api/types";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { Icon, Screen, SectionLabel, Segmented, Steps, Switch } from "@/ui";
import { PriceFooter } from "@/features/trip/PriceFooter";
import { InfoButton } from "./CargoSheets";

type Load<T> = { status: "loading" } | { status: "error" } | { status: "success"; data: T };

/**
 * Delivery, step 3 (design: CargoTerms): loaders, pricing (by route or by
 * the hour, with hours), a seat in the cab and insurance. Counts, limits,
 * availability and prices are the server's (CargoRules, getRideAlong, quote).
 */
export function CargoTermsScreen({
  stepNames,
  current,
  rules,
  cargo,
  rideAlong,
  rideAlongError,
  onRetryRideAlong,
  quote,
  quoteReady,
  quoteError,
  onRetryQuote,
  onCargo,
  onInfo,
  onNext,
  onBack,
}: {
  stepNames: string[];
  current: number;
  rules: CargoRules;
  cargo: CargoInput;
  rideAlong: RideAlong | null;
  rideAlongError?: boolean;
  onRetryRideAlong?: () => void;
  quote: Load<Quote>;
  quoteReady: boolean;
  quoteError: string | null;
  onRetryQuote: () => void;
  onCargo: (patch: Partial<CargoInput>) => void;
  onInfo: (topic: "loaders" | "insurance" | "delivery") => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t, intlTag } = useT();
  const tab = cargo.tab ?? rules.defaultTab;
  const loaders = cargo.loaders ?? 0;
  const modes = rules.pricingModes[tab];
  const mode = cargo.pricingMode ?? "route";
  const blocked = modes.find((m) => !m.available && m.reasonKey);
  const hours = cargo.hours ?? rules.hours.min;
  const loaderRule = rules.loaders.infoLines.find((l) => l.params?.n === loaders);
  const rideOk = rideAlong?.available ?? false;

  return (
    <Screen
      title={t("cargo.v2.step.terms")}
      onBack={onBack}
      top={<Steps steps={stepNames} current={current} label={t("trip.steps")} />}
      bodyClassName="gap-3 pt-5"
      footer={
        <PriceFooter quote={quote} ready={quoteReady} label={t("cargo.v2.toPayment")} onNext={onNext} error={quoteError} onRetry={onRetryQuote} />
      }
    >
      <section className="flex flex-col gap-2" aria-label={t("cargo.v2.loaders")}>
        <div className="flex items-center justify-between">
          <SectionLabel as="h2">{t("cargo.v2.loaders")}</SectionLabel>
          <InfoButton label={t("cargo.v2.info", { topic: t("kargo.info.loaders.chip") })} onClick={() => onInfo("loaders")} />
        </div>
        <Segmented
          label={t("cargo.v2.loaders")}
          value={String(loaders)}
          onChange={(v) => onCargo({ loaders: Number(v) })}
          className="h-[52px]"
          options={rules.loaders.counts.map((n) => ({ value: String(n), label: n === 0 ? t("cargo.v2.loadersNone") : t("cargo.v2.loadersN", { n }) }))}
        />
        <p className="px-1 text-[12px] text-iz-muted">
          {loaderRule ? `${t(loaderRule.key as TranslationKey, loaderRule.params)} · ` : ""}
          {t("kargo.loaders.price", { price: formatSom(rules.loaders.pricePerLoader, intlTag) })}
        </p>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("cargo.v2.mode")}>
        <div className="flex items-center justify-between">
          <SectionLabel as="h2">{t("cargo.v2.mode")}</SectionLabel>
          <InfoButton label={t("cargo.v2.info", { topic: t("kargo.info.delivery.chip") })} onClick={() => onInfo("delivery")} />
        </div>
        <div className="flex flex-col gap-1 rounded-iz-card bg-iz-field p-1">
          <Segmented
            label={t("cargo.v2.mode")}
            value={mode}
            onChange={(v) => onCargo({ pricingMode: v, hours: v === "hourly" ? hours : undefined })}
            className="h-11 rounded-[22px] bg-transparent p-0"
            options={modes.map((m) => ({ value: m.id, label: t(m.labelKey as TranslationKey), disabled: !m.available }))}
          />
          {mode === "hourly" && (
            <div className="flex h-14 items-center gap-2.5 rounded-iz-field bg-iz-sheet pl-3.5 pr-1.5">
              <span id="hours-label" className="flex-1 text-[14px] font-bold text-iz-ink">
                {t("cargo.v2.hours")}
              </span>
              <div role="group" aria-labelledby="hours-label" className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={t("kargo.hours.decrease")}
                  disabled={hours <= rules.hours.min}
                  onClick={() => onCargo({ hours: hours - 1 })}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-iz-chip-border bg-iz-sheet text-iz-ink disabled:opacity-40"
                >
                  <Icon name="minus" size={16} />
                </button>
                <span aria-live="polite" className="min-w-[52px] text-center text-[18px] font-extrabold tabular-nums text-iz-ink">
                  {t("kargo.hours.value", { n: hours })}
                </span>
                <button
                  type="button"
                  aria-label={t("kargo.hours.increase")}
                  disabled={hours >= rules.hours.max}
                  onClick={() => onCargo({ hours: hours + 1 })}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-iz-selected text-iz-on-selected disabled:opacity-40"
                >
                  <Icon name="plusSmall" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        {blocked && <p className="px-1 text-[12px] text-iz-muted">{t(blocked.reasonKey as TranslationKey)}</p>}
      </section>

      <div className="flex flex-col rounded-[22px] border border-iz-border pl-4 pr-2">
        <div className={cn("flex min-h-16 items-center gap-3 py-2", rules.insurance.available && "border-b border-iz-border")}>
          <span className="flex flex-1 flex-col gap-px">
            <span className={cn("text-[15px] font-extrabold", rideOk ? "text-iz-ink" : "text-iz-muted")}>{t("cargo.v2.rideAlong")}</span>
            {rideAlongError ? (
              <button type="button" onClick={onRetryRideAlong} className="-my-3 flex min-h-[44px] items-center gap-1.5 self-start text-[12px] font-bold text-iz-danger">
                <Icon name="refresh" size={14} />
                {t("common.loadFailedRetry")}
              </button>
            ) : (
              <span className="text-[12px] text-iz-muted">
                {rideAlong && !rideAlong.available && rideAlong.reasonKey ? t(rideAlong.reasonKey as TranslationKey) : t("cargo.v2.rideAlongDesc")}
              </span>
            )}
          </span>
          <Switch checked={!!cargo.rideAlong && rideOk} disabled={!rideOk} label={t("cargo.v2.rideAlong")} onChange={(on) => onCargo({ rideAlong: on })} />
        </div>
        {rules.insurance.available && (
          <div className="flex min-h-16 items-center gap-2 py-2">
            <span className="flex flex-1 flex-col gap-px">
              <span className="text-[15px] font-extrabold text-iz-ink">{t("cargo.v2.insurance")}</span>
              <span className="text-[12px] text-iz-muted">{t("cargo.v2.insuranceDesc")}</span>
            </span>
            <InfoButton label={t("cargo.v2.info", { topic: t("kargo.info.insurance.chip") })} onClick={() => onInfo("insurance")} />
            <Switch checked={!!cargo.insurance} label={t("cargo.v2.insurance")} onChange={(on) => onCargo({ insurance: on })} />
          </div>
        )}
      </div>
    </Screen>
  );
}
