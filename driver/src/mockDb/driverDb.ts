// Driver-side mock "server state". The shared seed (seed/generate.ts) stays
// byte-identical across the three apps and supplies cities, passengers and
// the driver identity; everything time-relative (today's trips, ledger,
// offers, live trip) is generated here relative to the moment of seeding so
// "today" is never empty in a demo.
import { CITIES, computePrice, generateSeed, roadDistanceKm, type Passenger } from "@/seed/generate";
import { makeRng } from "@/lib/prng";
import { readJSON, writeJSON } from "./storage";
import type {
  AddressDetails, CapabilitiesInput, Cargo, CarClass, CargoBody, ChildSeatAge, DemoPreset, Freight, OrderOption, DocumentStatus, HelpRequest, LedgerEntry, LedgerType, LinkedCard, NotificationItem,
  NotificationPrefs, OrderKind, PaymentType, ReviewRequest, Session, TimelineEvent, TripStage, TripSummary,
} from "@/api/types";

export const BASE_COMMISSION_PCT = 10;
export const DEBT_LIMIT = -50_000;
/** Debt at or beyond this share of the limit shows the "near limit" banner. */
export const DEBT_NEAR_RATIO = 0.7;
export const OFFER_COUNTDOWN_SEC = 30;
export const BONUS_LEVELS = [
  { key: "bronze", tripsRequired: 0, commissionPct: 10 },
  { key: "silver", tripsRequired: 20, commissionPct: 5 },
  { key: "gold", tripsRequired: 35, commissionPct: 0 },
] as const;

export const CAR_COLORS = [
  { key: "white", hex: "#F4F6F5" },
  { key: "silver", hex: "#C9CFCD" },
  { key: "black", hex: "#1C2420" },
  { key: "blue", hex: "#3B6FA0" },
  { key: "gray", hex: "#6B7280" },
];
export const CAR_MODELS = [
  "Chevrolet Cobalt", "Chevrolet Nexia 3", "Chevrolet Gentra", "Chevrolet Malibu 2",
  "Chevrolet Onix", "Chevrolet Tracker", "Kia K5", "Hyundai Sonata",
];

const STREETS: Record<string, string[]> = {
  tsh: ["Amir Temur ko'chasi, 15", "Chilonzor, 9-kvartal", "Yunusobod, 4-mavze", "Shota Rustaveli, 42", "Olmazor bekati"],
  smq: ["Registon ko'chasi, 3", "Universitet xiyoboni, 18", "Dahbet yo'li, 7", "Temiryo'l vokzali"],
  bxr: ["Mustaqillik ko'chasi, 21", "Labi Hovuz", "Bahouddin Naqshband, 40", "Avtovokzal"],
  and: ["Navoiy shoh ko'chasi, 12", "Bobur maydoni", "Asaka yo'li, 3"],
  nmn: ["Islom Karimov ko'chasi, 8", "Chorsu bozori", "Uychi yo'li, 14"],
  frg: ["Al-Farg'oniy ko'chasi, 5", "Markaziy bog'", "Qo'qon yo'li, 30"],
  qrs: ["Nasaf ko'chasi, 11", "Qarshi vokzali", "Mustaqillik maydoni"],
  nks: ["Doslik guzari, 6", "Nukus aeroporti", "Berdaq ko'chasi, 19"],
  xva: ["Ichan qal'a darvozasi", "Xiva avtovokzali", "Al-Xorazmiy, 2"],
};

const CARGO: Cargo[] = [
  { labelKey: "cargo.documents", weightKg: 1 },
  { labelKey: "cargo.box", weightKg: 8 },
  { labelKey: "cargo.parcel", weightKg: 3 },
  { labelKey: "cargo.bags", weightKg: 15 },
];

export type TripRecord = {
  id: string;
  createdAt: number;
  fromCityId: string;
  toCityId: string;
  pickupAddr: string;
  dropoffAddr: string;
  distanceKm: number;
  durationMin: number;
  passengerId: string;
  kind: OrderKind;
  passengers?: number;
  cargo?: Cargo;
  payment: PaymentType;
  gross: number;
  commissionPct: number;
  commission: number;
  bonusDiscount: number;
  net: number;
  ratingReceived: number | null;
  status: "completed" | "cancelled";
  cancelReasonKey?: string;
  timeline: TimelineEvent[];
};

