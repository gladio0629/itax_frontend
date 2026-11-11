import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { Check } from "@/lib/icons";
import { DELIVERY_VEHICLES, type CargoInput, type DeliveryVehicle } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { VehicleArt } from "./VehicleArt";

/** Brand model names stay untranslated; "Katta fura" is a description, so it is. */
const BRAND_NAMED: DeliveryVehicle[] = ["spark", "damas", "labo", "isuzu", "isuzu2"];

/**
 * Delivery vehicle choice. The client only says which vehicle — price comes
 * back from the adapter's quote. 3×2 grid from 375px; a snap-scrolling row
 * on narrower screens.
 */
export function VehiclePicker({ value, onChange }: { value: CargoInput; onChange: (v: CargoInput) => void }) {
  const { t } = useT();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

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
    refs.current[v]?.focus();
  }

  return (
    <div className="space-y-4">
      <div>
        <p id="vehicle-title" className="mb-2 text-sm font-semibold text-ink">
          {t("cargo.vehicleTitle")}
        </p>
        <div
          role="radiogroup"
          aria-labelledby="vehicle-title"
          onKeyDown={onKeyDown}
          // Narrow screens: horizontal snap row. The vertical padding keeps the
          // selected card's lift and shadow from being clipped by the scroller.
          className={cn(
            "no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto overscroll-x-contain px-5 pb-2 pt-1",
            "min-[375px]:mx-0 min-[375px]:grid min-[375px]:grid-cols-3 min-[375px]:overflow-visible min-[375px]:px-0"
          )}
        >
          {DELIVERY_VEHICLES.map((v) => {
            const selected = value.vehicle === v;
            return (
              <button
                key={v}
                ref={(el) => (refs.current[v] = el)}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(v)}
                className={cn(
                  "relative flex w-[104px] shrink-0 snap-start flex-col items-center gap-1 rounded-card border-2 px-2 pb-3 pt-3 min-[375px]:w-auto",
                  "transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out active:scale-[0.97]",
                  selected
                    ? "-translate-y-0.5 border-brand-yellow bg-[var(--color-yellow-tint)] shadow-soft"
                    : "border-border bg-card hover:border-ink/20"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-yellow text-on-yellow transition-[transform,opacity] duration-200",
                    selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <VehicleArt vehicle={v} className="h-14 w-full" />
                <span className="text-sm font-semibold text-ink" translate={BRAND_NAMED.includes(v) ? "no" : undefined}>
                  {t(`cargo.vehicle.${v}` as TranslationKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

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
