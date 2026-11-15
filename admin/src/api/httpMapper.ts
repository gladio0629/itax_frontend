// The one place that converts between api/openapi.yml shapes and the admin
// UI types. Money: API tiyin ↔ UI so'm. Where the contract has no value for
// a UI field, the field gets a neutral placeholder and
// `httpAdapter.capabilities` hides it on screen (see
// docs/backend-gaps/admin.md); no business rule is computed here.
import type * as Api from "@shared/api/openapi";
import type {
  ActiveTask,
  AdjustmentProposal,
  AdminRole,
  Driver,
  DriverStatus,
  HistoryEntry,
  HistoryResult,
  MarketingStats,
  Me,
  OrderWithNames,
  Passenger,
  QueueReason,
  QueueStatus,
  Section,
  StaffRow,
  StatsPeriod,
  Tariff,
  TariffProposal,
  WalletEntryType,
  WalletLedgerRow,
} from "./types";

// ------------------------------------------------------------- primitives
export const toSom = (tiyin: number | null | undefined): number => (tiyin ?? 0) / 100;
export const toTiyin = (som: number): number => Math.round(som * 100);
export const toMs = (iso: string | null | undefined): number => (iso ? Date.parse(iso) || 0 : 0);

/** "+998 90 123 45 67" / "90 123-45-67" / "901234567" → "+998901234567", or null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  return null;
}

/** +998901234567 → "+998 90 123 45 67" (display only). */
export function formatPhone(phone: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

/** +998901234567 → "+998 90 *** ** 67". */
export function maskPhone(phone: string): string {
  const m = /^\+998(\d{2})\d{3}\d{2}(\d{2})$/.exec(phone);
  return m ? `+998 ${m[1]} *** ** ${m[2]}` : "+998 ** *** ** **";
}

/** "kamola@izgo.uz" → "k***@izgo.uz". */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user[0]}***@${domain}`;
}

/** The UI edits one "Ism" field; the API stores first and last name. */
export function splitName(full: string): { first_name: string; last_name: string } | null {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2 || !parts[0]) return null;
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

const joinName = (first?: string | null, last?: string | null) => [first, last].filter(Boolean).join(" ").trim() || "—";
const shortId = (id: string) => id.slice(0, 8);

// ------------------------------------------------------------ roles / me
const ROLE_FROM_API: Record<Api.StaffRole, AdminRole> = {
  superadmin: "superadmin",
  owner: "owner",
  manager: "menejer",
  marketer: "marketolog",
  operator: "operator",
};
const ROLE_TO_API: Record<AdminRole, Api.StaffRole> = {
  superadmin: "superadmin",
  owner: "owner",
  menejer: "manager",
  marketolog: "marketer",
  operator: "operator",
};
export const roleFromApi = (r: Api.StaffRole): AdminRole => ROLE_FROM_API[r];
export const roleToApi = (r: AdminRole): Api.StaffRole => ROLE_TO_API[r];

const SECTION_FROM_API: Record<Api.AdminSection, Section> = {
  staff: "staff",
  drivers: "drivers",
  passengers: "passengers",
  orders: "orders",
  wallet: "wallet",
  tariffs: "tariffs",
  operator: "operators",
  stats: "stats",
};
/** Route of each section, in sidebar order (first allowed = landing page). */
const SECTION_PATH: [Section, string][] = [
  ["stats", "/dashboard"],
  ["drivers", "/drivers"],
  ["passengers", "/passengers"],
  ["orders", "/orders"],
  ["wallet", "/wallet"],
  ["tariffs", "/tariffs"],
  ["staff", "/staff"],
  ["operators", "/operators"],
];

export function meFromApi(me: Api.AdminMe): Me {
  const sections = me.sections.map((s) => SECTION_FROM_API[s]).filter(Boolean);
  return {
    id: me.id,
    name: me.full_name || me.email,
    email: me.email,
    phone: "",
    role: roleFromApi(me.role),
    avatarSeed: me.id,
    sections,
    // The contract has no action list: the "operator" section is the one
    // that comes with queue work. Export / supervisor views have no
    // endpoints, so they are never granted (gap).
    actions: sections.includes("operators") ? ["operatorWork"] : [],
    creatableRoles: me.creatable_roles.map(roleFromApi),
    landingPath: SECTION_PATH.find(([s]) => sections.includes(s))?.[1] ?? "/account",
  };
}

// -------------------------------------------------------------- people
export function staffFromApi(s: Api.Staff): StaffRow {
  return {
    id: s.id,
    name: s.full_name,
    email: s.email ?? "",
    phone: formatPhone(s.phone),
    role: roleFromApi(s.role),
    status: s.state === "blocked" ? "blocked" : "active",
    archived: s.state === "archived",
    avatarSeed: s.id,
    createdAt: toMs(s.created_at),
    // No per-row verdict in the contract: the server's 403 decides.
    canEdit: true,
  };
}

function driverStatus(d: Api.AdminDriver): DriverStatus {
  if (d.state === "blocked") return "blocked";
  if (d.driver_state === "draft" || d.driver_state === "pending_review") return "auto_review";
  if (d.driver_state === "rejected") return "rejected";
  if (d.driver_state === "blocked") return "blocked";
  return "active";
}

export function driverFromApi(d: Api.AdminDriver): Driver {
  return {
    id: d.id,
    name: joinName(d.first_name, d.last_name),
    phoneMasked: maskPhone(d.phone),
    cityId: "",
    carModel: d.car ? `${d.car.brand} ${d.car.model}`.trim() : "—",
    carColor: d.car?.color ?? "",
    carColorHex: "",
    plate: d.car?.plate_number ?? "",
    rating: d.rating ?? 0,
    totalTrips: d.trips_count ?? 0,
    online: false, // not in the contract (capabilities.driverOnline = false)
    walletBalance: toSom(d.wallet_balance),
    debtLimit: 0, // not in the contract (capabilities.driverDebtLimit = false)
    status: driverStatus(d),
    archived: d.state === "archived",
    avatarSeed: d.id,
    joinedAt: toMs(d.created_at),
  };
}

export function passengerFromApi(p: Api.AdminPassenger): Passenger {
  return {
    id: p.id,
    name: joinName(p.first_name, p.last_name),
    phoneMasked: maskPhone(p.phone),
    rating: p.rating ?? 0,
    totalTrips: p.orders_count ?? 0,
    avatarSeed: p.id,
    cityId: "", // not in the contract (capabilities.passengerCity = false)
    status: p.state === "blocked" ? "blocked" : "active",
    archived: p.state === "archived",
    joinedAt: toMs(p.created_at),
  };
}

// --------------------------------------------------------------- orders
const placeName = (g: Api.GeoPoint) => g.address?.trim() || `${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}`;

export function orderFromApi(o: Api.Order): OrderWithNames {
  const seats = o.seats ?? 0;
  return {
    id: o.id,
    passengerId: "",
    driverId: o.driver?.id ?? null,
    fromCityId: "",
    toCityId: "",
    distanceKm: (o.distance_m ?? 0) / 1000,
    mode: seats > 0 ? "seat" : "car",
    seatIds: Array.from({ length: seats }, (_, i) => `seat_${i + 1}`),
    price: toSom(o.price),
    paymentMethod: o.payment_method,
    status: o.status,
    createdAt: toMs(o.created_at),
    scheduledAt: o.scheduled_at ? toMs(o.scheduled_at) : undefined,
    note: o.comment ?? undefined,
    passengerName: "—", // Order has no passenger (capabilities.orderPassenger = false)
    driverName: o.driver?.first_name ?? null,
    fromCityName: placeName(o.from),
    toCityName: placeName(o.to),
    canCancel: false, // no admin cancel endpoint
  };
}

// --------------------------------------------------------------- wallet
const LEDGER_KIND: Record<Api.LedgerKind, WalletEntryType> = {
  trip_payment: "trip_payment",
  commission: "commission",
  topup: "topup",
  correction: "adjustment",
  bonus: "bonus",
};

export function ledgerFromApi(e: Api.LedgerEntry): WalletLedgerRow {
  return {
    id: e.id,
    driverId: "",
    type: LEDGER_KIND[e.kind] ?? "adjustment",
    amount: toSom(e.amount),
    orderId: e.reference_id ?? undefined,
    createdAt: toMs(e.created_at),
    balanceAfter: toSom(e.balance_after),
    // LedgerEntry carries only wallet_id (capabilities.walletDriverName = false).
    driverName: `Hamyon #${shortId(e.wallet_id)}`,
  };
}