/** Address details as stored; the adapter decides when `intercom` is revealed. */
export type DetailsRecord = AddressDetails & { intercom?: string };
export type StopRecord = { cityId: string; address: string; details?: DetailsRecord };

export type OfferRecord = {
  id: string;
  fromCityId: string;
  toCityId: string;
  pickupAddr: string;
  dropoffAddr: string;
  pickupDetails?: DetailsRecord;
  dropoffDetails?: DetailsRecord;
  carClass: CarClass;
  stops: StopRecord[];
  comment: string | null;
  options: OrderOption[];
  luggageCount: number;
  forOtherName: string | null;
  freight: Freight | null;
  distanceKm: number;
  durationMin: number;
  pickupEtaMin: number;
  price: number;
  priceMax: number;
  passengerId: string;
  kind: OrderKind;
  passengers?: number;
  cargo?: Cargo;
  payment: PaymentType;
  createdAt: number;
  expiresAt: number;
};

export type ChatRecord = { id: string; from: "driver" | "passenger"; at: number; textKey?: string; text?: string };

export type LiveTrip = OfferRecord & {
  /** Messages with the passenger; passenger replies may carry a future `at` (still "typing"). */
  chat?: ChatRecord[];
  stage: Exclude<TripStage, "completed">;
  stageStartedAt: number;
  acceptedAt: number;
  pendingReviewId: string | null;
  timeline: TimelineEvent[];
};

export type Draft = { name?: string; cityId?: string; car?: { model: string; colorKey: string; plate: string; year: number } };

export type DriverState = {
  version: 4;
  seededAt: number;
  registered: boolean;
  session: Session;
  draft: Draft;
  profile: {
    id: string;
    name: string;
    phoneMasked: string;
    avatarSeed: string;
    rating: number;
    ratingCount: number;
    cityId: string;
    car: { model: string; colorKey: string; plate: string; year: number };
    documents: { kind: "license" | "registration"; status: DocumentStatus; fileName?: string }[];
    memberSinceYear: number;
    /** Trips completed before the seeded 30-day window. */
    pastTrips?: number;
  };
  online: boolean;
  /** "Imkoniyatlarim" switches (car class and cargo body derive from the car). */
  capabilities: CapabilitiesInput;
  balance: number;
  ledger: LedgerEntry[];
  trips: TripRecord[];
  cards: LinkedCard[];
  notifications: NotificationItem[];
  prefs: NotificationPrefs;
  help: HelpRequest[];
  offer: OfferRecord | null;
  nextOfferAt: number | null;
  trip: LiveTrip | null;
  summaries: Record<string, TripSummary>;
  reviews: ReviewRequest[];
};

const KEY = "state_v3";
let cache: DriverState | null = null;

const seed = generateSeed();
export const passengers: Passenger[] = seed.passengers;
export const baseDriver = seed.drivers[0];

export function cityName(id: string): string {
  return CITIES.find((c) => c.id === id)?.name ?? id;
}
export function cityRef(id: string) {
  return { id, name: cityName(id) };
}
export function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** The class a car model drives in; it decides which orders reach the driver. */
export function carClassFor(model: string): CarClass {
  if (/Malibu|K5|Sonata/.test(model)) return "business";
  if (/Gentra|Onix|Tracker/.test(model)) return "comfort";
  return "economy";
}

export const CHILD_SEAT_AGES: ChildSeatAge[] = ["infant", "toddler", "booster"];
export const DEFAULT_CAPABILITIES: CapabilitiesInput = { childSeat: true, childSeatAges: ["toddler", "booster"], pets: false, bigLuggage: true };

/** Cargo bodies, S–3XL — the same scale the client's delivery picker uses. */
export const CARGO_BODIES: Record<string, CargoBody> = {
  S: { sizeLabel: "S", dimensionsCm: { width: 170, depth: 100, height: 90 }, maxWeightKg: 300 },
  M: { sizeLabel: "M", dimensionsCm: { width: 220, depth: 130, height: 130 }, maxWeightKg: 700 },
  L: { sizeLabel: "L", dimensionsCm: { width: 280, depth: 160, height: 50 }, maxWeightKg: 1_000 },
  XL: { sizeLabel: "XL", dimensionsCm: { width: 420, depth: 200, height: 200 }, maxWeightKg: 3_000 },
  XXL: { sizeLabel: "XXL", dimensionsCm: { width: 600, depth: 240, height: 240 }, maxWeightKg: 5_000 },
  "3XL": { sizeLabel: "3XL", dimensionsCm: { width: 840, depth: 260, height: 240 }, maxWeightKg: 8_000 },
};

