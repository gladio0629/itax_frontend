// Mock server for the operator windows (search, passengers, passenger and
// driver cards). Built on the shared sample DB, so every order, passenger
// and driver id here is the same one the other screens load. Only
// adapters/mock.ts imports this file (never the http build).
import { ApiError, withLatency } from "@/mockDb/latency";
import { db, getSession, getStaff, getStaffMember, ROLE_SECTIONS, type AdminUser, type Section } from "@/mockDb/db";
import { readJSON, writeJSON } from "@/mockDb/storage";
import { makeRng } from "@/lib/prng";
import type { Driver, Order, Passenger } from "@/seed/generate";
import type { OpCardsApi } from "../opCards/adapter";
import type {
  OpBonusEntry,
  OpNote,
  OpNoteCategory,
  OpNotes,
  OpPassengerCard,
  OpPassengerOrderRow,
  OpPassengerOrdersFilter,
  OpPassengerRow,
  OpPassengerStatusFilter,
  OpPaymentRow,
  OpPaymentsFilter,
  OpPromoCode,
  OpSearchOrderHit,
  OpSearchResult,
  OpSmsInfo,
  OpSmsPeriod,
  OpSmsRow,
  OpSubject,
  OpSubjectRequest,
  OpTimelineItem,
} from "../opCards/types";
import type { ListPeriod, OrderStatus } from "../types";

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

// ------------------------------------------------------------ cards: helpers

const DAY = 86_400_000;
const MIN = 60_000;
const DRIVER_ACCESS: Section[] = ["drivers", "drivers_view"];

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
const rngFor = (key: string) => makeRng(hash(key));
const seqNo = (id: string) => {
  const m = /(\d+)$/.exec(id);
  return m ? Number(m[1]) : hash(id) % 1000;
};
const subjectKey = (s: OpSubject) => `${s.kind}:${s.id}`;
/** Start of today: recent sample events (SMS, notes) are placed from here. */
const today0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
function inPeriod(ts: number, period: ListPeriod): boolean {
  const t0 = today0();
  switch (period) {
    case "all":
      return true;
    case "today":
      return ts >= t0;
    case "yesterday":
      return ts >= t0 - DAY && ts < t0;
    case "7d":
      return ts >= t0 - 6 * DAY;
    case "30d":
      return ts >= t0 - 29 * DAY;
    case "90d":
      return ts >= t0 - 89 * DAY;
  }
}

/** What operators changed (notes, unlocks, resends); kept like the rest of the mock DB. */
type CardState = {
  notes: Record<string, OpNote[]>;
  unlockedAt: Record<string, number>;
  resentAt: Record<string, number[]>;
  history: Record<string, OpTimelineItem[]>;
};
const STATE_KEY = "op_cards";
const readState = (): CardState => ({ notes: {}, unlockedAt: {}, resentAt: {}, history: {}, ...readJSON<Partial<CardState>>(STATE_KEY, {}) });
const writeState = (st: CardState) => writeJSON(STATE_KEY, st);

function requirePassenger(id: string): Passenger {
  requireAny(PASSENGER_ACCESS);
  const p = db.getPassenger(id);
  if (!p || p.archived) throw new ApiError("PASSENGER_NOT_FOUND", "Yo'lovchi topilmadi.");
  return p;
}
function requireDriver(id: string): Driver {
  requireAny(DRIVER_ACCESS);
  const d = db.getDriver(id);
  if (!d || d.archived) throw new ApiError("DRIVER_NOT_FOUND", "Haydovchi topilmadi.");
  return d;
}
function requireSubject(s: OpSubject): AdminUser {
  if (s.kind === "passenger") requirePassenger(s.id);
  else requireDriver(s.id);
  return actor();
}

const staffOf = (role: AdminUser["role"]) => getStaff().filter((u) => u.role === role && !u.archived);
const ROLE_WORD: Record<AdminUser["role"], string> = { superadmin: "superadmin", owner: "owner", menejer: "menejer", marketolog: "marketolog", operator: "operator" };
const signed = (u: AdminUser | undefined, fallback: AdminUser["role"]) => (u ? `${u.name} (${ROLE_WORD[u.role]})` : ROLE_WORD[fallback]);
const pickStaff = (role: AdminUser["role"], key: string) => {
  const list = staffOf(role);
  return list.length ? list[hash(key) % list.length] : undefined;
};

