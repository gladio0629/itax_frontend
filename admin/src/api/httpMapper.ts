// The one place that converts between api/openapi.yml shapes and the admin
// UI types. Money: API tiyin ↔ UI so'm. Where the contract has no value for
// a UI field, the field gets a neutral placeholder and
// `httpAdapter.capabilities` hides it on screen (see
// docs/backend-gaps/admin.md); no business rule is computed here.
import type * as Api from "@shared/api/openapi";
import { formatDayShort } from "@/lib/format";
import type {
  ActiveTask,
  AdjustmentProposal,
  AdminRole,
  AuditEntry,
  Complaint,
  ComplaintStatus,
  ComplaintType,
  Driver,
  DriverStatus,
  HistoryEntry,
  HistoryResult,
  MarketingStats,
  Me,
  OrderFieldsPatch,
  OrderWithNames,
  OrderDetail,
  Dashboard,
  DashboardPeriod,
  ListPeriod,
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
export const toIso = (ms: number): string => new Date(ms).toISOString();

/** "+998 90 123 45 67" / "90 123-45-67" / "901234567" → "+998901234567", or null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  return null;
}

import { formatPhone } from "@/lib/format";
export { formatPhone };

/** The UI edits one "Ism" field; the API stores first and last name. */
export function splitName(full: string): { first_name: string; last_name: string } | null {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2 || !parts[0]) return null;
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

const joinName = (first?: string | null, last?: string | null) => [first, last].filter(Boolean).join(" ").trim() || "—";
export const shortId = (id: string) => id.slice(0, 8);

/** Staff display name for a bare staff id: the caller resolves what it
 * knows (itself, a loaded staff list), otherwise "#1a2b3c4d". */
export type StaffNameOf = (id: string) => string | undefined;
const staffLabel = (id: string | null | undefined, nameOf: StaffNameOf) => (id ? nameOf(id) ?? `#${shortId(id)}` : "—");

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
  complaints: "complaints",
  audit: "audit",
};
/** Route of each section, in sidebar order (first allowed = landing page). */
const SECTION_PATH: [Section, string][] = [
  ["stats", "/dashboard"],
  ["drivers", "/drivers"],
  ["passengers", "/passengers"],
  ["orders", "/orders"],
  ["wallet", "/wallet"],
  ["tariffs", "/tariffs"],
  ["complaints", "/complaints"],
  ["staff", "/staff"],
  ["operators", "/operators"],
  ["audit", "/audit"],
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
    phone: formatPhone(d.phone),
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
    // v2 fields the contract doesn't carry yet (docs/backend-gaps/admin.md):
    route: null,
    level: null,
    atDebtLimit: null,
    commissionPct: null,
    carYear: d.car?.year ?? null,
    seats: d.car?.seats ?? null,
    acceptRate30d: null,
    cancelsThisWeek: null,
    cancelLimitWeek: null,
    cargoBodies: null,
    loaderHelp: null,
    documents: null,
  };
}

export function passengerFromApi(p: Api.AdminPassenger): Passenger {
  return {
    id: p.id,
    name: joinName(p.first_name, p.last_name),
    phone: formatPhone(p.phone),
    rating: p.rating ?? 0,
    totalTrips: p.orders_count ?? 0,
    avatarSeed: p.id,
    cityId: "", // not in the contract (capabilities.passengerCity = false)
    status: p.state === "blocked" ? "blocked" : "active",
    archived: p.state === "archived",
    joinedAt: toMs(p.created_at),
    lastTripAt: null,
    lastPayment: null,
  };
}

// --------------------------------------------------------------- orders
const placeName = (g: Api.GeoPoint) => g.address?.trim() || `${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}`;

export function orderFromApi(o: Api.AdminOrder): OrderWithNames {
  const seats = o.seats ?? 0;
  return {
    id: o.id,
    passengerId: o.passenger_id ?? "",
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
    scheduledRange: o.scheduled_from && o.scheduled_to ? { from: toMs(o.scheduled_from), to: toMs(o.scheduled_to) } : undefined,
    note: o.comment ?? undefined,
    cancelReason: o.cancel_reason ?? undefined,
    kind: o.type === "delivery" ? "delivery" : "passenger",
    // The order's vehicle_type is a car name (spark, labo…), never shown;
    // the S–3XL size label is not on the order yet (gap).
    bodySize: null,
    luggageCount: null,
    pickupAddress: o.from.address?.trim() || null,
    dropoffAddress: o.to.address?.trim() || null,
    durationMin: o.duration_s ? Math.round(o.duration_s / 60) : null,
    commission: null,
    driverPayout: null,
    cancelledBy: null,
    // Only passenger_id, no name (capabilities.orderPassenger = false).
    passengerName: "—",
    driverName: o.driver?.first_name ?? null,
    fromCityName: placeName(o.from),
    toCityName: placeName(o.to),
    // Order.can_cancel is the passenger's verdict; there is none for admins,
    // so the action is offered and the server's 403 decides.
    canCancel: true,
  };
}