/** Every model the app registers is a passenger car, which carries S-size cargo. */
export function cargoBodyFor(_model: string): CargoBody {
  return CARGO_BODIES.S;
}

/** Commission rate that applies for this many trips in the current week. */
export function levelFor(weekTrips: number) {
  let level: (typeof BONUS_LEVELS)[number] = BONUS_LEVELS[0];
  for (const l of BONUS_LEVELS) if (weekTrips >= l.tripsRequired) level = l;
  return level;
}

export function weekTrips(state: DriverState, now = Date.now()): number {
  const weekStart = now - 7 * 86_400_000;
  return state.trips.filter((t) => t.status === "completed" && t.createdAt >= weekStart).length;
}

function pickAddr(rng: ReturnType<typeof makeRng>, cityId: string) {
  return rng.pick(STREETS[cityId] ?? ["Markaz"]);
}

export function buildTrip(
  rng: ReturnType<typeof makeRng>,
  opts: { createdAt: number; fromCityId: string; commissionPct: number; cancelled?: boolean }
): TripRecord {
  const others = CITIES.filter((c) => c.id !== opts.fromCityId);
  const to = rng.pick(others);
  const distanceKm = roadDistanceKm(opts.fromCityId, to.id);
  const kind: OrderKind = rng.bool(0.22) ? "delivery" : "passengers";
  const passengersN = kind === "passengers" ? rng.int(1, 4) : undefined;
  const seatIds = ["front", "back-left", "back-mid", "back-right"].slice(0, passengersN ?? 1);
  const gross = computePrice(distanceKm, kind === "delivery" ? "car" : "seat", seatIds);
  const baseCommission = Math.round((gross * BASE_COMMISSION_PCT) / 100);
  const commission = Math.round((gross * opts.commissionPct) / 100);
  const durationMin = Math.round((distanceKm / 75) * 60);
  const p = rng.pick(passengers);
  const t0 = opts.createdAt;
  const cancelled = !!opts.cancelled;
  return {
    id: `trp_${t0.toString(36)}${rng.int(100, 999)}`,
    createdAt: t0,
    fromCityId: opts.fromCityId,
    toCityId: to.id,
    pickupAddr: pickAddr(rng, opts.fromCityId),
    dropoffAddr: pickAddr(rng, to.id),
    distanceKm,
    durationMin,
    passengerId: p.id,
    kind,
    passengers: passengersN,
    cargo: kind === "delivery" ? rng.pick(CARGO) : undefined,
    payment: rng.bool(0.6) ? "cash" : "card",
    gross: cancelled ? 0 : gross,
    commissionPct: opts.commissionPct,
    commission: cancelled ? 0 : commission,
    bonusDiscount: cancelled ? 0 : baseCommission - commission,
    net: cancelled ? 0 : gross - commission,
    ratingReceived: cancelled ? null : rng.bool(0.85) ? rng.pick([5, 5, 5, 4, 5, 4]) : null,
    status: cancelled ? "cancelled" : "completed",
    cancelReasonKey: cancelled ? "cancel.reason.passengerNoShow" : undefined,
    timeline: cancelled
      ? [
          { stage: "accepted", at: t0 },
          { stage: "cancelled", at: t0 + 9 * 60_000 },
        ]
      : [
          { stage: "accepted", at: t0 },
          { stage: "arrived", at: t0 + 12 * 60_000 },
          { stage: "started", at: t0 + 17 * 60_000 },
          { stage: "completed", at: t0 + (17 + durationMin) * 60_000 },
        ],
  };
}