/** Sample split of card payments between card, Payme and Click. */
function payMethodOf(o: Order): "cash" | "card" | "payme" | "click" {
  if (o.paymentMethod === "cash") return "cash";
  return (["card", "payme", "click"] as const)[hash(o.id) % 3];
}

// ------------------------------------------------------------ SMS

const SMS_MAX = 5;
const RESEND_PER_HOUR = 3;
/** Sample scenario: some people are locked out after wrong codes. */
const smsLockedScenario = (s: OpSubject) =>
  s.kind === "passenger" ? db.getPassenger(s.id)?.status === "warned" || hash(subjectKey(s)) % 5 === 0 : hash(subjectKey(s)) % 6 === 0;

function smsLog(s: OpSubject, st: CardState): OpSmsRow[] {
  const key = subjectKey(s);
  const r = rngFor(`sms:${key}`);
  const t0 = today0();
  const rows: OpSmsRow[] = [];
  const older = r.int(2, 4);
  for (let i = 0; i < older; i++) {
    const at = t0 - r.int(2, 25) * DAY + r.int(6 * 60, 22 * 60) * MIN;
    const ok = r.bool(0.8);
    rows.push({ id: `${key}:o${i}`, at, type: "login", provider: "Eskiz", result: ok ? "entered" : "not_delivered", limit: null });
    if (!ok) rows.push({ id: `${key}:o${i}r`, at: at + 2 * MIN, type: "login_retry", provider: "Eskiz", result: "entered", limit: null });
  }
  if (smsLockedScenario(s)) {
    // Rounded so the sample times stay put between requests.
    const base = Math.floor(Date.now() / (10 * MIN)) * 10 * MIN - r.int(1, 4) * 10 * MIN;
    rows.push({ id: `${key}:l1`, at: base - 9 * MIN, type: "login", provider: "Eskiz", result: "delivered", limit: null });
    rows.push({ id: `${key}:l2`, at: base - 4 * MIN, type: "login", provider: "Eskiz", result: "wrong_code", limit: null });
    rows.push({ id: `${key}:l3`, at: base - 2 * MIN, type: "login", provider: "Eskiz", result: "wrong_code", limit: null });
    rows.push({ id: `${key}:l4`, at: base, type: "login", provider: "Eskiz", result: "limit", limit: { used: SMS_MAX, max: SMS_MAX } });
  } else {
    rows.push({ id: `${key}:last`, at: Math.floor(Date.now() / (10 * MIN)) * 10 * MIN - r.int(1, 6) * 60 * MIN, type: "login", provider: "Eskiz", result: "entered", limit: null });
  }
  (st.resentAt[key] ?? []).forEach((at, i) => rows.push({ id: `${key}:re${i}`, at, type: "login_resent", provider: "Eskiz", result: "delivered", limit: null }));
  return rows.sort((a, b) => b.at - a.at);
}

function smsInfo(s: OpSubject, period: OpSmsPeriod): OpSmsInfo {
  const st = readState();
  const key = subjectKey(s);
  const all = smsLog(s, st);
  const locked = smsLockedScenario(s) && !st.unlockedAt[key];
  const resendsLastHour = (st.resentAt[key] ?? []).filter((t) => t > Date.now() - 60 * MIN).length;
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  return {
    lastAt: all[0]?.at ?? null,
    lastResult: all[0]?.result ?? null,
    attempts: { used: locked ? SMS_MAX : Math.min(SMS_MAX, 1 + resendsLastHour), max: SMS_MAX },
    lock: locked ? { wrongAttempts: SMS_MAX, minutes: 30 } : null,
    actions: [...(locked ? (["sms_unlock"] as const) : []), ...(resendsLastHour < RESEND_PER_HOUR ? (["sms_resend"] as const) : [])],
    log: all.filter((x) => x.at >= today0() - (days - 1) * DAY),
  };
}

// ------------------------------------------------------------ notes and requests

