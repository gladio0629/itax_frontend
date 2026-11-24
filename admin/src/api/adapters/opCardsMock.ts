// Mock server for the operator windows (search, passengers, passenger and
// driver cards). Built on the shared sample DB, so every order, passenger
// and driver id here is the same one the other screens load. Only
// adapters/mock.ts imports this file (never the http build).
import { ApiError, withLatency } from "@/mockDb/latency";
import { db, getSession, getStaffMember, ROLE_SECTIONS, type AdminUser, type Section } from "@/mockDb/db";
import type { Driver, Order, Passenger } from "@/seed/generate";
import type { OpCardsApi } from "../opCards/adapter";
import type { OpPassengerRow, OpPassengerStatusFilter, OpSearchOrderHit, OpSearchResult } from "../opCards/types";

const PAGE_SIZE = 10;
/** Hits per group; the "Hammasi" view shows the first few of each. */
const SEARCH_LIMIT = 20;

function actor(): AdminUser {
  const s = getSession();
  if (!s) throw new ApiError("UNAUTHORIZED", "Avtorizatsiyadan o'tilmagan.");
  const u = getStaffMember(s.adminId);
  if (!u) throw new ApiError("NOT_FOUND", "Admin topilmadi");
  return u;
}
function requireAny(sections: Section[]): AdminUser {
  const u = actor();
  if (!sections.some((x) => ROLE_SECTIONS[u.role].includes(x))) throw new ApiError("FORBIDDEN", "Bu bo'lim uchun ruxsatingiz yo'q.");
  return u;
}
const PASSENGER_ACCESS: Section[] = ["passengers", "passengers_view"];
const SEARCH_ACCESS: Section[] = ["passengers", "passengers_view", "drivers", "drivers_view", "orders", "orders_view"];

const digits = (s: string) => s.replace(/\D/g, "");
const compact = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const cityName = (id: string) => db.cities().find((c) => c.id === id)?.name ?? id;

function page<T>(rows: T[], pageNo: number) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, pageNo || 1), pages);
  return { rows: rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), total: rows.length, page: p, pageSize: PAGE_SIZE };
}

/** Name or phone; a phone matches on its digits ("+998 90 000 00 01", "900000001"). */
function personMatches(p: { name: string; phone: string }, q: string): boolean {
  const d = digits(q);
  if (d.length >= 3 && digits(p.phone).includes(d)) return true;
  return p.name.toLowerCase().includes(q.toLowerCase());
}
/** "#48213", "48213", "ord_123" all find the order. */
function orderMatches(o: Order, q: string): boolean {
  const n = q.replace(/^#/, "").trim().toLowerCase();
  if (!n) return false;
  const short = o.id.startsWith("ord_") ? o.id.slice(4) : o.id;
  return o.id.toLowerCase() === n || short.replace(/^0+/, "") === n.replace(/^0+/, "");
}

function ordersCountMap(): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of db.orders()) m.set(o.passengerId, (m.get(o.passengerId) ?? 0) + 1);
  return m;
}

function orderHit(o: Order, prefer: "driver" | "passenger"): OpSearchOrderHit {
  const driver = o.driverId ? db.getDriver(o.driverId) : undefined;
  const passenger = db.getPassenger(o.passengerId);
  const person =
    prefer === "driver" && driver
      ? { role: "driver" as const, name: driver.name }
      : passenger
        ? { role: "passenger" as const, name: passenger.name }
        : driver
          ? { role: "driver" as const, name: driver.name }
          : null;
  return { id: o.id, kind: o.kind, from: cityName(o.fromCityId), to: cityName(o.toCityId), createdAt: o.createdAt, person, price: o.price, status: o.status };
}

function passengerRow(p: Passenger, counts: Map<string, number>): OpPassengerRow {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    ordersCount: counts.get(p.id) ?? 0,
    rating: p.rating || null,
    lastTripAt: p.lastTripAt,
    status: p.status,
  };
}

function search(q: string): OpSearchResult {
  const query = q.trim();
  if (!query) return { passengers: [], drivers: [], orders: [], counts: { passengers: 0, drivers: 0, orders: 0 } };
  const counts = ordersCountMap();
  const passengers = db.passengers().filter((p) => !p.archived && personMatches(p, query));
  const plateQ = compact(query);
  const drivers = db.drivers().filter((d: Driver) => !d.archived && (personMatches(d, query) || (plateQ.length >= 3 && compact(d.plate).includes(plateQ))));
  const driverIds = new Set(drivers.map((d) => d.id));
  const passengerIds = new Set(passengers.map((p) => p.id));
  const orders = db
    .orders()
    .filter((o) => orderMatches(o, query) || (o.driverId && driverIds.has(o.driverId)) || passengerIds.has(o.passengerId))
    .sort((a, b) => b.createdAt - a.createdAt);
  return {
    passengers: passengers.slice(0, SEARCH_LIMIT).map((p) => ({ id: p.id, name: p.name, phone: p.phone, ordersCount: counts.get(p.id) ?? 0, status: p.status })),
    drivers: drivers.slice(0, SEARCH_LIMIT).map((d) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      carModel: d.carModel,
      plate: d.plate,
      status: d.status,
      atDebtLimit: d.atDebtLimit,
    })),
    orders: orders.slice(0, SEARCH_LIMIT).map((o) => orderHit(o, o.driverId && driverIds.has(o.driverId) ? "driver" : "passenger")),
    counts: { passengers: passengers.length, drivers: drivers.length, orders: orders.length },
  };
}

export const opCardsMock: OpCardsApi = {
  opSearch: (q) =>
    withLatency(() => {
      requireAny(SEARCH_ACCESS);
      return search(q);
    }),

  getOpPassengers: (query) =>
    withLatency(() => {
      requireAny(PASSENGER_ACCESS);
      const counts = ordersCountMap();
      const q = query.search?.trim() ?? "";
      const matching = db.passengers().filter((p) => !p.archived && (!q || personMatches(p, q)));
      const byStatus = (s: OpPassengerStatusFilter) => (s === "all" ? matching : matching.filter((p) => p.status === s));
      const rows = byStatus(query.status)
        .slice()
        .sort((a, b) => (b.lastTripAt ?? 0) - (a.lastTripAt ?? 0))
        .map((p) => passengerRow(p, counts));
      return {
        ...page(rows, query.page),
        counts: { all: matching.length, active: byStatus("active").length, warned: byStatus("warned").length, blocked: byStatus("blocked").length },
      };
    }),
};