/** Wallet movements for a finished trip. Cash: commission is debited. Card: fare credited, commission debited. */
export function ledgerFor(trip: TripRecord): Omit<LedgerEntry, "balanceAfter">[] {
  if (trip.status !== "completed") return [];
  const route = `${cityName(trip.fromCityId)} – ${cityName(trip.toCityId)}`;
  const at = trip.timeline[trip.timeline.length - 1].at;
  const out: Omit<LedgerEntry, "balanceAfter">[] = [];
  if (trip.payment === "card") {
    out.push({ id: `led_${trip.id}_f`, type: "trip", amount: trip.gross, createdAt: at, descKey: "ledger.desc.cardTrip", descParams: { route } });
  }
  if (trip.commission > 0) {
    out.push({
      id: `led_${trip.id}_c`, type: "commission", amount: -trip.commission, createdAt: at + 1,
      descKey: "ledger.desc.commission", descParams: { pct: trip.commissionPct, route },
    });
  }
  return out;
}

const PAYOUT_ABOVE = 250_000;
const PAYOUT_LEAVES = 50_000;

/**
 * Replays wallet rows oldest-first. Card earnings are paid out to the
 * driver's card whenever the balance gets large (as real wallets do), and
 * one final top-up/payout lands the balance exactly on `target`. For a
 * negative target the adjustment happens before today's (commission-only)
 * rows, so the debt comes from real commission entries.
 */
function runLedger(rows: Omit<LedgerEntry, "balanceAfter">[], target: number, todayStart: number, now: number): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  let bal = 60_000;
  let n = 0;
  let last = 0;
  const push = (r: Omit<LedgerEntry, "balanceAfter">) => {
    bal += r.amount;
    // Rows stay in replay order; timestamps are nudged to stay monotonic.
    last = Math.max(last + 1000, r.createdAt);
    out.push({ ...r, createdAt: last, balanceAfter: bal });
  };
  const adjust = (to: number, at: number) => {
    const diff = to - bal;
    if (diff > 0) push({ id: `led_adj_top_${n++}`, type: "topup", amount: diff, createdAt: at, descKey: "ledger.desc.topup", descParams: { provider: "Payme" } });
    if (diff < 0) push({ id: `led_adj_pay_${n++}`, type: "payout", amount: diff, createdAt: at, descKey: "ledger.desc.payout", descParams: { last4: "4417" } });
  };
  const history = rows.filter((r) => r.createdAt < todayStart);
  const today = rows.filter((r) => r.createdAt >= todayStart);
  // Keep the balance where a real driver would: pay out large card earnings,
  // top up before drifting deep into debt.
  const step = (r: Omit<LedgerEntry, "balanceAfter">, allowTopup = true) => {
    // A driver tops up before a commission would push them past the limit.
    if (allowTopup && bal + r.amount < -40_000)
      push({ id: `led_top_pre_${n++}`, type: "topup", amount: Math.ceil((60_000 - bal - r.amount) / 10_000) * 10_000, createdAt: r.createdAt - 3_600_000, descKey: "ledger.desc.topup", descParams: { provider: n % 2 ? "Click" : "Payme" } });
    push(r);
    if (bal > PAYOUT_ABOVE) push({ id: `led_pay_${n++}`, type: "payout", amount: PAYOUT_LEAVES - bal, createdAt: r.createdAt + 60_000, descKey: "ledger.desc.payout", descParams: { last4: "4417" } });
    if (allowTopup && bal < -30_000) push({ id: `led_top_auto_${n++}`, type: "topup", amount: Math.ceil((80_000 - bal) / 10_000) * 10_000, createdAt: r.createdAt + 60_000, descKey: "ledger.desc.topup", descParams: { provider: n % 2 ? "Click" : "Payme" } });
  };
  history.forEach((r) => step(r));
  if (target < 0) {
    const todaySum = today.reduce((s, r) => s + r.amount, 0);
    adjust(Math.max(0, target - todaySum), Math.max((history[history.length - 1]?.createdAt ?? 0) + 60_000, todayStart - 2 * 3_600_000));
    today.forEach(push);
  } else {
    today.forEach((r) => step(r));
    adjust(target, Math.min(now - 60_000, last + 120_000));
  }
  return out.reverse();
}

type SeedOpts = { balance?: number; weekTrips?: number; online?: boolean; registered?: boolean };