const NOTE_SAMPLES: Record<OpSubject["kind"], { category: OpNoteCategory; text: string }[]> = {
  passenger: [
    { category: "complaint", text: "Haydovchi 40 daqiqa kech qoldi. Uzr so'raldi, pul qaytarish uchun menejerga so'rov yuborildi." },
    { category: "login", text: "SMS kelmagan: limit ochildi, kod qayta yuborildi. Kirdi." },
    { category: "info", text: "Bagaj haqida so'radi: 2 ta katta chamadon bepul ekani tushuntirildi." },
    { category: "payment", text: "Karta bilan to'lov ushlab turilgani haqida so'radi: safar tugagach yechilishi tushuntirildi." },
  ],
  driver: [
    { category: "complaint", text: "Haydovchiga qo'ng'iroq qilindi: tirbandlik sabab kechikkan. Ogohlantirildi." },
    { category: "payment", text: "Click to'ldirish xato bergan, 4 daqiqadan keyin qayta to'ldirildi. Pul ikki marta yechilmagan." },
    { category: "info", text: "Kuzov o'lchamini qanday o'zgartirishni so'radi: Profil → Imkoniyatlar bo'limi ko'rsatildi." },
  ],
};

function notesFor(s: OpSubject, st: CardState): OpNote[] {
  const key = subjectKey(s);
  if (st.notes[key]) return st.notes[key];
  const r = rngFor(`notes:${key}`);
  const ops = staffOf("operator");
  const picks = r.shuffle(NOTE_SAMPLES[s.kind]).slice(0, r.int(0, 3));
  let at = Math.floor(Date.now() / (10 * MIN)) * 10 * MIN - r.int(1, 9) * 10 * MIN;
  return picks.map((n, i) => {
    const note: OpNote = { id: `${key}:n${i}`, authorName: ops.length ? r.pick(ops).name : "Operator", category: n.category, text: n.text, at };
    at -= r.int(1, 8) * DAY + r.int(0, 600) * MIN;
    return note;
  });
}

function requestsFor(s: OpSubject): OpSubjectRequest[] {
  const key = subjectKey(s);
  const r = rngFor(`req:${key}`);
  const n = r.int(0, 2);
  const out: OpSubjectRequest[] = [];
  for (let i = 0; i < n; i++) {
    const no = 100 + ((hash(key) + i * 7) % 90);
    if (s.kind === "passenger") {
      const refund = i === 0;
      out.push({
        id: `${key}:r${i}`,
        displayId: `S-${no}`,
        type: refund ? "refund" : "sms_unlock",
        amount: refund ? r.pick([13000, 26000, 52000]) : null,
        status: refund ? "pending" : "approved",
      });
    } else {
      const fix = i === 0;
      out.push({
        id: `${key}:r${i}`,
        displayId: `S-${no}`,
        type: fix ? "ledger_fix" : "penalty_cancel",
        amount: fix ? r.pick([1300, 2600, -5000]) : 5000,
        status: fix ? "pending" : r.pick(["approved", "rejected"] as const),
      });
    }
  }
  return out;
}

function notesInfo(s: OpSubject): OpNotes {
  const st = readState();
  return { notes: notesFor(s, st), requests: requestsFor(s), actions: ["add_note"] };
}

// ------------------------------------------------------------ passenger card

const ACTIVE_STATUSES: OrderStatus[] = ["searching", "accepted", "arrived", "in_progress"];
const orderGroup = (st: OrderStatus): OpPassengerOrdersFilter =>
  ACTIVE_STATUSES.includes(st) ? "active" : st === "completed" ? "completed" : "cancelled";

const passengerOrders = (id: string) =>
  db
    .orders()
    .filter((o) => o.passengerId === id)
    .sort((a, b) => b.createdAt - a.createdAt);

