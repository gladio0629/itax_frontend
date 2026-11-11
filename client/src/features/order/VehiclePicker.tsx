import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { api } from "@/api/client";
import { DELIVERY_VEHICLES, type CargoInput, type DeliveryVehicle } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { useQuery } from "@/lib/useQuery";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { VehicleIllustration } from "./VehicleIllustration";

/** Brand model names stay untranslated. */
const BRAND_NAMED: DeliveryVehicle[] = ["spark", "damas", "labo", "isuzu", "isuzu2"];

/**
 * Delivery vehicle choice: a light illustration card (the hero) that crossfades
 * between vehicles, size chips underneath, then what the vehicle carries.
 * Specs (description, cargo dimensions, max weight) come from the adapter;
 * price comes from the adapter's quote — nothing is computed here.
 */
export function VehiclePicker({ value, onChange }: { value: CargoInput; onChange: (v: CargoInput) => void }) {
  const { t, intlTag } = useT();
  const specs = useQuery(() => api.getDeliveryVehicles(), []);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const first = useRef(true);

  // Keep the active chip in view (e.g. picking Fura on a narrow screen).
  useEffect(() => {
    const el = chipRefs.current[value.vehicle];
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: first.current || reduce ? "auto" : "smooth" });
    first.current = false;
  }, [value.vehicle, specs.status]);

  function select(v: DeliveryVehicle) {
    if (v !== value.vehicle) onChange({ ...value, vehicle: v });
  }

  function onKeyDown(e: KeyboardEvent) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = DELIVERY_VEHICLES.indexOf(value.vehicle);
    const n = DELIVERY_VEHICLES.length;
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n;
    const v = DELIVERY_VEHICLES[next];
    select(v);
    chipRefs.current[v]?.focus();
  }

  const name = (v: DeliveryVehicle) => t(`cargo.vehicle.${v}` as TranslationKey);
  const unit = t("cargo.unitCm");

  return (
    <div className="space-y-4">
      <p id="vehicle-title" className="text-sm font-semibold text-ink">
        {t("cargo.vehicleTitle")}
      </p>

      {specs.status === "error" ? (
        <div role="alert" className="flex items-center gap-3 rounded-card border border-border p-4">
          <p className="min-w-0 flex-1 text-sm text-ink/70">{t("cargo.loadError")}</p>
          <Button variant="secondary" size="sm" onClick={() => specs.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : specs.status === "loading" ? (
        <div className="space-y-3" aria-busy="true" aria-label={t("cargo.vehicleTitle")}>
          <Skeleton className="h-[200px] w-full rounded-card" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        (() => {
          const spec = specs.data.find((s) => s.id === value.vehicle) ?? specs.data[0];
          const d = spec.dimensionsCm;
          return (
            <div className="space-y-3">
              {/* Illustration card: stays light in both themes so the drawing reads. */}
              <div className="relative h-[200px] overflow-hidden rounded-card bg-[#F8F5EF] shadow-soft ring-1 ring-black/5">
                {specs.data.map((s) => (
                  <VehicleIllustration
                    key={s.id}
                    vehicle={s.id}
                    dims={s.dimensionsCm}
                    unit={unit}
                    className={cn(
                      "absolute inset-0 h-full w-full transition-opacity duration-200 ease-out",
                      s.id === value.vehicle ? "opacity-100" : "opacity-0"
                    )}
                  />
                ))}
              </div>

              {/* Size chips */}
              <div
                role="radiogroup"
                aria-labelledby="vehicle-title"
                onKeyDown={onKeyDown}
                className="no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-2 overflow-x-auto overscroll-x-contain px-5 py-1"
              >
                {specs.data.map((s) => {
                  const selected = s.id === value.vehicle;
                  return (
                    <button
                      key={s.id}
                      ref={(el) => (chipRefs.current[s.id] = el)}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => select(s.id)}
                      translate={BRAND_NAMED.includes(s.id) ? "no" : undefined}
                      className={cn(
                        "h-11 shrink-0 snap-start whitespace-nowrap rounded-full border px-5 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97]",
                        selected ? "border-brand-yellow bg-brand-yellow text-on-yellow" : "border-border text-ink/60 hover:border-ink/25 hover:text-ink"
                      )}
                    >
                      {name(s.id)}
                    </button>
                  );
                })}
              </div>

              {/* What it carries — slides in on change. */}
              <div key={spec.id} className="animate-desc-in" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-base font-semibold text-ink" translate={BRAND_NAMED.includes(spec.id) ? "no" : undefined}>
                    {name(spec.id)}
                  </p>
                  <span className="shrink-0 rounded-full bg-accent-5 px-3 py-1 text-sm font-semibold text-accent tabular">
                    {t("cargo.maxWeight", { kg: formatNumber(spec.maxWeightKg, intlTag) })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink">{t(spec.descKey as TranslationKey)}</p>
                <p className="mt-1 text-sm text-ink/60 tabular">
                  {t("cargo.dimensions", { dims: `${d.width} × ${d.depth} × ${d.height}` })}
                </p>
              </div>
            </div>
          );
        })()
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{t("cargo.noteLabel")}</p>
        <textarea
          value={value.note ?? ""}
          onChange={(e) => onChange({ ...value, note: e.target.value.slice(0, 200) })}
          placeholder={t("cargo.notePlaceholder")}
          aria-label={t("cargo.noteLabel")}
          name="cargo-note"
          rows={3}
          className="block w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-ink transition-colors focus:border-accent"
        />
      </div>
    </div>
  );
}
