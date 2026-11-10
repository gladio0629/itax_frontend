import type { OrderMode, Seat, SeatPosition } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

// Rear seats fill first (cheaper, no surcharge); front seat (paid surcharge)
// only joins once all three rear seats are taken by the selection.
const SEAT_PRIORITY: SeatPosition[] = ["back-left", "back-mid", "back-right", "front"];
const COUNT_KEY: Record<1 | 2 | 3, TranslationKey> = {
  1: "order.passengerCount.one",
  2: "order.passengerCount.two",
  3: "order.passengerCount.three",
};

export function PassengerCountButtons({
  seats,
  mode,
  seatIds,
  onChange,
}: {
  seats: Seat[];
  mode: OrderMode;
  seatIds: string[];
  onChange: (mode: OrderMode, seatIds: string[]) => void;
}) {
  const { t } = useT();
  const isAvailable = (id: string) => !seats.find((s) => s.id === id)?.taken || seatIds.includes(id);
  const availableCount = SEAT_PRIORITY.filter(isAvailable).length;

  function selectCount(n: number) {
    let next = seatIds.filter(isAvailable);
    if (next.length > n) {
      next = next.slice(0, n);
    } else {
      for (const pos of SEAT_PRIORITY) {
        if (next.length >= n) break;
        if (!next.includes(pos) && isAvailable(pos)) next.push(pos);
      }
    }
    onChange("seat", next);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {([1, 2, 3] as const).map((n) => {
        const disabled = availableCount < n;
        const active = mode === "seat" && seatIds.length === n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => selectCount(n)}
            className={cn(
              "min-h-[48px] rounded-xl border-2 px-2 py-3 text-sm font-semibold transition-colors disabled:opacity-40",
              active ? "border-brand-yellow bg-brand-yellow text-on-yellow" : "border-border text-ink/70"
            )}
          >
            {t(COUNT_KEY[n])}
          </button>
        );
      })}
    </div>
  );
}