function passengerPayments(p: Passenger): OpPaymentRow[] {
  const rows: OpPaymentRow[] = [];
  const prefix = { card: "CR", payme: "PM", click: "CL" } as const;
  for (const o of passengerOrders(p.id)) {
    if (o.status === "no_driver" || o.status === "searching") continue;
    const r = rngFor(`pay:${o.id}`);
    const type = payMethodOf(o);
    if (o.status === "cancelled" && type === "cash") continue;
    const txn = (t: "card" | "payme" | "click") => `${prefix[t]}-${r.int(1000, 9999)}-${String(r.int(0, 9999)).padStart(4, "0")}`;
    const at = o.createdAt + MIN;
    const status = o.status === "completed" ? (type === "cash" ? "to_driver" : "paid") : o.status === "cancelled" ? "refunded" : type === "cash" ? "to_driver" : "held";
    if (type !== "cash" && r.bool(0.12))
      rows.push({ id: `fail_${o.id}`, at: at - 2 * MIN, type, orderId: o.id, txnId: txn(type), cardLast4: null, amount: o.price, status: "failed" });
    rows.push({
      id: `pay_${o.id}`,
      at,
      type,
      orderId: o.id,
      txnId: type === "cash" ? null : txn(type),
      cardLast4: type === "card" ? String(r.int(1000, 9999)) : null,
      amount: o.price,
      status,
    });
    if (o.status === "cancelled")
      rows.push({ id: `ref_${o.id}`, at: at + 31 * MIN, type: "refund", orderId: o.id, txnId: `RF-${r.int(1000, 9999)}-${r.int(1000, 9999)}`, cardLast4: null, amount: o.price, status: "refunded" });
    if (o.status === "completed" && (o.rating ?? 0) >= 5 && r.bool(0.5))
      rows.push({
        id: `tip_${o.id}`,
        at: at + (o.durationMin ?? 120) * MIN,
        type: "tip",
        orderId: o.id,
        txnId: txn("card"),
        cardLast4: null,
        amount: r.pick([5000, 10000, 15000]),
        status: "paid",
      });
  }
  return rows.sort((a, b) => b.at - a.at);
}

function passengerBonus(p: Passenger): { entries: OpBonusEntry[]; promos: OpPromoCode[] } {
  const r = rngFor(`bonus:${p.id}`);
  const events: Omit<OpBonusEntry, "balanceAfter">[] = [{ id: `${p.id}:b0`, at: p.joinedAt, text: "Ro'yxatdan o'tish sovg'asi", orderId: null, amount: 5000 }];
  if (r.bool(0.5)) {
    const friend = r.pick(db.passengers().filter((x) => x.id !== p.id));
    events.push({ id: `${p.id}:b1`, at: p.joinedAt + r.int(5, 40) * DAY, text: `Do'stni taklif qilish: ${friend.name.split(" ")[0]} ${friend.name.split(" ")[1]?.[0] ?? ""}.`, orderId: null, amount: 15000 });
  }
  const done = passengerOrders(p.id).filter((o) => o.status === "completed").reverse();
  done.forEach((o, i) => {
    events.push({ id: `${o.id}:cb`, at: o.createdAt + (o.durationMin ?? 120) * MIN, text: "Keshbek 1%", orderId: o.id, amount: Math.max(100, Math.round(o.price / 100 / 100) * 100) });
    if (i === 1) events.push({ id: `${o.id}:use`, at: o.createdAt, text: "Ishlatildi", orderId: o.id, amount: -5000 });
  });
  events.sort((a, b) => a.at - b.at);
  let bal = 0;
  const entries = events.map((e) => {
    bal = Math.max(0, bal + e.amount);
    return { ...e, balanceAfter: bal };
  });
  const promos: OpPromoCode[] = [
    { code: "YANGI25", discount: { percent: 25, maxAmount: 30000 }, usedAt: p.joinedAt + DAY, validUntil: null, status: "used" },
    { code: "SAMARQAND10", discount: { percent: 10, maxAmount: null }, usedAt: r.bool(0.5) ? today0() - r.int(3, 20) * DAY : null, validUntil: null, status: "used" },
    { code: "QISH2026", discount: { amount: 15000 }, usedAt: null, validUntil: Date.UTC(2026, 11, 31), status: "active" },
  ];
  promos[1].status = promos[1].usedAt ? "used" : "expired";
  return { entries: entries.reverse(), promos: promos.slice(0, r.int(1, 3)) };
}

