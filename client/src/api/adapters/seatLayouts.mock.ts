// Mock seat layouts per car class (what GET /orders/seat-layouts would
// return). Imported only by the mock adapter, so the http build has none of it.
import { makeRng } from "@/lib/prng";
import type { CarClassId } from "../types";
import type { LayoutSeat, SeatCabin, SeatLayout } from "../seatLayout";

/** Seat ids per cabin, rows front to back. The front passenger seat is
 * "front" in both cabins (it carries the front-seat surcharge). */
const CABIN_ROWS: Record<SeatCabin, string[][]> = {
  sedan: [["driver", "front"], ["back-left", "back-mid", "back-right"]],
  minivan: [
    ["driver", "front"],
    ["row2-left", "row2-mid", "row2-right"],
    ["row3-left", "row3-mid", "row3-right"],
  ],
};

export const CLASS_CABIN: Record<CarClassId, SeatCabin> = {
  standart: "sedan",
  komfort: "sedan",
  biznes: "sedan",
  miniven: "minivan",
};

/** Passenger seats of a class (the tile's "N o'rin"). */
export function mockPassengerSeats(carClass: CarClassId): number {
  return CABIN_ROWS[CLASS_CABIN[carClass]].flat().length - 1;
}

/** Seat ids a class can book. */
export function mockSeatIds(carClass: CarClassId): string[] {
  return CABIN_ROWS[CLASS_CABIN[carClass]].flat().filter((id) => id !== "driver");
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** A deterministic car per route and class: sometimes one seat is already
 * taken (the minivan more often, it is shared by more people). */
export function mockSeatLayouts(fromAddressId: string, toAddressId: string): SeatLayout[] {
  return (Object.keys(CLASS_CABIN) as CarClassId[]).map((carClass) => {
    const cabin = CLASS_CABIN[carClass];
    const ids = mockSeatIds(carClass);
    const rng = makeRng(hash(`${fromAddressId}|${toAddressId}|${carClass}`));
    const taken = new Set<string>();
    if (rng.bool(cabin === "minivan" ? 0.6 : 0.3)) taken.add(ids[rng.int(1, ids.length - 1)]);
    const rows = CABIN_ROWS[cabin].map((row) =>
      row.map((id): LayoutSeat => (id === "driver" ? { id, kind: "driver", taken: true } : { id, kind: "passenger", taken: taken.has(id) }))
    );
    return { carClass, cabin, rows, passengerSeats: ids.length, wholeCarAvailable: taken.size === 0 };
  });
}
