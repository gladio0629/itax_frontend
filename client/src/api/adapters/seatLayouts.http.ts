// GET /api/v1/orders/seat-layouts (docs/backend-gaps.md, "client (miniven,
// 2026-11-24)"). Not in shared/api/openapi.ts yet, so the wire types live here.
import type * as Api from "@shared/api/openapi";
import { session } from "../httpSession";
import { toUiCarClass } from "../httpMapper";
import type { LayoutSeat, SeatCabin, SeatLayout } from "../seatLayout";
import type { CarClassId, Seat } from "../types";

export const SEAT_LAYOUTS_PATH = "/api/v1/orders/seat-layouts";

type WireSeat = { id: string; kind: "driver" | "passenger"; taken: boolean };
type WireLayout = {
  car_class: Api.CarClass;
  cabin: SeatCabin;
  rows: WireSeat[][];
  passenger_seats: number;
  whole_car_available: boolean;
};
export type WireSeatLayouts = { data: WireLayout[] };

const toUiLayout = (l: WireLayout): SeatLayout => ({
  carClass: toUiCarClass(l.car_class),
  cabin: l.cabin === "minivan" ? "minivan" : "sedan",
  rows: l.rows.map((row) => row.map((s): LayoutSeat => ({ id: s.id, kind: s.kind === "driver" ? "driver" : "passenger", taken: !!s.taken }))),
  passengerSeats: l.passenger_seats,
  wholeCarAvailable: !!l.whole_car_available,
});

export async function fetchSeatLayouts(from: Api.GeoPoint, to: Api.GeoPoint): Promise<SeatLayout[]> {
  const res = await session.http.get<WireSeatLayouts>(SEAT_LAYOUTS_PATH, { from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng });
  return res.data.map(toUiLayout);
}

/** Until the server has seat-layouts: the sedan classes from the existing
 * seat map (the old behaviour); no minivan layout, so its card stays whole car. */
export function sedanLayoutsFromSeatMap(seats: Seat[]): SeatLayout[] {
  const byId = new Map(seats.map((s) => [s.id as string, s]));
  const seat = (id: string): LayoutSeat => ({ id, kind: "passenger", taken: byId.get(id)?.taken ?? true });
  const rows: LayoutSeat[][] = [
    [{ id: "driver", kind: "driver", taken: true }, seat("front")],
    [seat("back-left"), seat("back-mid"), seat("back-right")],
  ];
  const anyTaken = rows.flat().some((s) => s.kind === "passenger" && s.taken);
  return (["standart", "komfort", "biznes"] as CarClassId[]).map((carClass) => ({
    carClass,
    cabin: "sedan",
    rows,
    passengerSeats: seats.length,
    wholeCarAvailable: !anyTaken,
  }));
}
