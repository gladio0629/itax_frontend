// Mock adapter: the only place with business rules (commission, debt limit,
// which requests a driver sees, seats, first-accept-wins, trip stages, bonus
// levels, filtering, pagination). Screens never compute any of this.
import { CITIES, computePrice, roadDistanceKm } from "@/seed/generate";
import { withLatency, ApiError } from "@/mockDb/latency";
import {
  BASE_COMMISSION_PCT, BONUS_LEVELS, CAR_COLORS, CAR_MODELS, DEBT_LIMIT, DEBT_NEAR_RATIO,
  CHILD_SEAT_AGES, DEFAULT_CAPABILITIES, TIP_AMOUNTS, appendLedger, carClassFor, cargoBodyFor, cityName, cityRef, genId, ledgerFor,
  levelFor, passengers, persist, presetState, pushNotification, replaceState, state, weekTrips,
  type BookingRecord, type DetailsRecord, type DriverState, type RequestRecord, type StopRecord, type TripRecord, type WhenRecord,
} from "@/mockDb/driverDb";
import { makeRng } from "@/lib/prng";
import { groupDigits } from "@/lib/format";
import type { ApiAdapter } from "../adapterTypes";
import type {
  AcceptBlock, AcceptedPage, BonusInfo, Booking, BookingDay, CapabilitiesInput, DebtState, TestOrderVariant, TestPreset, Direction,
  DriverCapabilities, DriverProfile, FeedPage, FeedQuery, HistoryItem, HistoryPage, HomeSummary, LedgerPage, OfferPlace,
  OrderExtras, OrderKind, OrderOption, PassengerInfo, Place, RequestAlert, ReviewKind, ReviewRequest, RideRequest, RoutesPage,
  TopupOptions, TripChat, TripDetail, TripPlace, TripStage, TripStep, TripSummary, TripWhen, WalletSummary,
} from "../types";

const TEST_OTP = "0000";
const LEDGER_PAGE_SIZE = 12;
const STAGES: TripStage[] = ["to_pickup", "waiting", "in_progress", "completed"];
const CANCEL_REASONS = ["cancel.reason.passengerNoShow", "cancel.reason.wrongAddress", "cancel.reason.carIssue", "cancel.reason.passengerAsked", "cancel.reason.other"];
const REJECT_REASONS = ["reject.reason.far", "reject.reason.price", "reject.reason.time", "reject.reason.passengers", "reject.reason.other"];
const ADDR: Record<string, string[]> = {
  tsh: ["Amir Temur ko'chasi, 15", "Chilonzor, 9-kvartal", "Yunusobod, 4-mavze", "Shota Rustaveli, 42"],
  smq: ["Registon ko'chasi, 3", "Universitet xiyoboni, 18", "Temiryo'l vokzali"],
  bxr: ["Mustaqillik ko'chasi, 21", "Labi Hovuz", "Avtovokzal"],
  and: ["Navoiy shoh ko'chasi, 12", "Bobur maydoni"],
  nmn: ["Islom Karimov ko'chasi, 8", "Chorsu bozori"],
  frg: ["Al-Farg'oniy ko'chasi, 5", "Markaziy bog'"],
  qrs: ["Nasaf ko'chasi, 11", "Qarshi vokzali"],
  nks: ["Doslik guzari, 6", "Berdaq ko'chasi, 19"],
  xva: ["Ichan qal'a darvozasi", "Xiva avtovokzali"],
};

// Passenger comments are their own words, so they stay untranslated.
const COMMENTS = [
  "Darvoza oldida kutib turing, iltimos.",
  "Yo'lda dorixonaga 5 daqiqaga to'xtaymiz.",
  "Konditsionerni yoqib qo'ying, iltimos.",
  "Telefonim o'chib qolishi mumkin, podyezd oldida turaman.",
  "Ertalab erta chiqsak yaxshi bo'lardi.",
];

const CHAT_MAX = 300;
const QUICK_REPLIES: Record<BookingRecord["stage"], string[]> = {
  to_pickup: ["chat.quick.onMyWay", "chat.quick.fiveMin", "chat.quick.whichEntrance", "chat.quick.ok"],
  waiting: ["chat.quick.arrived", "chat.quick.whichEntrance", "chat.quick.ok"],
  in_progress: ["chat.quick.almostThere", "chat.quick.ok"],
};

// Market rules.
const SEATS_TOTAL = 4;
const REQUEST_EVERY_MS: [number, number] = [20_000, 40_000];
const MAX_MARKET = 30;
/** How long a request another driver took stays in the feed (so the card can say so). */
const TAKEN_LINGER_MS = 5_000;
const DAY = 86_400_000;
const FEED_DAYS = 7;

const rand = makeRng(Date.now() % 1_000_000);

// ---------- derived values ----------

function commissionPctNow(s: DriverState) {
  return levelFor(weekTrips(s)).commissionPct;
}

