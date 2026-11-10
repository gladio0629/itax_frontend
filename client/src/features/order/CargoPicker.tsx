import { Minus, Plus, Package, PackageOpen, Boxes } from "lucide-react";
import type { CargoInput, CargoPreset } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

const PRESETS: { id: CargoPreset; icon: typeof Package; volumeM3: number; weightKg: number }[] = [
  { id: "small", icon: Package, volumeM3: 0.5, weightKg: 10 },
  { id: "medium", icon: PackageOpen, volumeM3: 1.5, weightKg: 30 },
  { id: "large", icon: Boxes, volumeM3: 3, weightKg: 80 },
];

const PRESET_LABEL_KEY: Record<CargoPreset, string> = {
  small: "cargo.small",
  medium: "cargo.medium",
  large: "cargo.large",
};

function Stepper({
  label,
  value,
  step,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-accent-5 py-2 pl-4 pr-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink shadow-softer active:scale-95"
          aria-label={`${label} −`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-16 whitespace-nowrap text-center text-sm font-semibold tabular text-ink">
          {value} {unit}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 10) / 10))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink shadow-softer active:scale-95"
          aria-label={`${label} +`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CargoPicker({ value, onChange }: { value: CargoInput; onChange: (v: CargoInput) => void }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{t("cargo.volumeTitle")}</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(({ id, icon: Icon, volumeM3, weightKg }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ ...value, preset: id, volumeM3, weightKg })}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border-2 py-3.5 text-xs font-semibold transition-colors",
                value.preset === id ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(PRESET_LABEL_KEY[id] as TranslationKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Stepper
          label={t("cargo.customVolume")}
          value={value.volumeM3}
          step={0.5}
          min={0.1}
          max={10}
          unit="m³"
          onChange={(v) => onChange({ ...value, volumeM3: v })}
        />
        <Stepper
          label={t("cargo.weight")}
          value={value.weightKg}
          step={5}
          min={1}
          max={500}
          unit="kg"
          onChange={(v) => onChange({ ...value, weightKg: v })}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{t("cargo.noteLabel")}</p>
        <textarea
          value={value.note ?? ""}
          onChange={(e) => onChange({ ...value, note: e.target.value.slice(0, 200) })}
          placeholder={t("cargo.notePlaceholder")}
          rows={3}
          className="block w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-ink transition-colors focus:border-accent"
        />
      </div>
    </div>
  );
}
