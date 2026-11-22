import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { DriverLevel, FuelKind, MarkupKind, TariffSettings } from "@/api/types";

export const FUEL_SHORT: Record<FuelKind, string> = { gas: "Gaz", petrol: "Benzin" };
export const MARKUP_KIND: Record<MarkupKind, string> = { percent: "Foiz", sum: "Summa" };
export const LEVEL_NAME: Record<DriverLevel, string> = { bronze: "Bronza", silver: "Kumush", gold: "Oltin" };
export const LEVEL_DOT: Record<DriverLevel, string> = {
  bronze: "bg-[var(--level-bronze)]",
  silver: "bg-[var(--level-silver)]",
  gold: "bg-[var(--level-gold)]",
};

export const som = (n: number) => `${formatNumber(n)} so'm`;
export const markupText = (kind: MarkupKind, v: number) => (kind === "percent" ? `+${v}%` : `+${som(v)}`);
export const extraText = (unit: "min" | "som", v: number) => (unit === "min" ? `${formatNumber(v)} daqiqa` : som(v));

/** "18+ safar/hafta, 4.8+, bekor ≤ 3/hafta" or "boshlang'ich" (display only). */
export function levelCondition(l: TariffSettings["levels"][number]): string {
  const parts = [
    l.minTripsWeek !== null ? `${l.minTripsWeek}+ safar/hafta` : null,
    l.minRating !== null ? `${l.minRating}+` : null,
    l.maxCancelsWeek !== null ? `bekor ≤ ${l.maxCancelsWeek}/hafta` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "boshlang'ich";
}

/** Fuel tag: Gaz green, Benzin blue (design). */
export function FuelTag({ kind }: { kind: FuelKind }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-bold",
        kind === "gas" ? "bg-green-soft text-green-text" : "bg-info-soft text-info"
      )}
    >
      {FUEL_SHORT[kind]}
    </span>
  );
}

/** Small two-option toggle used inside editable rows (36px, rows only). */
export function MiniToggle<K extends string>({
  label,
  value,
  options,
  onChange,
  changed,
}: {
  label: string;
  value: K;
  options: { key: K; label: string }[];
  onChange: (k: K) => void;
  changed?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex gap-0.5 rounded-nav p-[3px]", changed ? "bg-green-soft" : "bg-surface")}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={cn(
              "h-[30px] whitespace-nowrap rounded-[9px] px-3 text-13",
              on ? "bg-white font-extrabold text-ink shadow-[0_1px_3px_rgba(11,21,36,0.14)]" : "font-semibold text-muted hover:text-ink"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Example value from the server; dimmed with a note while the section
 * has unsaved edits (the server recomputes it after Confirm). */
export function ExampleValue({ value, stale }: { value: number | null; stale: boolean }) {
  if (value === null) return <span className="text-muted">—</span>;
  return (
    <span className={cn("tabular whitespace-nowrap text-15 font-extrabold", stale && "opacity-40")} title={stale ? "Saqlangandan keyin yangilanadi" : undefined}>
      {formatNumber(value)} <span className="text-xs text-muted">so'm</span>
    </span>
  );
}

export function SectionActions({ dirty, valid, onSave, onReset, children }: { dirty: boolean; valid: boolean; onSave: () => void; onReset: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {children}
      <span className="flex-1" />
      {dirty && (
        <button type="button" onClick={onReset} className="h-11 rounded-full px-3.5 text-sm font-bold text-muted hover:bg-surface hover:text-ink">
          Bekor qilish
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || !valid}
        className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-[18px] text-sm font-extrabold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        Saqlash
      </button>
    </div>
  );
}