const CAR_CLASS_LABEL: Record<Api.CarClass, string> = { economy: "Standart", comfort: "Komfort", business: "Biznes", minivan: "Miniven" };
/** PriceLine.key (a client i18n key) → admin label. Unknown keys show as "Boshqa". */
const PRICE_LINE_LABEL: Record<string, string> = {
  "quote.seatFare": "O'rindiq narxi",
  "quote.carFare": "Butun mashina",
  "quote.class.komfort": "Komfort klass",
  "quote.class.biznes": "Biznes klass",
  "quote.class.miniven": "Miniven klass",
  "quote.cargoBase": "Dostavka, asosiy narx",
  "quote.cargoDistance": "Dostavka, masofa",
};

/** GET /admin/v1/orders/{id}. Timeline, commission and the driver's share
 * are not in the contract yet: null (hidden). */
export function orderDetailFromApi(o: Api.AdminOrder): OrderDetail {
  const base = orderFromApi(o);
  const car = o.driver?.car;
  return {
    ...base,
    canCancel: o.can_cancel ?? true,
    passengerRating: null,
    driverRating: o.driver?.rating ?? null,
    driverCar: car ? [`${car.brand} ${car.model}`.trim(), car.plate_number].filter(Boolean).join(" · ") : null,
    carClassLabel: o.car_class ? CAR_CLASS_LABEL[o.car_class] : null,
    steps: null,
    priceLines: o.price_lines?.length
      ? o.price_lines.map((l) => ({ label: PRICE_LINE_LABEL[l.key] ?? "Boshqa", amount: toSom(l.amount), kind: "line" as const }))
      : null,
    canEdit: o.editable ?? false,
  };
}

/** Edit form → AdminOrderUpdate. Only fields the caller set are sent. */
export function orderPatchToApi(patch: OrderFieldsPatch): Api.AdminOrderUpdate {
  const body: Api.AdminOrderUpdate = {};
  if (patch.note !== undefined) body.comment = patch.note;
  if (patch.paymentMethod !== undefined) body.payment_method = patch.paymentMethod;
  if (patch.schedule) {
    if ("at" in patch.schedule) body.scheduled_at = toIso(patch.schedule.at);
    else {
      body.scheduled_from = toIso(patch.schedule.from);
      body.scheduled_to = toIso(patch.schedule.to);
    }
  }
  return body;
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

export function correctionFromApi(c: Api.CorrectionListItem, driverId: string, me: Me | null): AdjustmentProposal {
  return {
    id: c.id,
    driverId,
    // The correction names a wallet, not a driver.
    subjectLabel: `Hamyon #${shortId(c.wallet_id)}`,
    amount: toSom(c.amount),
    reason: c.reason,
    proposedById: c.created_by,
    proposedByName: c.created_by_name?.trim() || (me && c.created_by === me.id ? me.name : `#${shortId(c.created_by)}`),
    status: APPROVAL[c.approval_status],
    createdAt: toMs(c.created_at),
  };
}

export function approvalToApi(status: AdjustmentProposal["status"] | "all" | undefined): Api.ApprovalStatus | undefined {
  if (status === "pending_second") return "pending_approval";
  if (status === "approved" || status === "rejected") return status;
  return undefined;
}

// ----------------------------------------------------------- complaints
const COMPLAINT_STATUS_FROM_API: Record<Api.ComplaintStatus, ComplaintStatus> = {
  open: "open",
  in_progress: "reviewing",
  resolved: "resolved",
  rejected: "dismissed",
};
export const complaintStatusFromApi = (s: Api.ComplaintStatus): ComplaintStatus => COMPLAINT_STATUS_FROM_API[s] ?? "open";
const COMPLAINT_STATUS_TO_API: Record<ComplaintStatus, Api.ComplaintStatus> = {
  open: "open",
  reviewing: "in_progress",
  resolved: "resolved",
  dismissed: "rejected",
};
export const complaintStatusToApi = (s: ComplaintStatus): Api.ComplaintStatus => COMPLAINT_STATUS_TO_API[s];

const COMPLAINT_CATEGORIES: readonly string[] = ["driver_behavior", "passenger_behavior", "payment", "safety", "lost_item", "app_issue", "other"];

export function complaintFromApi(c: Api.Complaint | Api.ComplaintDetail, nameOf: StaffNameOf): Complaint {
  const notes = "notes" in c ? c.notes : [];
  return {
    id: c.id,
    // Complaint.category is a plain string in responses: unknown → "other".
    type: (COMPLAINT_CATEGORIES.includes(c.category) ? c.category : "other") as ComplaintType,
    orderId: c.order_id ?? undefined,
    driverId: c.subject_type === "driver" ? c.subject_id : undefined,
    passengerId: c.subject_type === "passenger" ? c.subject_id : undefined,
    subjectType: c.subject_type,
    subjectId: c.subject_id,
    status: complaintStatusFromApi(c.status),
    description: c.description,
    resolution: c.resolution ?? undefined,
    createdAt: toMs(c.created_at),
    assignedToId: c.assigned_to ?? undefined,
    assignedToName: c.assigned_to ? staffLabel(c.assigned_to, nameOf) : undefined,
    notes: notes.map((n) => ({
      id: n.id,
      text: n.text,
      authorId: n.author_id,
      authorName: staffLabel(n.author_id, nameOf),
      createdAt: toMs(n.created_at),
    })),
  };
}

// ---------------------------------------------------------------- audit
/** Snapshot keys whose values are safe to show in the one-line summary;
 * every other changed key (names, phones, emails…) is listed by name only. */
const AUDIT_VALUE_KEYS = new Set(["state", "status", "role", "approval_status", "active", "payment_method", "result", "kind", "car_class", "commission_percent"]);
const short = (v: unknown) => {
  const t = v === null || v === undefined ? "—" : typeof v === "object" ? "…" : String(v);
  return t.length > 24 ? `${t.slice(0, 24)}…` : t;
};

function auditDetail(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  if (!before && !after) return "—";
  if (!before) return "Yangi yozuv";
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after ?? {})]));
  const changed = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after?.[k]));
  if (changed.length === 0) return "O'zgarishsiz";
  return changed.map((k) => (AUDIT_VALUE_KEYS.has(k) ? `${k}: ${short(before[k])} → ${short(after?.[k])}` : k)).join(", ");
}