const APPROVAL: Record<Api.ApprovalStatus, AdjustmentProposal["status"]> = {
  pending_approval: "pending_second",
  approved: "approved",
  rejected: "rejected",
};

export function correctionFromApi(c: Api.Correction, driverId: string, me: Me | null): AdjustmentProposal {
  return {
    id: c.id,
    driverId,
    amount: toSom(c.amount),
    reason: c.reason,
    proposedById: c.created_by,
    proposedByName: me && c.created_by === me.id ? me.name : `#${shortId(c.created_by)}`,
    status: APPROVAL[c.approval_status],
    createdAt: toMs(c.created_at),
  };
}

// -------------------------------------------------------------- tariffs
export function tariffFromApi(t: Api.Tariff): Tariff {
  return {
    id: t.id,
    name: t.name,
    baseFare: toSom(t.base_fare),
    perKmCar: toSom(t.per_km),
    perMin: toSom(t.per_min),
    minFare: toSom(t.min_fare),
    commissionPct: t.commission_percent,
    carClass: t.car_class,
    // UI-only fields the contract doesn't have (hidden via tariffFields).
    perKmSeat: 0,
    frontSeatSurcharge: 0,
    fuelAdjustmentPct: 0,
    archived: !t.active,
  };
}

/** A pending create still shows up in the list as inactive; it belongs to
 * the proposals, not to "archived". */