function passengerCard(p: Passenger): OpPassengerCard {
  const r = rngFor(`pc:${p.id}`);
  const subject: OpSubject = { kind: "passenger", id: p.id };
  const st = readState();
  const orders = passengerOrders(p.id);
  const cancelled = orders.filter((o) => o.status === "cancelled" && o.cancelledBy !== "driver");
  const weekAgo = (orders[0]?.createdAt ?? Date.now()) - 7 * DAY;
  const mgr = pickStaff("menejer", p.id);
  const noteAt = today0() - 6 * DAY + (14 * 60 + 20) * MIN;
  const statusNote =
    p.status === "warned"
      ? { text: "bir hafta ichida bir necha marta oxirgi daqiqada bekor qilgan. Yana takrorlansa, bloklash so'raladi.", byName: signed(mgr, "menejer"), at: noteAt }
      : p.status === "blocked"
        ? { text: "haydovchilarga qo'pol muomala bo'yicha bir nechta shikoyat tushgan.", byName: signed(mgr, "menejer"), at: noteAt }
        : null;
  const history: OpTimelineItem[] = [
    ...(st.history[subjectKey(subject)] ?? []),
    ...(statusNote
      ? [{ id: `${p.id}:h1`, title: p.status === "warned" ? "Ogohlantirildi" : "Bloklandi", detail: `${statusNote.byName}: ${statusNote.text}`, at: statusNote.at, tone: "danger" as const }]
      : []),
    { id: `${p.id}:h0`, title: "Ro'yxatdan o'tdi", detail: "Telefon va SMS orqali", at: p.joinedAt, tone: "neutral" as const },
  ].sort((a, b) => b.at - a.at);
  const bonus = passengerBonus(p);
  const deletion = hash(p.id) % 6 === 1;
  const requestedAt = today0() - 2 * DAY + (9 * 60 + 14) * MIN;
  return {
    id: p.id,
    displayId: `P-${20900 + seqNo(p.id)}`,
    name: p.name,
    phone: p.phone,
    status: p.status,
    joinedAt: p.joinedAt,
    language: r.pick(["o'zbek", "o'zbek", "rus"]),
    actions: ["call", "request", "refund_request", "add_note"],
    tabs: {
      orders: orders.length,
      payments: passengerPayments(p).length,
      notes: notesFor(subject, st).length,
      smsAlert: smsInfo(subject, "7d").lock !== null,
    },
    statusNote,
    stats: {
      orders: orders.length,
      cancelled: cancelled.length,
      cancelledThisWeek: cancelled.filter((o) => o.createdAt >= weekAgo).length,
      bonusBalance: bonus.entries[0]?.balanceAfter ?? 0,
      rating: p.rating || null,
    },
    profile: {
      app: r.pick(["1.8.2 · iPhone, iOS 18", "1.8.2 · Android 14", "1.7.9 · Android 13"]),
      mainPayment: orders[0] ? payMethodOf(orders[0]) : null,
      savedAddresses: r.shuffle(["Uy", "Ish", "Ota-onam", "Universitet"]).slice(0, r.int(0, 3)),
      lastOrder: orders[0] ? { id: orders[0].id, createdAt: orders[0].createdAt } : null,
    },
    statusHistory: history,
    deletionRequest: deletion ? { requestedAt, reason: r.pick(["Boshqa raqamga o'tyapman", null]), autoDeleteAt: requestedAt + 30 * DAY } : null,
  };
}

function orderRow(o: Order): OpPassengerOrderRow {
  const d = o.driverId ? db.getDriver(o.driverId) : undefined;
  return {
    id: o.id,
    kind: o.kind,
    from: cityName(o.fromCityId),
    to: cityName(o.toCityId),
    createdAt: o.createdAt,
    driver: d ? { name: d.name, phone: d.phone } : null,
    payment: payMethodOf(o),
    price: o.price,
    status: o.status,
    cancelledBy: o.cancelledBy,
  };
}

