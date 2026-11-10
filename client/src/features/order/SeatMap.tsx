import { Armchair, Users } from "lucide-react";
import type { Seat } from "@/api/types";
import { formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";

function SeatButton({
  label,
  selected,
  disabled,
  price,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  price?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-[11px] font-semibold transition active:scale-95",
        disabled
          ? "border-border bg-ink/5 text-ink/40"
          : selected
          ? "border-accent bg-accent text-bg shadow-soft"
          : "border-border bg-card text-ink/70"
      )}
    >
      <Armchair className="h-5 w-5" />
      {label}
      {price != null && <span className="tabular text-[9px] opacity-80">{formatSom(price)}</span>}
    </button>
  );
}

const SEAT_LABEL_KEY: Record<string, string> = {
  front: "seat.front",
  "back-left": "seat.backLeft",
  "back-mid": "seat.backMid",
  "back-right": "seat.backRight",
};

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
    <div className="rounded-2xl border border-border bg-bg p-5">
      <div className="mx-auto w-fit space-y-3">
        <div className="flex justify-center gap-3">
          <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-[11px] font-medium text-ink/60">
            <Users className="h-5 w-5" />
            {t("seat.driver")}
          </div>
          <SeatButton
            label={t("seat.front")}
            selected={selected.includes("front")}
            disabled={byId.front?.taken}
            price={byId.front?.price}
            onClick={() => onToggle("front")}
          />
        </div>
        <div className="flex justify-center gap-3">
          {(["back-left", "back-mid", "back-right"] as const).map((id) => (
            <SeatButton
              key={id}
              label={t(SEAT_LABEL_KEY[id] as TranslationKey)}
              selected={selected.includes(id)}
              disabled={byId[id]?.taken}
              price={byId[id]?.price}
              onClick={() => onToggle(id)}
            />
          ))}
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-ink/60">{t("seat.frontSurchargeNote")}</p>
    </div>
  );
}