export const isPendingCreate = (t: Api.Tariff) => t.pending_change?.action === "create";

export function tariffToInput(t: Pick<Tariff, "name" | "baseFare" | "perKmCar" | "commissionPct"> & Partial<Tariff>): Api.TariffInput {
  return {
    name: t.name,
    car_class: t.carClass ?? "economy",
    base_fare: toTiyin(t.baseFare),
    per_km: toTiyin(t.perKmCar),
    per_min: toTiyin(t.perMin ?? 0),
    min_fare: toTiyin(t.minFare ?? 0),
    commission_percent: t.commissionPct,
  };
}

const PROPOSAL_TYPE = { create: "create", update: "edit", delete: "archive" } as const;

export function tariffProposalFromApi(t: Api.Tariff, me: Me | null): TariffProposal | null {
  const pc = t.pending_change;
  if (!pc || t.approval_status !== "pending_approval") return null;
  return {
    id: t.id,
    type: PROPOSAL_TYPE[pc.action ?? "update"],
    tariffId: t.id,
    // pending_change has no proposed values (gap): show the action only.
    patch: { name: t.name },
    proposedById: pc.requested_by ?? "",
    proposedByName: me && pc.requested_by === me.id ? me.name : pc.requested_by ? `#${shortId(pc.requested_by)}` : "—",
    status: "pending_second",
    createdAt: toMs(pc.requested_at),
  };
}

// ------------------------------------------------------------- operator
const QUEUE_REASON: Record<Api.QueueKind, QueueReason> = {
  driver_application: "driver_application",
  document_update: "document_update",
  complaint: "complaint",
};
const QUEUE_STATUS: Record<Api.QueueStatus, QueueStatus> = {
  waiting: "waiting",
  in_progress: "in_progress",
  completed: "done",
  rejected: "rejected",
};

export function queueFromApi(q: Api.QueueItem): ActiveTask {
  // QueueItem has no phone: the row shows the subject's id instead.
  const subject = `#${shortId(q.subject_id)}`;
  return {
    id: q.id,
    phoneMasked: subject,
    phoneFull: subject,
    reason: QUEUE_REASON[q.kind] ?? "complaint",
    waitingSinceAt: toMs(q.created_at),
    status: QUEUE_STATUS[q.status] ?? "waiting",
    assignedOperatorId: q.assigned_to ?? undefined,
  };
}

function historyResult(q: Api.QueueItem): HistoryResult {
  if (q.status === "rejected") return "rejected";
  return q.result === "unresolved" ? "callback" : "resolved";
}

export function historyFromApi(q: Api.QueueItem, me: Me | null): HistoryEntry {
  return {
    id: q.id,
    queueItemId: q.id,
    operatorId: q.assigned_to ?? "",
    operatorName: me && q.assigned_to === me.id ? me.name : q.assigned_to ? `#${shortId(q.assigned_to)}` : "—",
    phoneMasked: `#${shortId(q.subject_id)}`,
    reason: QUEUE_REASON[q.kind] ?? "complaint",
    result: historyResult(q),
    note: q.comment ?? q.reject_reason ?? "",
    rejectReason: q.reject_reason ?? undefined,
    createdAt: toMs(q.created_at),
    resolvedAt: toMs(q.finished_at ?? q.created_at),
    edited: false,
  };
}

// ---------------------------------------------------------------- stats
const PERIOD_DAYS: Record<StatsPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Query range for a period: the last N days including today (local dates). */
export function statsRange(period: StatsPeriod, now = new Date()): Api.StatsQuery {
  const from = new Date(now);
  from.setDate(from.getDate() - (PERIOD_DAYS[period] - 1));
  return { from_date: isoDate(from), to_date: isoDate(now) };
}

export function statsFromApi(s: Api.Stats, period: StatsPeriod): MarketingStats {
  return {
    period,
    totalIncome: toSom(s.revenue),
    totalCommission: toSom(s.commission),
    driversActive: s.active_drivers,
    driversOnline: s.online_drivers,
    driversOverLimit: s.drivers_over_limit ?? null,
    passengersNew: s.new_passengers,
    ordersTotal: s.orders_total,
    ordersCompleted: s.orders_completed,
    ordersCancelled: s.orders_cancelled,
    // Not in the contract's Stats (hidden on screen):
    passengersTotal: null,
    driversTotal: null,
    driversBlocked: null,
    driversNew: null,
    averageOrderValue: null,
    walletTotalBalance: null,
    ordersByStatus: null,
    ordersByRoute: null,
    registrations: null,
    incomeOverTime: null,
    incomeByRoute: null,
    incomeByCity: null,
  };
}