export function seedState(opts: SeedOpts = {}): DriverState {
  const now = Date.now();
  const rng = makeRng(20_261_111);
  const cityId = "tsh";
  const day = 86_400_000;
  const trips: TripRecord[] = [];

  // Today: 4 trips (the cockpit's "4 ta safar").
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sinceMidnight = now - todayStart.getTime();
  const wantWeek = opts.weekTrips ?? 14;
  const todayCount = 4;
  const todayPct = levelFor(wantWeek).commissionPct;
  for (let i = 0; i < todayCount; i++) {
    // Completions spread evenly through today so far; start = end − duration.
    const endAt = todayStart.getTime() + sinceMidnight * ((i + 1) / (todayCount + 0.5));
    const t = buildTrip(rng, { createdAt: endAt, fromCityId: rng.pick(["tsh", "tsh", "smq"]), commissionPct: todayPct });
    // In-debt presets: today's trips were cash, so only commission moved the wallet.
    if ((opts.balance ?? 0) < 0) t.payment = "cash";
    const shift = t.timeline[t.timeline.length - 1].at - endAt;
    t.createdAt -= shift;
    t.timeline = t.timeline.map((e) => ({ ...e, at: e.at - shift }));
    trips.push(t);
  }
  // Rest of this week.
  for (let i = 0; i < wantWeek - todayCount; i++) {
    const at = now - day * (1 + rng.float(0, 5.6, 2));
    trips.push(buildTrip(rng, { createdAt: at, fromCityId: rng.pick(["tsh", "smq", "bxr", "and"]), commissionPct: levelFor(Math.min(i, wantWeek)).commissionPct }));
  }
  // Older history (8–30 days ago), a couple cancelled.
  for (let i = 0; i < 22; i++) {
    const at = now - day * rng.float(7.5, 30, 2);
    trips.push(buildTrip(rng, { createdAt: at, fromCityId: rng.pick(["tsh", "smq", "nmn", "frg"]), commissionPct: 10, cancelled: i % 9 === 4 }));
  }
  trips.push(buildTrip(rng, { createdAt: now - day * 2.3, fromCityId: "tsh", commissionPct: 10, cancelled: true }));
  trips.sort((a, b) => b.createdAt - a.createdAt);

  // Ledger: trip movements + top-ups + a weekly bonus, built oldest-first so
  // balanceAfter runs forward, with an opening balance that lands on target.
  const rows: Omit<LedgerEntry, "balanceAfter">[] = trips.flatMap(ledgerFor);
  [27, 18, 9, 3].forEach((d, i) =>
    rows.push({ id: `led_top_${i}`, type: "topup", amount: [100_000, 50_000, 50_000, 25_000][i], createdAt: now - d * day, descKey: "ledger.desc.topup", descParams: { provider: i % 2 ? "Click" : "Payme" } })
  );
  rows.push({ id: "led_bonus_1", type: "bonus", amount: 25_000, createdAt: now - 8 * day, descKey: "ledger.desc.weeklyBonus" });
  rows.push({ id: "led_bonus_2", type: "bonus", amount: 15_000, createdAt: now - 20 * day, descKey: "ledger.desc.referralBonus" });
  rows.sort((a, b) => a.createdAt - b.createdAt);
  const target = opts.balance ?? 85_000;
  const ledger = runLedger(rows, target, todayStart.getTime(), now);

  const notifications: NotificationItem[] = [
    { id: "ntf_1", kind: "bonus", titleKey: "notif.bonusProgress.title", bodyKey: "notif.bonusProgress.body", params: { n: Math.max(0, 20 - wantWeek) }, createdAt: now - 40 * 60_000, read: false },
    { id: "ntf_2", kind: "wallet", titleKey: "notif.commission.title", bodyKey: "notif.commission.body", createdAt: now - 3 * 3_600_000, read: false },
    { id: "ntf_3", kind: "news", titleKey: "notif.news.title", bodyKey: "notif.news.body", createdAt: now - day * 1.2, read: true },
    { id: "ntf_4", kind: "docs", titleKey: "notif.docs.title", bodyKey: "notif.docs.body", createdAt: now - day * 12, read: true },
  ];

  const registered = opts.registered ?? true;
  if (!registered) {
    // A brand-new driver has no history, money or cards yet.
    trips.length = 0;
    ledger.length = 0;
    notifications.length = 0;
  }
  return {
    version: 4,
    seededAt: now,
    registered,
    session: registered ? { stage: "active", phone: "+998 90 *** ** 41" } : { stage: "signed_out" },
    draft: {},
    profile: {
      id: baseDriver.id,
      name: baseDriver.name,
      phoneMasked: "+998 90 *** ** 41",
      avatarSeed: baseDriver.avatarSeed,
      rating: 4.9,
      ratingCount: 312,
      cityId,
      car: { model: "Chevrolet Cobalt", colorKey: "white", plate: "01 A 777 BA", year: 2021 },
      documents: [
        { kind: "license", status: registered ? "approved" : "none" },
        { kind: "registration", status: registered ? "approved" : "none" },
      ],
      memberSinceYear: 2023,
      pastTrips: registered ? 280 : 0,
    },
    online: opts.online ?? false,
    capabilities: { ...DEFAULT_CAPABILITIES, childSeatAges: [...DEFAULT_CAPABILITIES.childSeatAges] },
    balance: registered ? ledger[0]?.balanceAfter ?? target : 0,
    ledger,
    trips,
    cards: registered ? [{ id: "card_1", brand: "uzcard", last4: "4417", provider: "payme" }] : [],
    notifications,
    prefs: { master: true, newOrders: true, payments: true, news: false, bonus: true },
    help: registered ? [{ id: "help_1", topic: "payment", createdAt: now - day * 6, status: "resolved" }] : [],
    offer: null,
    nextOfferAt: null,
    trip: null,
    summaries: {},
    reviews: [],
  };
}