function debtState(s: DriverState): DebtState {
  const debtAmount = Math.max(0, -s.balance);
  const usedRatio = Math.min(1, debtAmount / -DEBT_LIMIT);
  const level = s.balance <= DEBT_LIMIT ? "blocked" : usedRatio >= DEBT_NEAR_RATIO ? "near" : "ok";
  return { level, balance: s.balance, limit: DEBT_LIMIT, debtAmount, usedRatio };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayStartAt(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.getTime();
}

function isoDate(dayStart: number) {
  const d = new Date(dayStart);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayOffsetOf(dayStart: number) {
  return Math.round((dayStart - startOfToday()) / DAY);
}

function todayTrips(s: DriverState) {
  const t0 = startOfToday();
  // Earnings land when a trip finishes, so "today" is by completion time.
  return s.trips.filter((t) => t.status === "completed" && endedAt(t) >= t0);
}

function homeSummary(s: DriverState): HomeSummary {
  const today = todayTrips(s);
  const debt = debtState(s);
  const now = Date.now();
  return {
    todayEarnings: today.reduce((sum, t) => sum + t.net, 0),
    todayTrips: today.length,
    unreadNotifications: s.notifications.filter((n) => !n.read).length,
    debt,
    canAcceptOrders: debt.level !== "blocked",
    bonusActive: commissionPctNow(s) < BASE_COMMISSION_PCT,
    // Muting "Yangi buyurtmalar" silences the badge too.
    newRequests: s.prefs.master && s.prefs.newOrders ? s.requests.filter((r) => r.postedAt > s.feedSeenAt && isVisible(s, r, now) && !isTaken(r, now)).length : 0,
  };
}

function passengerInfo(id: string): PassengerInfo {
  const p = passengers.find((x) => x.id === id) ?? passengers[0];
  const tail = p.phoneMasked.slice(-2);
  return { name: p.name, rating: p.rating, phoneMasked: `+998 ** *** ** ${tail}`, avatarSeed: p.avatarSeed };
}

/** Before acceptance the intercom code is withheld — only its existence is shown. */
function offerPlace(cityId: string, address: string, d?: DetailsRecord): OfferPlace {
  if (!d) return { city: cityRef(cityId), address };
  const { intercom, ...rest } = d;
  return { city: cityRef(cityId), address, details: { ...rest, intercomOnAccept: intercom ? true : undefined } };
}

function tripPlace(cityId: string, address: string, d?: DetailsRecord): TripPlace {
  return d ? { city: cityRef(cityId), address, details: { ...d } } : { city: cityRef(cityId), address };
}

/**
 * Shared order details. On a request (not yet accepted) the passenger's
 * identity stays private: no "for someone else" name, cargo contacts by name only.
 */
function extras<P extends Place>(o: RequestRecord, place: (cityId: string, address: string, d?: DetailsRecord) => P, accepted: boolean): OrderExtras<P> {
  const f = o.freight;
  return {
    carClass: o.carClass,
    stops: o.stops.map((st) => place(st.cityId, st.address, st.details)),
    comment: o.comment,
    options: o.options.map((x) => ({ ...x })),
    luggageCount: o.luggageCount,
    forOther: o.forOtherName ? { name: accepted ? o.forOtherName : o.forOtherName.split(" ")[0] } : null,
    contactMode: o.options.some((x) => x.kind === "text_only") ? "text" : "call",
    freight: f
      ? {
          ...f,
          body: { ...f.body },
          sender: accepted ? { ...f.sender } : { name: f.sender.name.split(" ")[0], phoneMasked: "" },
          receiver: accepted ? { ...f.receiver } : { name: f.receiver.name.split(" ")[0], phoneMasked: "" },
        }
      : null,
  };
}

function toWhen(w: WhenRecord): TripWhen {
  return { date: isoDate(w.dayStart), dayOffset: dayOffsetOf(w.dayStart), dayStart: w.dayStart, time: { ...w.time } };
}

function earningsOf(s: DriverState, price: number) {
  const pct = commissionPctNow(s);
  return { net: price - Math.round((price * pct) / 100), commissionPct: pct };
}

function steps(stage: TripStage): TripStep[] {
  const idx = STAGES.indexOf(stage);
  return STAGES.map((st, i) => ({ stage: st, state: i < idx ? "done" : i === idx ? "active" : "upcoming" }));
}

/** A trip belongs to the day it finished (when its earnings landed). */
function endedAt(t: TripRecord) {
  return t.timeline[t.timeline.length - 1].at;
}

function toHistoryItem(t: TripRecord): HistoryItem {
  return {
    id: t.id,
    createdAt: t.createdAt,
    from: cityRef(t.fromCityId),
    to: cityRef(t.toCityId),
    passengerName: passengerInfo(t.passengerId).name,
    earnings: t.net,
    payment: t.payment,
    ratingReceived: t.ratingReceived,
    status: t.status,
    kind: t.kind,
  };
}

function inRange(ts: number, range: "all" | "today" | "week" | "month") {
  const now = Date.now();
  if (range === "today") return ts >= startOfToday();
  if (range === "week") return ts >= now - 7 * 86_400_000;
  if (range === "month") return ts >= now - 30 * 86_400_000;
  return true;
}

// ---------- directions (Yo'nalishlarim) ----------

function dirId(from: string, to: string) {
  return `${from}-${to}`;
}

/** Every direction the driver serves: A→B, plus B→A when "both ways" is on. */
function directionsOf(s: DriverState): Direction[] {
  const out: Direction[] = [];
  for (const r of s.routes) {
    out.push({ id: dirId(r.a, r.b), from: cityRef(r.a), to: cityRef(r.b) });
    if (r.bothWays) out.push({ id: dirId(r.b, r.a), from: cityRef(r.b), to: cityRef(r.a) });
  }
  return out;
}

function routesPage(s: DriverState): RoutesPage {
  return {
    routes: s.routes.map((r) => ({ id: r.id, a: cityRef(r.a), b: cityRef(r.b), bothWays: r.bothWays })),
    cities: CITIES.map((c) => ({ id: c.id, name: c.name })),
  };
}

// ---------- capabilities ----------

function capsOf(s: DriverState): CapabilitiesInput {
  s.capabilities ??= { ...DEFAULT_CAPABILITIES, childSeatAges: [...DEFAULT_CAPABILITIES.childSeatAges] };
  return s.capabilities;
}

function toCapabilities(s: DriverState): DriverCapabilities {
  const c = capsOf(s);
  return {
    childSeat: c.childSeat,
    childSeatAges: [...c.childSeatAges],
    ageGroups: [...CHILD_SEAT_AGES],
    pets: c.pets,
    bigLuggage: c.bigLuggage,
    carModel: s.profile.car.model,
    carClass: carClassFor(s.profile.car.model),
    cargoBody: { ...cargoBodyFor(s.profile.car.model) },
  };
}

/**
 * Age groups and the child-seat switch stay consistent: turning the seat on
 * with no group picks 1–4 (the most common seat); clearing the last group
 * turns the seat off. Groups are kept in display order.
 */
function normalizeCapabilities(prev: CapabilitiesInput, input: CapabilitiesInput): CapabilitiesInput {
  let ages = CHILD_SEAT_AGES.filter((a) => input.childSeatAges.includes(a));
  let childSeat = !!input.childSeat;
  if (childSeat && !ages.length) {
    if (prev.childSeat) childSeat = false; // the last group was just cleared
    else ages = ["toddler"];
  }
  return { childSeat, childSeatAges: ages, pets: !!input.pets, bigLuggage: !!input.bigLuggage };
}

/** A request reaches the driver only if their car can serve it (Imkoniyatlarim). */
function capsAllow(s: DriverState, r: RequestRecord) {
  const c = capsOf(s);
  if (r.carClass !== carClassFor(s.profile.car.model)) return false;
  return r.options.every((o) =>
    o.kind === "child_seat" ? c.childSeat && c.childSeatAges.includes(o.ageGroup) : o.kind === "pet" ? c.pets : o.kind === "big_luggage" ? c.bigLuggage : true
  );
}

// ---------- the request market ----------

function timePassed(r: RequestRecord, now: number) {
  const t = r.when.time;
  if (t.kind === "exact") return t.at < now - 30 * 60_000;
  if (t.kind === "interval") return t.to < now;
  return r.when.dayStart + DAY <= now;
}

function isTaken(r: RequestRecord, now: number) {
  return r.takenAt != null && r.takenAt <= now;
}

/** Which requests this driver sees: their directions, their car, not rejected, not theirs already. */
function isVisible(s: DriverState, r: RequestRecord, now: number) {
  if (r.takenAt != null && now - r.takenAt > TAKEN_LINGER_MS) return false;
  if (timePassed(r, now) || s.rejectedIds.includes(r.id)) return false;
  if (s.bookings.some((b) => b.requestId === r.id)) return false;
  if (!directionsOf(s).some((d) => d.id === dirId(r.fromCityId, r.toCityId))) return false;
  return capsAllow(s, r);
}

function pendingAccepts(s: DriverState, exceptReviewId?: string) {
  return s.reviews.filter((rv) => rv.kind === "request_accept" && rv.status === "pending" && rv.id !== exceptReviewId);
}

/** Seats taken on one trip (same day + direction), counting accepts still under review. */
function seatsUsed(s: DriverState, dayStart: number, directionId: string, exceptReviewId?: string) {
  const booked = s.bookings
    .filter((b) => b.when.dayStart === dayStart && dirId(b.fromCityId, b.toCityId) === directionId)
    .reduce((n, b) => n + b.seats, 0);
  const held = pendingAccepts(s, exceptReviewId)
    .map((rv) => s.requests.find((r) => r.id === rv.payload?.requestId))
    .filter((r): r is RequestRecord => !!r && r.when.dayStart === dayStart && dirId(r.fromCityId, r.toCityId) === directionId)
    .reduce((n, r) => n + r.seats, 0);
  return booked + held;
}

function acceptBlockFor(s: DriverState, r: RequestRecord, exceptReviewId?: string): AcceptBlock | null {
  if (debtState(s).level === "blocked") return { reasonKey: "accept.block.debt", action: "wallet" };
  if (r.kind === "passengers") {
    const free = SEATS_TOTAL - seatsUsed(s, r.when.dayStart, dirId(r.fromCityId, r.toCityId), exceptReviewId);
    if (r.wholeCar && free < SEATS_TOTAL) return { reasonKey: "accept.block.wholeCar" };
    if (free < r.seats) return { reasonKey: "accept.block.seats", params: { free: Math.max(0, free) } };
  }
  return null;
}

function toRequest(s: DriverState, r: RequestRecord, now: number): RideRequest {
  const pending = pendingAccepts(s).some((rv) => rv.payload?.requestId === r.id);
  return {
    ...extras(r, offerPlace, false),
    id: r.id,
    directionId: dirId(r.fromCityId, r.toCityId),
    pickup: offerPlace(r.fromCityId, r.pickupAddr, r.pickupDetails),
    dropoff: offerPlace(r.toCityId, r.dropoffAddr, r.dropoffDetails),
    when: toWhen(r.when),
    kind: r.kind,
    seats: r.seats,
    wholeCar: r.wholeCar,
    cargo: r.cargo,
    price: r.price,
    earnings: earningsOf(s, r.price),
    payment: r.payment,
    pickupDistanceKm: r.pickupDistanceKm,
    distanceKm: r.distanceKm,
    durationMin: r.durationMin,
    postedAt: r.postedAt,
    status: isTaken(r, now) ? "taken" : "open",
    // While this driver's own accept is under review the card shows progress, not a block.
    acceptBlock: pending ? null : acceptBlockFor(s, r),
  };
}

function flatDetails(withIntercom: boolean): DetailsRecord {
  const apartment = String(rand.int(4, 96));
  return {
    entrance: String(rand.int(1, 6)),
    floor: String(rand.int(1, 9)),
    apartment,
    intercom: withIntercom ? `${apartment}#${rand.int(1000, 9999)}` : undefined,
  };
}

const round = (ms: number, step: number) => Math.ceil(ms / step) * step;

/** A future time on that day: exact, a 2–3 h window, or "Istagan paytda". Rolls to the next day when today is over. */
function makeWhen(dayOffset: number, now: number): WhenRecord {
  const dayStart = dayStartAt(dayOffset);
  const earliest = Math.max(now + 45 * 60_000, dayStart + 6 * 3_600_000);
  if (earliest > dayStart + 22.5 * 3_600_000) return makeWhen(dayOffset + 1, now);
  const latest = dayStart + 23 * 3_600_000;
  const pick = () => round(earliest + Math.random() * (latest - earliest), 15 * 60_000);
  const roll = rand.float(0, 1, 2);
  if (roll < 0.5) return { dayStart, time: { kind: "exact", at: pick() } };
  if (roll < 0.8) {
    const from = round(pick(), 30 * 60_000);
    return { dayStart, time: { kind: "interval", from, to: Math.min(from + rand.int(2, 3) * 3_600_000, dayStart + 23.5 * 3_600_000) } };
  }
  return { dayStart, time: { kind: "any" } };
}

/** Options only from what the driver's car offers (plus the universal ones). */
function passengerOptions(s: DriverState, full: boolean): OrderOption[] {
  const c = capsOf(s);
  const out: OrderOption[] = [];
  if (c.childSeat && c.childSeatAges.length && (full || rand.bool(0.15))) out.push({ kind: "child_seat", ageGroup: full ? c.childSeatAges[0] : rand.pick(c.childSeatAges) });
  if (c.pets && (full || rand.bool(0.1))) out.push({ kind: "pet" });
  if (c.bigLuggage && (full || rand.bool(0.2))) out.push({ kind: "big_luggage" });
  if (full || rand.bool(0.05)) out.push({ kind: "wheelchair" });
  if (full || rand.bool(0.08)) out.push({ kind: "text_only" });
  return out;
}

type MakeOpts = { variant?: TestOrderVariant; dayOffset?: number; direction?: Direction; postedAt?: number; seats?: number; neverTaken?: boolean };

function makeRequest(s: DriverState, opts: MakeOpts = {}): RequestRecord | null {
  const dirs = directionsOf(s);
  if (!dirs.length) return null;
  const variant = opts.variant ?? "random";
  const full = variant === "full";
  const now = Date.now();
  const dir = opts.direction ?? rand.pick(dirs);
  const from = dir.from.id;
  const to = dir.to.id;
  const distanceKm = roadDistanceKm(from, to);
  const kind: OrderKind = full ? "passengers" : variant === "cargo" || rand.bool(0.2) ? "delivery" : "passengers";
  const wholeCar = kind === "passengers" && !full && opts.seats == null && rand.bool(0.12);
  const seats = kind === "delivery" ? 0 : wholeCar ? SEATS_TOTAL : opts.seats ?? (full ? 2 : rand.int(1, 3));
  const seatIds = ["front", "back-left", "back-mid", "back-right"].slice(0, Math.max(1, seats));
  const price = computePrice(distanceKm, kind === "delivery" || wholeCar ? "car" : "seat", seatIds);
  const passengerId = rand.pick(passengers).id;
  const dropoffAddr = rand.pick(ADDR[to] ?? ["Markaz"]);
  const stopAddr = (ADDR[to] ?? []).filter((a) => a !== dropoffAddr);
  const others = passengers.filter((p) => p.id !== passengerId);
  const dayOffset = opts.dayOffset ?? (rand.bool(0.55) ? 0 : rand.bool(0.75) ? 1 : 2);
  const postedAt = opts.postedAt ?? now;
  const base = {
    id: genId("req"),
    fromCityId: from,
    toCityId: to,
    pickupAddr: rand.pick(ADDR[from] ?? ["Markaz"]),
    dropoffAddr,
    carClass: carClassFor(s.profile.car.model),
    distanceKm,
    durationMin: Math.round((distanceKm / 75) * 60),
    pickupDistanceKm: rand.float(0.8, 12, 1),
    price,
    passengerId,
    kind,
    seats,
    wholeCar,
    payment: rand.bool(0.6) ? ("cash" as const) : ("card" as const),
    when: makeWhen(dayOffset, now),
    postedAt,
    // About a quarter of requests get taken by another driver a few minutes in.
    takenAt: variant === "random" && !opts.neverTaken && rand.bool(0.25) ? postedAt + rand.int(3, 12) * 60_000 : null,
  };
  if (kind === "passengers") {
    return {
      ...base,
      pickupDetails: full || rand.bool(0.6) ? flatDetails(full || rand.bool(0.7)) : undefined,
      stops: (full || rand.bool(0.2)) && stopAddr.length ? [{ cityId: to, address: rand.pick(stopAddr) }] : [],
      comment: full ? "Bolam bilan chiqaman, 5 daqiqa kutib turing, iltimos." : rand.bool(0.4) ? rand.pick(COMMENTS) : null,
      options: passengerOptions(s, full),
      luggageCount: full ? 2 : rand.int(0, 3),
      forOtherName: full || rand.bool(0.15) ? rand.pick(others).name : null,
      freight: null,
    };
  }
  const demo = variant === "cargo";
  const sender = demo ? rand.pick(others) : passengers.find((p) => p.id === passengerId) ?? others[0];
  const receiver = rand.pick(others.filter((p) => p.id !== sender.id));
  const hourly = demo || rand.bool(0.3);
  const stops: StopRecord[] = (demo || rand.bool(0.3)) && stopAddr.length ? [{ cityId: to, address: rand.pick(stopAddr), details: flatDetails(false) }] : [];
  return {
    ...base,
    cargo: demo ? { labelKey: "cargo.box", weightKg: 40 } : rand.pick([{ labelKey: "cargo.box", weightKg: 8 }, { labelKey: "cargo.documents", weightKg: 1 }, { labelKey: "cargo.bags", weightKg: 15 }]),
    pickupDetails: flatDetails(demo || rand.bool(0.5)),
    dropoffDetails: demo || rand.bool(0.5) ? flatDetails(false) : undefined,
    stops,
    comment: demo ? "Qutilarda idish-tovoq bor, ehtiyot bo'ling. Lift ishlamaydi." : rand.bool(0.3) ? "Qutilar og'ir emas, lekin sinadigan narsalar bor." : null,
    options: [],
    luggageCount: 0,
    forOtherName: null,
    freight: {
      tab: demo ? "kargo" : rand.pick(["dostavka", "kargo"] as const),
      body: cargoBodyFor(s.profile.car.model),
      loaders: demo ? 2 : rand.int(0, 2),
      billing: hourly ? { mode: "hourly", hours: demo ? 3 : rand.int(2, 4) } : { mode: "route" },
      sender: { name: sender.name, phoneMasked: passengerInfo(sender.id).phoneMasked },
      receiver: { name: receiver.name, phoneMasked: passengerInfo(receiver.id).phoneMasked },
      rideAlong: demo || rand.bool(0.3),
    },
  };
}

function scheduleNext(s: DriverState) {
  s.nextRequestAt = Date.now() + REQUEST_EVERY_MS[0] + Math.random() * (REQUEST_EVERY_MS[1] - REQUEST_EVERY_MS[0]);
}

/** A fresh request lands: banner + bell entry, unless the driver muted new orders. */
function emitRequest(s: DriverState, opts: MakeOpts = {}): RequestRecord | null {
  const r = makeRequest(s, opts);
  if (!r) return null;
  s.requests.unshift(r);
  const now = Date.now();
  if (isVisible(s, r, now) && s.prefs.master && s.prefs.newOrders) {
    const alert: RequestAlert = {
      id: genId("alr"),
      requestId: r.id,
      from: cityName(r.fromCityId),
      to: cityName(r.toCityId),
      kind: r.kind,
      seats: r.seats,
      wholeCar: r.wholeCar,
      price: r.price,
      dayOffset: dayOffsetOf(r.when.dayStart),
      date: isoDate(r.when.dayStart),
    };
    s.alerts = [alert, ...s.alerts].slice(0, 5);
    pushNotification({
      kind: "order",
      titleKey: "notif.request.title",
      bodyKey: r.kind === "delivery" ? "notif.request.bodyCargo" : r.wholeCar ? "notif.request.bodyCar" : "notif.request.body",
      params: { from: alert.from, to: alert.to, seats: r.seats, price: groupDigits(r.price) },
    });
  }
  return r;
}

/**
 * Keeps the market moving: drops expired/taken requests, seeds a first batch,
 * and emits one new request every 20–40 s (never a backlog after a pause).
 */
function tickMarket(s: DriverState) {
  if (s.session.stage !== "active" || !s.routes.length) return;
  const now = Date.now();
  const before = s.requests.length;
  s.requests = s.requests
    .filter((r) => !(r.takenAt != null && now - r.takenAt > TAKEN_LINGER_MS) && !timePassed(r, now))
    .filter((r) => !s.bookings.some((b) => b.requestId === r.id))
    .slice(0, MAX_MARKET);
  let changed = s.requests.length !== before;
  if (s.nextRequestAt == null) {
    for (let i = 0; i < 12; i++) {
      const r = makeRequest(s, { postedAt: now - rand.int(2, 110) * 60_000, dayOffset: i < 8 ? 0 : 1, neverTaken: true });
      if (!r) continue;
      // Some of the waiting requests get taken by other drivers while the driver watches.
      if (rand.bool(0.25)) r.takenAt = now + rand.int(2, 10) * 60_000;
      s.requests.push(r);
    }
    s.requests.sort((a, b) => b.postedAt - a.postedAt);
    s.feedSeenAt = now;
    scheduleNext(s);
    changed = true;
  } else if (now >= s.nextRequestAt) {
    emitRequest(s);
    scheduleNext(s);
    changed = true;
  }
  if (changed) persist();
}

function resolveFeedDate(date: string): number {
  if (date === "today") return dayStartAt(0);
  if (date === "tomorrow") return dayStartAt(1);
  for (let i = 0; i < FEED_DAYS; i++) if (isoDate(dayStartAt(i)) === date) return dayStartAt(i);
  return dayStartAt(0);
}

function feedPage(s: DriverState, q: FeedQuery): FeedPage {
  const now = Date.now();
  const dayStart = resolveFeedDate(q.date);
  const dirs = directionsOf(s);
  const items = s.requests
    .filter((r) => isVisible(s, r, now))
    .filter((r) => r.when.dayStart === dayStart)
    .filter((r) => q.direction === "all" || dirId(r.fromCityId, r.toCityId) === q.direction)
    .filter((r) => q.type === "all" || r.kind === q.type)
    .sort((a, b) => b.postedAt - a.postedAt)
    .map((r) => toRequest(s, r, now));
  // Seat summary for the trip in focus: the chosen direction, or the fullest one that day.
  let direction = dirs.find((d) => d.id === q.direction) ?? null;
  if (!direction) {
    const used = dirs.map((d) => ({ d, n: seatsUsed(s, dayStart, d.id) })).sort((a, b) => b.n - a.n);
    direction = used[0] && used[0].n > 0 ? used[0].d : null;
  }
  const free = SEATS_TOTAL - (direction ? seatsUsed(s, dayStart, direction.id) : 0);
  return {
    items,
    seats: { free: Math.max(0, free), total: SEATS_TOTAL, direction, when: { date: isoDate(dayStart), dayOffset: dayOffsetOf(dayStart), dayStart } },
    directions: dirs,
    dates: Array.from({ length: FEED_DAYS }, (_, i) => ({ date: isoDate(dayStartAt(i)), dayOffset: i, dayStart: dayStartAt(i) })),
  };
}

// ---------- bookings (accepted requests) ----------

function toBooking(s: DriverState, b: BookingRecord): Booking {
  return {
    ...extras(b, tripPlace, true),
    id: b.id,
    directionId: dirId(b.fromCityId, b.toCityId),
    stage: b.stage,
    steps: steps(b.stage),
    nextAction: b.stage === "to_pickup" ? "arrived" : b.stage === "waiting" ? "start" : "finish",
    pendingReviewId: b.pendingReviewId,
    passenger: passengerInfo(b.passengerId),
    pickup: tripPlace(b.fromCityId, b.pickupAddr, b.pickupDetails),
    dropoff: tripPlace(b.toCityId, b.dropoffAddr, b.dropoffDetails),
    when: toWhen(b.when),
    kind: b.kind,
    seats: b.seats,
    wholeCar: b.wholeCar,
    cargo: b.cargo,
    price: b.price,
    earnings: earningsOf(s, b.price),
    payment: b.payment,
    acceptedAt: b.acceptedAt,
  };
}

function bookingFrom(r: RequestRecord, now: number): BookingRecord {
  return { ...r, id: genId("bkg"), requestId: r.id, stage: "to_pickup", stageStartedAt: now, acceptedAt: now, pendingReviewId: null, timeline: [{ stage: "accepted", at: now }] };
}

function startOf(b: BookingRecord) {
  const t = b.when.time;
  return t.kind === "exact" ? t.at : t.kind === "interval" ? t.from : b.when.dayStart + 23 * 3_600_000;
}

function acceptedPage(s: DriverState): AcceptedPage {
  const days = new Map<number, BookingDay>();
  const sorted = [...s.bookings].sort((a, b) => a.when.dayStart - b.when.dayStart || startOf(a) - startOf(b));
  for (const b of sorted) {
    let day = days.get(b.when.dayStart);
    if (!day) {
      day = { date: isoDate(b.when.dayStart), dayOffset: dayOffsetOf(b.when.dayStart), dayStart: b.when.dayStart, trips: [] };
      days.set(b.when.dayStart, day);
    }
    const id = dirId(b.fromCityId, b.toCityId);
    let trip = day.trips.find((tr) => tr.direction.id === id);
    if (!trip) {
      trip = { direction: { id, from: cityRef(b.fromCityId), to: cityRef(b.toCityId) }, seats: { used: seatsUsed(s, b.when.dayStart, id), total: SEATS_TOTAL }, bookings: [] };
      day.trips.push(trip);
    }
    trip.bookings.push(toBooking(s, b));
  }
  return { days: [...days.values()], count: s.bookings.length };
}

function tripRecordOf(b: BookingRecord, patch: Partial<TripRecord>): TripRecord {
  return {
    id: b.id, createdAt: b.acceptedAt, fromCityId: b.fromCityId, toCityId: b.toCityId, pickupAddr: b.pickupAddr,
    dropoffAddr: b.dropoffAddr, distanceKm: b.distanceKm, durationMin: b.durationMin, passengerId: b.passengerId,
    kind: b.kind, passengers: b.kind === "passengers" ? b.seats : undefined, cargo: b.cargo, payment: b.payment,
    gross: 0, commissionPct: 0, commission: 0, bonusDiscount: 0, net: 0, ratingReceived: null, status: "completed",
    timeline: b.timeline, ...patch,
  };
}

function finishBooking(s: DriverState, b: BookingRecord): TripSummary {
  const pct = commissionPctNow(s);
  const commission = Math.round((b.price * pct) / 100);
  const baseCommission = Math.round((b.price * BASE_COMMISSION_PCT) / 100);
  const rating = rand.bool(0.8) ? 5 : 4;
  const record = tripRecordOf(b, {
    gross: b.price, commissionPct: pct, commission, bonusDiscount: baseCommission - commission, net: b.price - commission,
    ratingReceived: rating, status: "completed", timeline: [...b.timeline, { stage: "completed", at: Date.now() }],
  });
  s.trips.unshift(record);
  for (const row of ledgerFor(record)) appendLedger(row.type, row.amount, row.descKey, row.descParams);
  // Some passengers leave "choy puli" in the app; it lands in the wallet as its own row.
  if (rand.bool(0.35)) appendLedger("tip", rand.pick(TIP_AMOUNTS), "ledger.desc.tip", { route: `${cityName(b.fromCityId)} – ${cityName(b.toCityId)}` });
  const summary: TripSummary = {
    tripId: b.id,
    gross: b.price,
    commissionPct: pct,
    baseCommissionPct: BASE_COMMISSION_PCT,
    commission,
    baseCommission,
    commissionWaived: pct < BASE_COMMISSION_PCT,
    net: record.net,
    ratingReceived: rating,
    payment: b.payment,
  };
  s.summaries = { ...Object.fromEntries(Object.entries(s.summaries).slice(-4)), [b.id]: summary };
  s.bookings = s.bookings.filter((x) => x.id !== b.id);
  return summary;
}

// ---------- chat ----------

function chatOf(b: BookingRecord) {
  if (!b.chat) {
    const textOnly = b.options.some((o) => o.kind === "text_only");
    b.chat = textOnly ? [{ id: genId("msg"), from: "passenger", at: b.acceptedAt + 15_000, textKey: "chat.pax.hello" }] : [];
  }
  return b.chat;
}

function toChat(b: BookingRecord): TripChat {
  const now = Date.now();
  return {
    tripId: b.id,
    peerName: passengerInfo(b.passengerId).name,
    textOnly: b.options.some((o) => o.kind === "text_only"),
    // A scheduled reply stays hidden until its time comes.
    messages: chatOf(b).filter((m) => m.at <= now).map((m) => ({ ...m })),
    quickReplies: QUICK_REPLIES[b.stage],
    maxLength: CHAT_MAX,
  };
}

// ---------- review mechanism ----------

function submitForReview(kind: ReviewKind, payload?: Record<string, unknown>, delay: [number, number] = [2000, 4000]): ReviewRequest {
  const s = state();
  const now = Date.now();
  const req: ReviewRequest = {
    id: genId("rev"),
    kind,
    status: "pending",
    createdAt: now,
    resolvesAt: now + delay[0] + Math.random() * (delay[1] - delay[0]),
    payload,
  };
  s.reviews = [req, ...s.reviews.filter((r) => now - r.createdAt < 3_600_000)].slice(0, 40);
  persist();
  return req;
}

/**
 * Decide a due review. Most are approved; an accept is decided here:
 * first accept wins (another driver's takenAt before our tap → rejected),
 * and seats/debt are re-checked so two quick accepts can't overfill the car.
 */
function resolveReview(s: DriverState, r: ReviewRequest) {
  if (r.status !== "pending" || Date.now() < r.resolvesAt) return;
  if (r.kind === "request_accept") {
    const req = s.requests.find((x) => x.id === r.payload?.requestId);
    if (!req) {
      r.status = "rejected";
      r.resultKey = "request.gone";
    } else if (req.takenAt != null && req.takenAt <= r.createdAt) {
      r.status = "rejected";
      r.resultKey = "request.taken";
    } else {
      const block = acceptBlockFor(s, req, r.id);
      if (block) {
        r.status = "rejected";
        r.resultKey = block.action === "wallet" ? "request.debt" : "request.noSeats";
      } else r.status = "approved";
    }
    return;
  }
  r.status = "approved";
}

/** Apply a review's effect exactly once, on approval. */
function applyReview(s: DriverState, r: ReviewRequest) {
  if (r.status !== "approved" || r.applied) return;
  r.applied = true;
  const p = r.payload ?? {};
  switch (r.kind) {
    case "otp_verify":
      s.session = { stage: s.registered ? (s.routes.length ? "active" : "routes") : "personal", phone: String(p.phone ?? "") };
      if (p.phone) s.profile.phoneMasked = maskPhone(String(p.phone));
      break;
    case "driver_registration": {
      const d = s.draft;
      if (d.name) s.profile.name = d.name;
      if (d.cityId) s.profile.cityId = d.cityId;
      if (d.car) s.profile.car = d.car;
      s.profile.documents = s.profile.documents.map((doc) => ({ ...doc, status: "approved" }));
      s.profile.rating = 5;
      s.profile.ratingCount = 0;
      s.profile.memberSinceYear = new Date().getFullYear();
      s.registered = true;
      // Verified drivers pick their Yo'nalishlarim before requests start arriving.
      s.session = { ...s.session, stage: s.routes.length ? "active" : "routes" };
      pushNotification({ kind: "docs", titleKey: "notif.docs.title", bodyKey: "notif.docs.body" });
      break;
    }
    case "wallet_topup": {
      const amount = Number(p.amount);
      appendLedger("topup", amount, "ledger.desc.topup", { provider: p.provider === "click" ? "Click" : "Payme" });
      pushNotification({ kind: "wallet", titleKey: "notif.topup.title", bodyKey: "notif.topup.body", params: { amount } });
      break;
    }
    case "card_link":
      s.cards.push({ id: genId("card"), brand: rand.bool() ? "humo" : "uzcard", last4: String(rand.int(1000, 9999)), provider: p.provider === "click" ? "click" : "payme" });
      break;
    case "request_accept": {
      const req = s.requests.find((x) => x.id === p.requestId);
      if (!req) break;
      s.bookings.push(bookingFrom(req, Date.now()));
      s.requests = s.requests.filter((x) => x.id !== req.id);
      break;
    }
    case "trip_step": {
      const b = s.bookings.find((x) => x.id === p.bookingId);
      if (!b) break;
      b.pendingReviewId = null;
      const now = Date.now();
      if (b.stage === "to_pickup") {
        b.stage = "waiting";
        b.timeline.push({ stage: "arrived", at: now });
      } else if (b.stage === "waiting") {
        b.stage = "in_progress";
        b.timeline.push({ stage: "started", at: now });
      } else {
        finishBooking(s, b);
        break;
      }
      b.stageStartedAt = now;
      break;
    }
    case "profile_change":
      if (typeof p.value === "string" && p.value.trim()) {
        const v = p.value.trim();
        if (p.field === "name") s.profile.name = v;
        if (p.field === "phone") s.profile.phoneMasked = maskPhone(v);
        if (p.field === "car") s.profile.car = { ...s.profile.car, model: v };
      }
      break;
    case "help_request": {
      const h = s.help.find((x) => x.id === p.helpId);
      if (h) h.status = "resolved";
      break;
    }
  }
}

/** Decide and apply every review that is due, even if no screen is polling it. */
function settleReviews(s: DriverState) {
  let changed = false;
  for (const r of s.reviews) {
    if (r.status === "pending" && Date.now() >= r.resolvesAt) {
      resolveReview(s, r);
      changed = true;
    }
    if (r.status === "approved" && !r.applied) {
      applyReview(s, r);
      changed = true;
    }
  }
  if (changed) persist();
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-9);
  return `+998 ${digits.slice(0, 2)} *** ** ${digits.slice(-2)}`;
}

function requireActive(s: DriverState) {
  if (s.session.stage !== "active") throw new ApiError("NOT_SIGNED_IN");
}

function findBooking(s: DriverState, id: string) {
  const b = s.bookings.find((x) => x.id === id);
  if (!b) throw new ApiError("TRIP_NOT_FOUND");
  return b;
}

// ---------- adapter ----------

const noop = () => {};

export const mockAdapter: ApiAdapter = {
  otpLength: { min: 4, max: 4 },
  capabilities: {
    routes: true,
    rejectRequest: true,
    feedFilters: true,
    seatSummary: true,
    arrivedStep: true,
    cancelBooking: true,
    tripChat: true,
    tripSummary: true,
    history: true,
    historyFilters: true,
    bonus: true,
    help: true,
    driverCapabilities: true,
    profileChangePhone: true,
    profileChangeCar: true,
    requestAlerts: true,
    ledgerFilters: true,
    notificationCategories: true,
    // Sample data has no server to report GPS to.
    locationReporting: false,
  },
  subscribe: () => noop,
  onSessionEnd: () => noop,
  reportLocation: () => Promise.resolve(),
  // Simulated picker: no real file, a local name "uploads" in under a second.
  uploadDocument: (slot) =>
    withLatency(() => {
      const name = `${slot === "license" ? "guvohnoma" : slot === "registration" ? "texpasport" : "selfi"}_${Math.floor(1000 + Math.random() * 9000)}.jpg`;
      return { ref: name, name };
    }, { minMs: 500, maxMs: 800, noFail: true }),

  getSession: () => withLatency(() => {
    const s0 = state();
    settleReviews(s0);
    return ({ ...s0.session });
  }, { noFail: true }),

  getRegistrationOptions: () =>
    withLatency(() => ({
      cities: CITIES.map((c) => ({ id: c.id, name: c.name })),
      carModels: CAR_MODELS,
      carColors: CAR_COLORS,
      years: Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i),
      platePattern: "01 A 123 BC",
    })),

  requestOtp: (phone) =>
    withLatency(() => {
      const digits = phone.replace(/\D/g, "");
      if (digits.length !== 9) throw new ApiError("PHONE_INVALID");
      return { requestId: genId("otp") + ":" + digits, testCode: TEST_OTP, resendInSec: 30 };
    }),

  verifyOtp: (requestId, code) =>
    withLatency(() => {
      if (code !== TEST_OTP) throw new ApiError("CODE_INVALID");
      return submitForReview("otp_verify", { phone: requestId.split(":")[1] ?? "" }, [900, 1400]);
    }),

  savePersonal: ({ name, cityId }) =>
    withLatency(() => {
      const s = state();
      if (name.trim().split(/\s+/).length < 2 || name.trim().length < 5) throw new ApiError("NAME_INVALID");
      if (!CITIES.some((c) => c.id === cityId)) throw new ApiError("CITY_REQUIRED");
      s.draft = { ...s.draft, name: name.trim(), cityId };
      s.session = { ...s.session, stage: "car" };
      persist();
      return { ...s.session };
    }),

  saveCar: ({ model, colorKey, plate, year }) =>
    withLatency(() => {
      const s = state();
      const normalized = plate.toUpperCase().replace(/\s+/g, " ").trim();
      // Uzbek plates: "01 A 123 BC" (private) or "01 123 ABC" (company).
      if (!model) throw new ApiError("MODEL_REQUIRED");
      if (!CAR_COLORS.some((c) => c.key === colorKey)) throw new ApiError("COLOR_REQUIRED");
      if (!/^\d{2} ([A-Z] \d{3} [A-Z]{2}|\d{3} [A-Z]{3})$/.test(normalized)) throw new ApiError("PLATE_INVALID");
      s.draft = { ...s.draft, car: { model, colorKey, plate: normalized, year } };
      s.session = { ...s.session, stage: "documents" };
      persist();
      return { ...s.session };
    }),

  submitDocuments: ({ licenseFile, registrationFile }) =>
    withLatency(() => {
      const s = state();
      if (!licenseFile || !registrationFile) throw new ApiError("DOCS_REQUIRED");
      s.profile.documents = [
        { kind: "license", status: "auto_review", fileName: licenseFile },
        { kind: "registration", status: "auto_review", fileName: registrationFile },
      ];
      const review = submitForReview("driver_registration", {}, [3000, 4000]);
      s.session = { ...s.session, stage: "review", documentsReviewId: review.id };
      persist();
      return review;
    }, { minMs: 400, maxMs: 700 }),

  logout: () =>
    withLatency(() => {
      const s = state();
      s.session = { stage: "signed_out" };
      persist();
      return { ...s.session };
    }, { noFail: true }),

  getProfile: () =>
    withLatency<DriverProfile>(() => {
      const s = state();
      settleReviews(s);
      const p = s.profile;
      const color = CAR_COLORS.find((c) => c.key === p.car.colorKey) ?? CAR_COLORS[0];
      return {
        id: p.id,
        name: p.name,
        phoneMasked: p.phoneMasked,
        avatarSeed: p.avatarSeed,
        rating: p.rating,
        ratingCount: p.ratingCount,
        totalTrips: s.trips.filter((t) => t.status === "completed").length + (s.profile.pastTrips ?? 0),
        city: cityRef(p.cityId),
        car: { model: p.car.model, color: color.key, colorHex: color.hex, plate: p.car.plate, year: p.car.year },
        documents: p.documents,
        memberSinceYear: p.memberSinceYear,
      };
    }),

  getHomeSummary: () => withLatency(() => {
    const s0 = state();
    settleReviews(s0);
    tickMarket(s0);
    return homeSummary(s0);
  }),

  // ---------- Yo'nalishlarim ----------

  getRoutes: () => withLatency(() => routesPage(state())),

  addRoute: (aCityId, bCityId) =>
    withLatency(() => {
      const s = state();
      if (!CITIES.some((c) => c.id === aCityId) || !CITIES.some((c) => c.id === bCityId)) throw new ApiError("CITY_REQUIRED");
      if (aCityId === bCityId) throw new ApiError("ROUTE_SAME_CITY");
      // A⇄B and B⇄A are the same corridor.
      if (s.routes.some((r) => (r.a === aCityId && r.b === bCityId) || (r.a === bCityId && r.b === aCityId))) throw new ApiError("ROUTE_EXISTS");
      const route = { id: genId("rt"), a: aCityId, b: bCityId, bothWays: true };
      s.routes.push(route);
      // A new corridor shouldn't start empty: a few requests already waiting there.
      if (s.nextRequestAt != null) {
        const now = Date.now();
        for (const direction of directionsOf(s).filter((d) => [route.a, route.b].includes(d.from.id) && [route.a, route.b].includes(d.to.id))) {
          for (let i = 0; i < 2; i++) {
            const r = makeRequest(s, { direction, postedAt: now - rand.int(3, 60) * 60_000, dayOffset: i });
            if (r) s.requests.push(r);
          }
        }
        s.requests.sort((x, y) => y.postedAt - x.postedAt);
      }
      persist();
      return routesPage(s);
    }, { minMs: 150, maxMs: 300 }),

  setRouteBothWays: (routeId, bothWays) =>
    withLatency(() => {
      const s = state();
      const r = s.routes.find((x) => x.id === routeId);
      if (!r) throw new ApiError("ROUTE_NOT_FOUND");
      r.bothWays = bothWays;
      persist();
      return routesPage(s);
    }, { minMs: 120, maxMs: 240 }),

  removeRoute: (routeId) =>
    withLatency(() => {
      const s = state();
      if (s.routes.length <= 1) throw new ApiError("ROUTES_MIN_ONE");
      s.routes = s.routes.filter((x) => x.id !== routeId);
      persist();
      return routesPage(s);
    }, { minMs: 120, maxMs: 240 }),

  completeRoutesSetup: () =>
    withLatency(() => {
      const s = state();
      if (!s.routes.length) throw new ApiError("ROUTES_MIN_ONE");
      if (s.session.stage === "routes") s.session = { ...s.session, stage: "active" };
      persist();
      return { ...s.session };
    }),

  // ---------- request feed ----------

  getFeed: (query) =>
    withLatency<FeedPage>(() => {
      const s = state();
      requireActive(s);
      settleReviews(s);
      tickMarket(s);
      return feedPage(s, query);
    }, { minMs: 150, maxMs: 350 }),

  markFeedSeen: () =>
    withLatency(() => {
      state().feedSeenAt = Date.now();
      persist();
    }, { noFail: true, minMs: 40, maxMs: 80 }),

  getRejectReasons: () => withLatency(() => REJECT_REASONS.map((key) => ({ key }))),

  rejectRequest: (requestId, reasonKey) =>
    withLatency(() => {
      const s = state();
      if (reasonKey && !REJECT_REASONS.includes(reasonKey)) throw new ApiError("VALUE_REQUIRED");
      // Hidden for this driver only; the request stays on the market for others.
      s.rejectedIds = [requestId, ...s.rejectedIds.filter((x) => x !== requestId)].slice(0, 200);
      persist();
    }, { minMs: 120, maxMs: 240 }),

  acceptRequest: (requestId) =>
    withLatency(() => {
      const s = state();
      requireActive(s);
      const now = Date.now();
      const r = s.requests.find((x) => x.id === requestId);
      if (!r || !isVisible(s, r, now)) throw new ApiError("REQUEST_GONE");
      const existing = pendingAccepts(s).find((rv) => rv.payload?.requestId === requestId);
      if (existing) return existing;
      const block = acceptBlockFor(s, r);
      if (block) throw new ApiError(block.action === "wallet" ? "WALLET_LIMIT" : "SEATS_FULL");
      return submitForReview("request_accept", { requestId }, [700, 1100]);
    }, { minMs: 150, maxMs: 300 }),

  takeRequestAlerts: () =>
    withLatency(() => {
      const s = state();
      tickMarket(s);
      if (!s.alerts.length) return [];
      const out = s.alerts;
      s.alerts = [];
      persist();
      return out.map((a) => ({ ...a }));
    }, { noFail: true, minMs: 40, maxMs: 90 }),

  // ---------- accepted requests ----------

  getAccepted: () =>
    withLatency(() => {
      const s = state();
      requireActive(s);
      settleReviews(s);
      return acceptedPage(s);
    }, { minMs: 120, maxMs: 260 }),

  advanceBooking: (bookingId) =>
    withLatency(() => {
      const s = state();
      const b = findBooking(s, bookingId);
      if (b.pendingReviewId) {
        const existing = s.reviews.find((r) => r.id === b.pendingReviewId);
        if (existing && existing.status === "pending") return existing;
      }
      const review = submitForReview("trip_step", { bookingId, from: b.stage }, [700, 1100]);
      b.pendingReviewId = review.id;
      persist();
      return review;
    }, { minMs: 150, maxMs: 300 }),

  getCancelReasons: () => withLatency(() => CANCEL_REASONS.map((key) => ({ key }))),

  cancelBooking: (bookingId, reasonKey) =>
    withLatency(() => {
      const s = state();
      const b = findBooking(s, bookingId);
      s.trips.unshift(tripRecordOf(b, { status: "cancelled", cancelReasonKey: reasonKey, timeline: [...b.timeline, { stage: "cancelled", at: Date.now() }] }));
      // Seats free up for that trip right away.
      s.bookings = s.bookings.filter((x) => x.id !== bookingId);
      persist();
    }),

  getTripSummary: (bookingId) =>
    withLatency(() => {
      const sum = state().summaries[bookingId];
      if (!sum) throw new ApiError("TRIP_NOT_FOUND");
      return sum;
    }, { noFail: true }),

  getTripChat: (bookingId) =>
    withLatency(() => {
      const b = state().bookings.find((x) => x.id === bookingId);
      if (!b) return null;
      const chat = toChat(b);
      persist();
      return chat;
    }, { minMs: 80, maxMs: 160 }),

  sendTripMessage: (bookingId, message) =>
    withLatency(() => {
      const b = findBooking(state(), bookingId);
      const now = Date.now();
      const chat = chatOf(b);
      if ("replyKey" in message) {
        if (!QUICK_REPLIES[b.stage].includes(message.replyKey)) throw new ApiError("VALUE_REQUIRED");
        chat.push({ id: genId("msg"), from: "driver", at: now, textKey: message.replyKey });
      } else {
        const text = message.text.trim().slice(0, CHAT_MAX);
        if (!text) throw new ApiError("VALUE_REQUIRED");
        chat.push({ id: genId("msg"), from: "driver", at: now, text });
      }
      // The passenger answers a moment later (one pending answer at a time).
      if (!chat.some((m) => m.from === "passenger" && m.at > now)) {
        const askedEntrance = "replyKey" in message && message.replyKey === "chat.quick.whichEntrance";
        chat.push({ id: genId("msg"), from: "passenger", at: now + 2500, textKey: askedEntrance ? "chat.pax.entrance" : "chat.pax.ok" });
      }
      persist();
      return toChat(b);
    }, { minMs: 150, maxMs: 300 }),

  getHistory: (filter) =>
    withLatency<HistoryPage>(() => {
      const s = state();
      const q = filter.city.trim().toLocaleLowerCase();
      const items = s.trips
        .filter((t) => inRange(endedAt(t), filter.range))
        .filter((t) => t.net >= filter.minEarnings)
        .filter((t) => !q || cityName(t.fromCityId).toLocaleLowerCase().includes(q) || cityName(t.toCityId).toLocaleLowerCase().includes(q))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(toHistoryItem);
      return { items, total: items.length, filterOptions: { minEarnings: [0, 100_000, 200_000, 300_000], ranges: ["all", "today", "week", "month"] } };
    }),

  getTripDetail: (id) =>
    withLatency<TripDetail>(() => {
      const t = state().trips.find((x) => x.id === id);
      if (!t) throw new ApiError("TRIP_NOT_FOUND");
      return {
        ...toHistoryItem(t),
        pickup: { city: cityRef(t.fromCityId), address: t.pickupAddr },
        dropoff: { city: cityRef(t.toCityId), address: t.dropoffAddr },
        distanceKm: t.distanceKm,
        durationMin: t.durationMin,
        passenger: passengerInfo(t.passengerId),
        passengers: t.passengers,
        cargo: t.cargo,
        timeline: t.timeline,
        breakdown: { base: t.gross, commission: t.commission + t.bonusDiscount, commissionPct: BASE_COMMISSION_PCT, bonusDiscount: t.bonusDiscount, net: t.net },
        cancelReasonKey: t.cancelReasonKey,
      };
    }),

  getWallet: () =>
    withLatency<WalletSummary>(() => {
      const s = state();
      settleReviews(s);
      const today = todayTrips(s);
      const earnings = today.reduce((sum, t) => sum + t.net, 0);
      const pct = commissionPctNow(s);
      return {
        balance: s.balance,
        debt: debtState(s),
        today: { earnings, trips: today.length, avgPerTrip: today.length ? Math.round(earnings / today.length) : 0 },
        commission: { pct: BASE_COMMISSION_PCT, bonusPct: pct, bonusActive: pct < BASE_COMMISSION_PCT },
        cards: [...s.cards],
      };
    }),

  getLedger: ({ type, range, page }) =>
    withLatency<LedgerPage>(() => {
      settleReviews(state());
      const rows = state().ledger.filter((e) => (type === "all" || e.type === type) && inRange(e.createdAt, range));
      const pageCount = Math.max(1, Math.ceil(rows.length / LEDGER_PAGE_SIZE));
      const p = Math.min(Math.max(1, page), pageCount);
      return { items: rows.slice(0, p * LEDGER_PAGE_SIZE), page: p, pageCount, total: rows.length };
    }),

  getTopupOptions: () =>
    withLatency<TopupOptions>(() => ({ presets: [10_000, 25_000, 50_000, 100_000], min: 5_000, max: 5_000_000, providers: ["payme", "click"] })),

  requestTopup: (amount, provider) =>
    withLatency(() => {
      if (!Number.isFinite(amount) || amount < 5_000) throw new ApiError("AMOUNT_TOO_SMALL");
      if (amount > 5_000_000) throw new ApiError("AMOUNT_TOO_LARGE");
      return submitForReview("wallet_topup", { amount, provider });
    }, { minMs: 300, maxMs: 600 }),

  linkCard: (provider) => withLatency(() => submitForReview("card_link", { provider }), { minMs: 300, maxMs: 600 }),

  getBonus: () =>
    withLatency<BonusInfo>(() => {
      const s = state();
      const wt = weekTrips(s);
      const current = levelFor(wt);
      const idx = BONUS_LEVELS.findIndex((l) => l.key === current.key);
      const next = BONUS_LEVELS[idx + 1] ?? null;
      const top = BONUS_LEVELS[BONUS_LEVELS.length - 1];
      const weekStart = Date.now() - 7 * 86_400_000;
      const saved = s.trips.filter((t) => t.createdAt >= weekStart).reduce((sum, t) => sum + t.bonusDiscount, 0);
      const cancels = s.trips.filter((t) => t.createdAt >= weekStart && t.status === "cancelled").length;
      return {
        active: current.commissionPct < BASE_COMMISSION_PCT,
        currentLevel: { ...current, position: current.tripsRequired / top.tripsRequired, reached: true },
        nextLevel: next ? { ...next, position: next.tripsRequired / top.tripsRequired, reached: false } : null,
        levels: BONUS_LEVELS.map((l) => ({ ...l, position: l.tripsRequired / top.tripsRequired, reached: wt >= l.tripsRequired })),
        weekTrips: wt,
        progressRatio: Math.min(1, wt / top.tripsRequired),
        tripsToNext: next ? next.tripsRequired - wt : 0,
        commissionPct: current.commissionPct,
        baseCommissionPct: BASE_COMMISSION_PCT,
        rules: [
          { key: "bonus.rule.trips", progress: Math.min(wt, top.tripsRequired), target: top.tripsRequired, done: wt >= top.tripsRequired, ratio: Math.min(1, wt / top.tripsRequired) },
          { key: "bonus.rule.rating", progress: s.profile.rating, target: 4.8, done: s.profile.rating >= 4.8, ratio: Math.min(1, s.profile.rating / 4.8) },
          { key: "bonus.rule.cancels", progress: cancels, target: 2, done: cancels < 2, ratio: cancels < 2 ? 1 : 0 },
        ],
        savedThisWeek: saved,
        resetsInDays: 7 - new Date().getDay() || 7,
      };
    }),

  requestProfileChange: (field, value) =>
    withLatency(() => {
      if (!value.trim()) throw new ApiError("VALUE_REQUIRED");
      return submitForReview("profile_change", { field, value });
    }),

  getNotifications: () => withLatency(() => state().notifications.map((n) => ({ ...n }))),

  markAllNotificationsRead: () =>
    withLatency(() => {
      state().notifications.forEach((n) => (n.read = true));
      persist();
    }, { noFail: true }),

  getNotificationPrefs: () => withLatency(() => ({ ...state().prefs })),

  setNotificationPrefs: (prefs) =>
    withLatency(() => {
      state().prefs = { ...prefs };
      persist();
      return { ...prefs };
    }, { minMs: 120, maxMs: 260 }),

  getHelpRequests: () => withLatency(() => {
    const s0 = state();
    settleReviews(s0);
    return s0.help.map((h) => ({ ...h }));
  }),

  submitHelpRequest: (topic, message) =>
    withLatency(() => {
      const s = state();
      const id = genId("help");
      s.help.unshift({ id, topic, message, createdAt: Date.now(), status: "in_review" });
      const r = submitForReview("help_request", { helpId: id });
      persist();
      return r;
    }),

  getCapabilities: () => withLatency(() => toCapabilities(state())),

  setCapabilities: (input) =>
    withLatency(() => {
      const s = state();
      const prev = toCapabilities(s);
      s.capabilities = normalizeCapabilities(prev, input);
      persist();
      return toCapabilities(s);
    }, { minMs: 120, maxMs: 260 }),

  getAppInfo: () => withLatency(() => ({ version: "2.0.0", build: "2026.11" }), { noFail: true }),

  getReviewStatus: (reviewId) =>
    withLatency(() => {
      const s = state();
      const r = s.reviews.find((x) => x.id === reviewId);
      if (!r) throw new ApiError("REVIEW_NOT_FOUND");
      resolveReview(s, r);
      applyReview(s, r);
      persist();
      return { ...r };
    }, { minMs: 120, maxMs: 260, noFail: true }),
};

