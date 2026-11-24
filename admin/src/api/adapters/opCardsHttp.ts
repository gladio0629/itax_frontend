// Real-backend calls for the operator windows (search, passengers,
// passenger and driver cards). The backend does not have these endpoints
// yet: they are described in docs/backend-gaps.md
// "## admin (operator, 2026-11-24)". The server sends snake_case JSON with
// ISO times; the small mappers below convert it.
import type { HttpClient } from "@shared/http/client";
import type { OpCardsApi } from "../opCards/adapter";
import type { OpPassengerRow, OpPassengersPage, OpSearchResult } from "../opCards/types";
import type { DriverStatus, OrderKind, OrderStatus, PassengerStatus } from "../types";

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : null);
const msReq = (iso: string) => Date.parse(iso);

type ApiPage<T> = { items: T[]; total: number; page: number; page_size: number };
const pageOf = <A, T>(p: ApiPage<A>, map: (a: A) => T) => ({ rows: p.items.map(map), total: p.total, page: p.page, pageSize: p.page_size });

type ApiSearch = {
  passengers: { id: string; name: string; phone: string; orders_count: number; status: PassengerStatus }[];
  drivers: { id: string; name: string; phone: string; car_model: string; plate: string; status: DriverStatus; at_debt_limit: boolean | null }[];
  orders: {
    id: string;
    kind: OrderKind;
    from: string;
    to: string;
    created_at: string;
    person: { role: "driver" | "passenger"; name: string } | null;
    price: number;
    status: OrderStatus;
  }[];
  counts: { passengers: number; drivers: number; orders: number };
};

type ApiPassengerRow = {
  id: string;
  name: string;
  phone: string;
  orders_count: number;
  rating: number | null;
  last_trip_at: string | null;
  status: PassengerStatus;
};
const passengerRow = (r: ApiPassengerRow): OpPassengerRow => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  ordersCount: r.orders_count,
  rating: r.rating,
  lastTripAt: ms(r.last_trip_at),
  status: r.status,
});

export function opCardsHttp(http: HttpClient): OpCardsApi {
  return {
    async opSearch(q) {
      const r = await http.get<ApiSearch>("/admin/v1/operator/search", { q: q.trim() });
      const out: OpSearchResult = {
        passengers: r.passengers.map((p) => ({ id: p.id, name: p.name, phone: p.phone, ordersCount: p.orders_count, status: p.status })),
        drivers: r.drivers.map((d) => ({
          id: d.id,
          name: d.name,
          phone: d.phone,
          carModel: d.car_model,
          plate: d.plate,
          status: d.status,
          atDebtLimit: d.at_debt_limit,
        })),
        orders: r.orders.map((o) => ({
          id: o.id,
          kind: o.kind,
          from: o.from,
          to: o.to,
          createdAt: msReq(o.created_at),
          person: o.person,
          price: o.price,
          status: o.status,
        })),
        counts: r.counts,
      };
      return out;
    },

    async getOpPassengers(query) {
      const r = await http.get<ApiPage<ApiPassengerRow> & { counts: OpPassengersPage["counts"] }>("/admin/v1/operator/passengers", {
        q: query.search?.trim() || undefined,
        status: query.status === "all" ? undefined : query.status,
        page: query.page,
      });
      return { ...pageOf(r, passengerRow), counts: r.counts };
    },
  };
}
