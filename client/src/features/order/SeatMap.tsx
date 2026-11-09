import { Armchair, Users } from "lucide-react";
import { cn } from "@/lib/cn";

export const SEATS = [
  { id: "front", labelShort: "Old", surcharge: true },
  { id: "back-left", labelShort: "Orqa chap" },
  { id: "back-mid", labelShort: "Orqa o'rta" },
  { id: "back-right", labelShort: "Orqa o'ng" },
] as const;

function Seat({
  id,
  label,
  selected,
  disabled,
  onClick,
}: {
  id: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
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
        "flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-[11px] font-semibold transition-all active:scale-95",
        disabled
          ? "border-border bg-ink/5 text-ink/40"
          : selected
          ? "border-accent bg-accent text-white shadow-soft"
          : "border-border bg-card text-ink/70"
      )}
      data-seat={id}
    >
      <Armchair className="h-5 w-5" />
      {label}
    </button>
  );
}

export function SeatMap({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (seatId: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-border bg-bg p-5">
      <div className="mx-auto w-fit space-y-3">
        <div className="flex justify-center gap-3">
          <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border text-[11px] font-medium text-ink/40">
            <Users className="h-5 w-5" />
            Haydovchi
          </div>
          <Seat
            id="front"
            label="Old"
            selected={selected.includes("front")}
            onClick={() => onToggle("front")}
          />
        </div>
        <div className="flex justify-center gap-3">
          <Seat
            id="back-left"
            label="Chap"
            selected={selected.includes("back-left")}
            onClick={() => onToggle("back-left")}
          />
          <Seat
            id="back-mid"
            label="O'rta"
            selected={selected.includes("back-mid")}
            onClick={() => onToggle("back-mid")}
          />
          <Seat
            id="back-right"
            label="O'ng"
            selected={selected.includes("back-right")}
            onClick={() => onToggle("back-right")}
          />
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-ink/60">
        Old o'rindiq uchun qo'shimcha to'lov olinadi
      </p>
    </div>
  );
}
