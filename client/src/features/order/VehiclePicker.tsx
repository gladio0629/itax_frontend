import type { ReactNode } from "react";
import { api } from "@/api/client";
import type { CargoInput, DeliveryVehicle } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { useQuery } from "@/lib/useQuery";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { Segmented } from "@/components/ui/Segmented";
import { VehicleIllustration } from "./VehicleIllustration";

/** Brand model names stay untranslated. */
const BRAND_NAMED: DeliveryVehicle[] = ["spark", "damas", "labo", "isuzu", "isuzu2"];

/**
 * Delivery vehicle choice: a light illustration card (the hero) that crossfades
 * between vehicles, size chips underneath, then what the vehicle carries.
 * Specs (description, cargo dimensions, max weight) come from the adapter;
 * price comes from the adapter's quote — nothing is computed here.
 */
export function VehiclePicker({
  value,
  onChange,
  belowChips,
}: {
  value: CargoInput;
  onChange: (v: CargoInput) => void;
  /** Rendered right under the size chips (Kargo: the loaders control). */
  belowChips?: ReactNode;
}) {
  const { t, intlTag } = useT();
  const specs = useQuery(() => api.getDeliveryVehicles(), []);
  function select(v: DeliveryVehicle) {
    if (v !== value.vehicle) onChange({ ...value, vehicle: v });
  }

  const name = (v: DeliveryVehicle) => t(`cargo.vehicle.${v}` as TranslationKey);
  const unit = t("cargo.unitCm");

  return (
    <div className="space-y-4">
      {specs.status === "error" ? (
        <div role="alert" className="flex items-center gap-3 rounded-card border border-border p-4">
          <p className="min-w-0 flex-1 text-sm text-ink/70">{t("cargo.loadError")}</p>
          <Button variant="secondary" size="sm" onClick={() => specs.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : specs.status === "loading" ? (
        <div className="space-y-3" aria-busy="true" aria-label={t("cargo.vehicleTitle")}>
          <Skeleton className="h-[230px] w-full rounded-thumb" />
          <Skeleton className="h-10 w-full rounded-control" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        (() => {
          const spec = specs.data.find((s) => s.id === value.vehicle) ?? specs.data[0];
          const d = spec.dimensionsCm;
          return (
            <div className="space-y-3">
              {/* Illustration card: stays light in both themes so the drawing reads;
                  what it carries sits under the drawing (reference layout). */}
              <div className="relative overflow-hidden rounded-thumb bg-[#F5F4F2]" aria-live="polite">
                <div className="relative h-[176px]">
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
                <div key={spec.id} className="animate-desc-in px-4 pb-4 text-center text-sub text-[#5c5f66]">
                  <p>
                    <span translate={BRAND_NAMED.includes(spec.id) ? "no" : undefined} className="font-semibold text-[#1b1f27]">
                      {name(spec.id)}
                    </span>
                    {" · "}
                    {t(spec.descKey as TranslationKey)}
                  </p>
                  <p className="tabular">
                    {t("cargo.maxWeight", { kg: formatNumber(spec.maxWeightKg, intlTag) })} · {t("cargo.dimensions", { dims: `${d.width} × ${d.depth} × ${d.height}` })}
                  </p>
                </div>
              </div>

              {/* "Kuzov" with the size track. */}
              <div className="flex items-center gap-3">
                <span id="vehicle-title" className="shrink-0 text-control text-ink">
                  {t("cargo.body")}
                </span>
                <Segmented
                  size="sm"
                  className="flex-1"
                  ariaLabelledBy="vehicle-title"
                  value={value.vehicle}
                  onChange={select}
                  options={specs.data.map((s) => ({ id: s.id, label: <span translate="no">{s.sizeLabel}</span>, ariaLabel: `${s.sizeLabel} — ${name(s.id)}` }))}
                />
              </div>

              {belowChips}
            </div>
          );
        })()
      )}

      <div>
        <p className="mb-2 text-control text-ink">{t("cargo.noteLabel")}</p>
        <textarea
          value={value.note ?? ""}
          onChange={(e) => onChange({ ...value, note: e.target.value.slice(0, 200) })}
          placeholder={t("cargo.notePlaceholder")}
          aria-label={t("cargo.noteLabel")}
          name="cargo-note"
          autoComplete="off"
          rows={3}
          className="block w-full resize-none rounded-control bg-fill px-4 py-3 text-control text-ink outline-none transition-colors placeholder:text-ink/60 focus:ring-2 focus:ring-accent/40"
        />
      </div>
    </div>
  );
}