const PAYMENT_FILTER: Record<Exclude<OpPaymentsFilter, "all">, (r: OpPaymentRow) => boolean> = {
  card: (r) => r.type === "card",
  payme: (r) => r.type === "payme",
  click: (r) => r.type === "click",
  refund: (r) => r.type === "refund",
  tip: (r) => r.type === "tip",
};

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

  getOpPassenger: (id) => withLatency(() => passengerCard(requirePassenger(id))),

  getOpPassengerOrders: (id, query) =>
    withLatency(() => {
      requirePassenger(id);
      const inRange = passengerOrders(id).filter((o) => inPeriod(o.createdAt, query.period));
      const counts = { all: inRange.length, active: 0, completed: 0, cancelled: 0 };
      inRange.forEach((o) => counts[orderGroup(o.status)]++);
      const rows = (query.status === "all" ? inRange : inRange.filter((o) => orderGroup(o.status) === query.status)).map(orderRow);
      return { ...page(rows, query.page), counts };
    }),

  getOpPassengerPayments: (id, query) =>
    withLatency(() => {
      const p = requirePassenger(id);
      const all = passengerPayments(p);
      const sum = (rows: OpPaymentRow[]) => rows.reduce((a, r) => a + r.amount, 0);
      const paid = all.filter((r) => r.type !== "refund" && r.type !== "tip" && r.status !== "failed" && r.status !== "refunded");
      const refunds = all.filter((r) => r.type === "refund");
      const tips = all.filter((r) => r.type === "tip");
      const failed = all.filter((r) => r.status === "failed");
      const counts: Partial<Record<OpPaymentsFilter, number>> = { all: all.length };
      (Object.keys(PAYMENT_FILTER) as Exclude<OpPaymentsFilter, "all">[]).forEach((k) => (counts[k] = all.filter(PAYMENT_FILTER[k]).length));
      const rows = query.type === "all" ? all : all.filter(PAYMENT_FILTER[query.type]);
      return {
        ...page(rows, query.page),
        summary: {
          paid: sum(paid),
          refunded: sum(refunds),
          refundCount: refunds.length,
          tips: sum(tips),
          tipCount: tips.length,
          failedCount: failed.length,
          lastFailed: failed[0] ? { type: failed[0].type, at: failed[0].at } : null,
        },
        counts,
      };
    }),

  getOpPassengerBonus: (id) =>
    withLatency(() => {
      const b = passengerBonus(requirePassenger(id));
      return { balance: b.entries[0]?.balanceAfter ?? 0, entries: b.entries, promos: b.promos };
    }),

  getOpSms: (subject, period) =>
    withLatency(() => {
      requireSubject(subject);
      return smsInfo(subject, period);
    }),

  unlockOpSms: (subject, period) =>
    withLatency(() => {
      const who = requireSubject(subject);
      const info = smsInfo(subject, period);
      if (!info.actions.includes("sms_unlock")) throw new ApiError("SMS_NOT_LOCKED", "Kirish limiti allaqachon ochiq.");
      const st = readState();
      const key = subjectKey(subject);
      st.unlockedAt[key] = Date.now();
      st.history[key] = [{ id: `${key}:u${Date.now()}`, title: "Kirish limiti ochildi", detail: signed(who, "operator"), at: Date.now(), tone: "neutral" }, ...(st.history[key] ?? [])];
      writeState(st);
      return smsInfo(subject, period);
    }),

  resendOpSmsCode: (subject, period) =>
    withLatency(() => {
      requireSubject(subject);
      if (!smsInfo(subject, period).actions.includes("sms_resend")) throw new ApiError("SMS_RESEND_LIMIT", "Kod bir soatda ko'pi bilan 3 marta qayta yuboriladi.");
      const st = readState();
      const key = subjectKey(subject);
      st.resentAt[key] = [...(st.resentAt[key] ?? []), Date.now()];
      writeState(st);
      return smsInfo(subject, period);
    }),

  getOpNotes: (subject) =>
    withLatency(() => {
      requireSubject(subject);
      return notesInfo(subject);
    }),

  addOpNote: (subject, text) =>
    withLatency(() => {
      const who = requireSubject(subject);
      const t = text.trim();
      if (!t) throw new ApiError("VALIDATION_ERROR", "Izoh bo'sh bo'lmasin.");
      if (t.length > 1000) throw new ApiError("VALIDATION_ERROR", "Izoh 1000 belgidan oshmasin.");
      const st = readState();
      const key = subjectKey(subject);
      const note: OpNote = { id: `${key}:n${Date.now()}`, authorName: who.name, category: "info", text: t, at: Date.now() };
      st.notes[key] = [note, ...notesFor(subject, st)];
      writeState(st);
      return note;
    }),
};
