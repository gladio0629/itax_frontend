import type { CarClassId } from "./types";

/** Which cabin drawing the seat map uses (design: Trip = sedan, TripVan = minivan). */
export type SeatCabin = "sedan" | "minivan";

/** One place in the cabin. The driver's place is in the front row and can
 * never be picked. Ids come from the server and are sent back as `seatIds`. */
export type LayoutSeat = {
  id: string;
  kind: "driver" | "passenger";
  taken: boolean;
};

/** The server's seat layout of one car class for a route: rows front to
 * back, seats left to right. */
export type SeatLayout = {
  carClass: CarClassId;
  cabin: SeatCabin;
  rows: LayoutSeat[][];
  /** "N yo'lovchi o'rni". */
  passengerSeats: number;
  /** "Butun mashina" can be booked (no seat is taken). */
  wholeCarAvailable: boolean;
};

/** The layout of a class, or null while unknown. */
export function layoutFor(layouts: SeatLayout[] | null | undefined, carClass: CarClassId | undefined): SeatLayout | null {
  if (!layouts?.length) return null;
  return layouts.find((l) => l.carClass === (carClass ?? "standart")) ?? null;
}

/** Passenger seats of a layout, front to back. */
export function passengerSeats(layout: SeatLayout): LayoutSeat[] {
  return layout.rows.flat().filter((s) => s.kind === "passenger");
}

/**
 * Keeps only the picked seats that exist in `layout` and are free; whole car
 * falls back to per seat when the server no longer offers it. Used when the
 * class changes or the layout reloads.
 */
export function fitSeatsToLayout(
  layout: SeatLayout,
  mode: "seat" | "car",
  seatIds: string[]
): { mode: "seat" | "car"; seatIds: string[] } {
  if (mode === "car") return layout.wholeCarAvailable ? { mode, seatIds } : { mode: "seat", seatIds: [] };
  const free = new Set(passengerSeats(layout).filter((s) => !s.taken).map((s) => s.id));
  return { mode, seatIds: seatIds.filter((id) => free.has(id)) };
}