/** Test-panel controls (sample-data mode only; not on ApiAdapter). */
export const testControls = {
  applyPreset: (preset: TestPreset) =>
    withLatency(() => {
      replaceState(presetState(preset));
    }, { noFail: true, minMs: 100, maxMs: 200 }),

  emitRequest: (variant: TestOrderVariant = "random") =>
    withLatency(() => {
      const s = state();
      requireActive(s);
      tickMarket(s);
      const r = emitRequest(s, { variant, dayOffset: 0, neverTaken: true });
      if (!r) throw new ApiError("ROUTES_MIN_ONE");
      scheduleNext(s);
      persist();
    }, { noFail: true, minMs: 80, maxMs: 120 }),

  /** Another driver takes the newest open request. */
  takeRequest: () =>
    withLatency(() => {
      const s = state();
      requireActive(s);
      tickMarket(s);
      const now = Date.now();
      // Newest open request, today's first (the feed's default view).
      const today = dayStartAt(0);
      const r = s.requests
        .filter((x) => isVisible(s, x, now) && !isTaken(x, now))
        .sort((a, b) => Number(b.when.dayStart === today) - Number(a.when.dayStart === today) || b.postedAt - a.postedAt)[0];
      if (!r) throw new ApiError("NO_REQUESTS");
      r.takenAt = now;
      persist();
    }, { noFail: true, minMs: 80, maxMs: 120 }),

  /** Fill today's seats with accepted passengers. */
  fillSeats: () =>
    withLatency(() => {
      const s = state();
      requireActive(s);
      const direction = directionsOf(s)[0];
      if (!direction) throw new ApiError("ROUTES_MIN_ONE");
      const dayStart = dayStartAt(0);
      const now = Date.now();
      // Real bookings, so the seat summary and Qabul qilinganlar agree.
      let free = SEATS_TOTAL - seatsUsed(s, dayStart, direction.id);
      while (free > 0) {
        const r = makeRequest(s, { direction, dayOffset: 0, seats: Math.min(free, rand.int(1, 2)), neverTaken: true });
        if (!r) break;
        r.when = { ...r.when, dayStart };
        s.bookings.push(bookingFrom(r, now));
        free -= r.seats;
      }
      persist();
    }, { noFail: true, minMs: 80, maxMs: 120 }),

  /** Commission rows push the wallet to the debt limit. */
  debtLimit: () =>
    withLatency(() => {
      const s = state();
      requireActive(s);
      // Through ledger rows (not a raw balance write) so balanceAfter stays true.
      if (s.balance > DEBT_LIMIT) {
        const d = directionsOf(s)[0];
        appendLedger("commission", DEBT_LIMIT - s.balance, "ledger.desc.commission", {
          pct: commissionPctNow(s),
          route: d ? `${d.from.name} – ${d.to.name}` : cityName(s.profile.cityId),
        });
      }
      persist();
    }, { noFail: true, minMs: 80, maxMs: 120 }),
};

/** Picked by the `@active-adapter` alias when VITE_DEMO_MODE=true. */
export const adapter = mockAdapter;
