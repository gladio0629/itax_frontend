import { Users } from "lucide-react";
import type { Seat, SeatPosition } from "@/api/types";
import { formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";

const SEAT_LABEL_KEY: Record<SeatPosition, TranslationKey> = {
  front: "seat.front",
  "back-left": "seat.backLeft",
  "back-mid": "seat.backMid",
  "back-right": "seat.backRight",
};

// Percent positions over the car silhouette (viewBox 0 0 200 280).
const SEAT_LAYOUT: Record<SeatPosition, { left: string; top: string }> = {
  front: { left: "72%", top: "26%" },
  "back-left": { left: "27%", top: "64%" },
  "back-mid": { left: "50%", top: "64%" },
  "back-right": { left: "73%", top: "64%" },
};
const DRIVER_LAYOUT = { left: "28%", top: "26%" };

function CarSilhouette() {
  return (
    <svg viewBox="0 0 200 280" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect x="18" y="8" width="164" height="264" rx="54" className="fill-ink/[0.04] stroke-ink/10" strokeWidth="2" />
      <rect x="40" y="34" width="120" height="46" rx="18" className="fill-ink/[0.05]" />
      <rect x="6" y="56" width="14" height="40" rx="7" className="fill-ink/10" />
      <rect x="180" y="56" width="14" height="40" rx="7" className="fill-ink/10" />
      <rect x="6" y="184" width="14" height="40" rx="7" className="fill-ink/10" />
      <rect x="180" y="184" width="14" height="40" rx="7" className="fill-ink/10" />
    </svg>
  );
}

function SeatButton({
  position,
  label,
  selected,
  disabled,
  price,
  onClick,
}: {
  position: SeatPosition;
  label: string;
  selected: boolean;
  disabled?: boolean;
  price?: number;
  onClick?: () => void;
}) {
  const { left, top } = SEAT_LAYOUT[position];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-[10px] font-semibold transition active:scale-95",
        disabled
          ? "border-border bg-ink/5 text-ink/30"
          : selected
          ? "border-brand-yellow bg-brand-yellow text-on-yellow shadow-soft"
          : "border-border bg-card text-ink/70 shadow-softer"
      )}
      style={{ left, top }}
    >
      {label}
      {price != null && <span className="tabular text-[9px] opacity-80">{formatSom(price)}</span>}
    </button>
  );
}

export function SeatMap({
  seats,
  selected,
  onToggle,
}: {
  seats: Seat[];
  selected: string[];
  onToggle: (seatId: string) => void;
}) {
  const { t } = useT();
  const byId = Object.fromEntries(seats.map((s) => [s.id, s]));

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="relative mx-auto" style={{ width: "min(220px, 100%)", aspectRatio: "200 / 280" }}>
        <CarSilhouette />
        <div
          className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-border text-[10px] font-medium text-ink/50"
          style={{ left: DRIVER_LAYOUT.left, top: DRIVER_LAYOUT.top }}
        >
          <Users className="h-4 w-4" />
          {t("seat.driver")}
        </div>
        {(["front", "back-left", "back-mid", "back-right"] as SeatPosition[]).map((position) => (
          <SeatButton
            key={position}
            position={position}
            label={t(SEAT_LABEL_KEY[position])}
            selected={selected.includes(position)}
            disabled={byId[position]?.taken && !selected.includes(position)}
            price={byId[position]?.price}
            onClick={() => onToggle(position)}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-ink/60">{t("seat.frontSurchargeNote")}</p>
    </div>
  );
}