export function auditFromApi(e: Api.AuditEntry, nameOf: StaffNameOf): AuditEntry {
  const role = (ROLE_FROM_API as Record<string, AdminRole | undefined>)[e.actor_role] ?? e.actor_role;
  return {
    id: e.id,
    actorId: e.actor_id ?? "",
    actorName: e.actor_id ? nameOf(e.actor_id) ?? `${role} #${shortId(e.actor_id)}` : "Tizim",
    action: e.action,
    targetType: e.entity_type,
    targetId: e.entity_id,
    detail: auditDetail(e.before, e.after),
    createdAt: toMs(e.created_at),
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
  // QueueItem has no phone yet (gap): the row shows the subject's id instead.
  return {
    id: q.id,
    phone: null,
    subjectLabel: `#${shortId(q.subject_id)}`,
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
    phone: null,
    subjectLabel: `#${shortId(q.subject_id)}`,
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

const ORDER_STATUS_ORDER: Api.OrderStatus[] = ["searching", "accepted", "arrived", "in_progress", "completed", "cancelled", "expired"];

/** Every date from `from` to `to` (YYYY-MM-DD, inclusive). */
function datesBetween(from: string, to: string): string[] {
  const [fy, fm, fd] = from.split("-").map(Number);
  const out: string[] = [];
  for (let d = new Date(fy, fm - 1, fd); isoDate(d) <= to && out.length < 400; d.setDate(d.getDate() + 1)) out.push(isoDate(d));
  return out;
}
const dayLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return formatDayShort(new Date(y, m - 1, d));
};

export function statsFromApi(s: Api.Stats, period: StatsPeriod, range: Api.StatsQuery = statsRange(period)): MarketingStats {
  // `daily` lists only days that had orders (the contract says so): the
  // missing days of the requested range are zero-order days.
  let daily: NonNullable<Api.Stats["daily"]> | null = null;
  if (s.daily) {
    const byDate = new Map(s.daily.map((d) => [d.date, d]));
    const dates = range.from_date && range.to_date ? datesBetween(range.from_date, range.to_date) : s.daily.map((d) => d.date);
    daily = dates.map((date) => byDate.get(date) ?? { date, orders: 0, completed: 0, revenue: 0 });
  }
  const byStatus = s.orders_by_status;
  return {
    period,
    totalIncome: toSom(s.revenue),
    totalCommission: toSom(s.commission),
    averageOrderValue: s.average_order_value !== undefined ? toSom(s.average_order_value) : null,
    driversActive: s.active_drivers,
    driversOnline: s.online_drivers,
    driversOverLimit: s.drivers_over_limit ?? null,
    passengersNew: s.new_passengers,
    ordersTotal: s.orders_total,
    ordersCompleted: s.orders_completed,
    ordersCancelled: s.orders_cancelled,
    ordersExpired: s.orders_expired ?? null,
    ordersByStatus: byStatus
      ? // Only statuses that have orders: seven bars don't fit, and empty ones lose their labels.
        ORDER_STATUS_ORDER.filter((st) => (byStatus[st] ?? 0) > 0).map((st) => ({ status: st, count: byStatus[st] ?? 0 }))
      : null,
    ordersByRoute: s.top_routes ? s.top_routes.map((r) => ({ from: r.from_name, to: r.to_name, count: r.orders })) : null,
    incomeOverTime: daily ? daily.map((d) => ({ date: dayLabel(d.date), income: toSom(d.revenue) })) : null,
    ordersOverTime: daily ? daily.map((d) => ({ date: dayLabel(d.date), orders: d.orders, completed: d.completed })) : null,
    // Not in the contract's Stats (hidden on screen):
    passengersTotal: null,
    driversTotal: null,
    driversBlocked: null,
    driversNew: null,
    walletTotalBalance: null,
    registrations: null,
    incomeByRoute: null,
    incomeByCity: null,
  };
}

// ------------------------------------------------------- v2 dashboard
/** Relative list period → contract dates (local days, inclusive). */
export function listPeriodRange(period: ListPeriod | undefined, now = new Date()): Api.StatsQuery {
  if (!period || period === "all") return {};
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return isoDate(d);
  };
  switch (period) {
    case "today":
      return { from_date: day(0), to_date: day(0) };
    case "yesterday":
      return { from_date: day(1), to_date: day(1) };
    case "7d":
      return { from_date: day(6), to_date: day(0) };
    case "30d":
      return { from_date: day(29), to_date: day(0) };
  }
}

export const dashboardRange = (period: DashboardPeriod): Api.StatsQuery => listPeriodRange(period);
/** The dashboard chart: the last 14 days including today. */
export function last14Days(now = new Date()): Api.StatsQuery {
  const from = new Date(now);
  from.setDate(from.getDate() - 13);
  return { from_date: isoDate(from), to_date: isoDate(now) };
}

/** Dashboard from the existing stats endpoint. Deltas, sparklines, the
 * passenger/delivery split and most attention items are not in the
 * contract yet: null (hidden). */
export function dashboardFromApi(
  period: DashboardPeriod,
  kpi: Api.Stats,
  chart: Api.Stats,
  chartRange: Api.StatsQuery,
  recentOrders: OrderWithNames[] | null,
  sections: Section[]
): Dashboard {
  const k = (value: number) => ({ value, deltaPct: null, spark: null });
  let ordersByDay: Dashboard["ordersByDay"] = null;
  if (chart.daily && chartRange.from_date && chartRange.to_date) {
    const byDate = new Map(chart.daily.map((d) => [d.date, d.orders]));
    ordersByDay = datesBetween(chartRange.from_date, chartRange.to_date).map((date) => {
      const [y, m, dd] = date.split("-").map(Number);
      return { date: new Date(y, m - 1, dd).getTime(), total: byDate.get(date) ?? 0, passenger: null, delivery: null };
    });
  }
  const overLimit = kpi.drivers_over_limit;
  const debtSection: Section | null = sections.includes("wallet") ? "wallet" : sections.includes("drivers") ? "drivers" : null;
  return {
    period,
    orders: k(kpi.orders_total),
    activeDrivers: k(kpi.active_drivers),
    newPassengers: k(kpi.new_passengers),
    commission: k(toSom(kpi.commission)),
    ordersByDay,
    topRoutes: kpi.top_routes ? kpi.top_routes.map((r) => ({ from: r.from_name, to: r.to_name, count: r.orders })) : null,
    recentOrders,
    attention:
      overLimit === undefined || !debtSection
        ? null
        : overLimit > 0
          ? [{ id: "debt", tone: "danger", title: `${overLimit} haydovchi qarz chegarasida`, detail: "Yangi so'rovlar ular uchun to'xtatilgan", section: debtSection }]
          : [],
  };
}