export function presetState(preset: DemoPreset): DriverState {
  switch (preset) {
    case "new":
      return seedState({ registered: false });
    case "online":
      return seedState({ online: true });
    case "near_debt":
      return seedState({ online: true, balance: -42_000 });
    case "debt":
      return seedState({ online: true, balance: DEBT_LIMIT });
    case "bonus":
      return seedState({ online: true, balance: 120_000, weekTrips: 37 });
    case "offline":
      return seedState({ online: false });
  }
}

/** Re-anchor stored demo data to today by whole days, so "today" never goes stale. */
function reanchor(s: DriverState) {
  const day = 86_400_000;
  const start = (ts: number) => new Date(ts).setHours(0, 0, 0, 0);
  const days = Math.round((start(Date.now()) - start(s.seededAt)) / day);
  if (days <= 0) return;
  const shift = days * day;
  s.seededAt += shift;
  s.trips.forEach((t) => {
    t.createdAt += shift;
    t.timeline = t.timeline.map((e) => ({ ...e, at: e.at + shift }));
  });
  s.ledger.forEach((e) => (e.createdAt += shift));
  s.notifications.forEach((n) => (n.createdAt += shift));
  s.help.forEach((h) => (h.createdAt += shift));
  s.offer = null;
  s.trip = null;
}

/** v3 → v4: offers and live trips gained order details; drop any in flight. */
function upgrade(stored: { version: number } | null): DriverState | null {
  if (!stored) return null;
  if (stored.version === 4) return stored as DriverState;
  if (stored.version !== 3) return null;
  const s = stored as unknown as DriverState;
  s.version = 4;
  s.offer = null;
  s.trip = null;
  s.capabilities = { ...DEFAULT_CAPABILITIES, childSeatAges: [...DEFAULT_CAPABILITIES.childSeatAges] };
  return s;
}

export function state(): DriverState {
  if (cache) return cache;
  cache = upgrade(readJSON<{ version: number } | null>(KEY, null)) ?? seedState();
  reanchor(cache);
  persist();
  return cache;
}

export function persist() {
  if (cache) writeJSON(KEY, cache);
}

export function replaceState(next: DriverState) {
  cache = next;
  persist();
}

/** Append-only: a new row on top, balance moves with it. */
export function appendLedger(type: LedgerType, amount: number, descKey: string, descParams?: Record<string, string | number>) {
  const s = state();
  s.balance += amount;
  s.ledger.unshift({ id: genId("led"), type, amount, createdAt: Date.now(), descKey, descParams, balanceAfter: s.balance });
}

export function pushNotification(n: Omit<NotificationItem, "id" | "createdAt" | "read">) {
  state().notifications.unshift({ ...n, id: genId("ntf"), createdAt: Date.now(), read: false });
}
