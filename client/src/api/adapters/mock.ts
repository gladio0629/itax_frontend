import { db, getReviewRequest } from "@/mockDb/db";
import { withLatency, ApiError } from "@/mockDb/latency";
import { submitForReview, pollReview } from "@/lib/reviewMechanism";
import { getDemoScenarios } from "@/stores/demoStore";
import { computePrice, roadDistanceKm, DEFAULT_TARIFF, type City, type Order } from "@/seed/generate";
import { readJSON, writeJSON } from "@/mockDb/storage";
import {
  ADDRESSES,
  addressById,
  addressesForQuery,
  nearestAddress,
  savedAddresses,
  type Address,
} from "@/clientData/addresses";
import { makeRng } from "@/lib/prng";
import type { ApiAdapter } from "../adapterTypes";
import type {
  AddressDetails,
  CommentHint,
  OrderDetailsRules,
  OrderMode,
  OrderOption,
  OrderOptionId,
  RouteStop,
  ServiceType,
  CargoInput,
  DeliveryVehicle,
  DeliveryVehicleSpec,
  AccountSummary,
  BonusHistoryPage,
  BonusSource,
  BonusSummary,
  CreateOrderInput,
  HelpRequest,
  NotificationItem,
  NotificationPrefs,
  OrderExtras,
  OrderHistoryPage,
  OrderTiming,
  SchedulingRules,
  OrderWithDetails,
  OtpRequestResult,
  PassengerWalletEntry,
  Profile,
  Quote,
  QuoteInput,
  QuoteLine,
  RouteSuggestion,
  SavedAddressInfo,
  SavedCard,
  Seat,
  SeatPosition,
  UpdateOrderInput,
  WalletSummary,
} from "../types";
import { DELIVERY_VEHICLES } from "../types";

const DEMO_OTP_CODE = "0000";
// Delivery vehicles: what the picker shows and what each one costs, in one record
// so the two can't drift. Price bands (base + per km) rise strictly from Spark to
// Fura on any route. Price lives here only — the client never computes it.
const VEHICLES: Record<DeliveryVehicle, Omit<DeliveryVehicleSpec, "id"> & { base: number; perKm: number }> = {
  spark: { sizeLabel: "S", descKey: "cargo.desc.spark", dimensionsCm: { width: 170, depth: 100, height: 90 }, maxWeightKg: 300, base: 20_000, perKm: 400 },
  damas: { sizeLabel: "M", descKey: "cargo.desc.damas", dimensionsCm: { width: 220, depth: 130, height: 130 }, maxWeightKg: 700, base: 35_000, perKm: 600 },
  labo: { sizeLabel: "L", descKey: "cargo.desc.labo", dimensionsCm: { width: 280, depth: 160, height: 50 }, maxWeightKg: 1_000, base: 50_000, perKm: 800 },
  isuzu: { sizeLabel: "XL", descKey: "cargo.desc.isuzu", dimensionsCm: { width: 420, depth: 200, height: 200 }, maxWeightKg: 3_000, base: 120_000, perKm: 1_400 },
  isuzu2: { sizeLabel: "XXL", descKey: "cargo.desc.isuzu2", dimensionsCm: { width: 600, depth: 240, height: 240 }, maxWeightKg: 5_000, base: 180_000, perKm: 2_000 },
  fura: { sizeLabel: "3XL", descKey: "cargo.desc.fura", dimensionsCm: { width: 840, depth: 260, height: 240 }, maxWeightKg: 8_000, base: 350_000, perKm: 3_500 },
};
const VEHICLE_RATES = VEHICLES;
const DEFAULT_CARGO: CargoInput = { vehicle: "spark" };

/** One source for both the quote and the charged price, so they can't drift. */
function deliveryPrice(cargo: CargoInput | undefined, distanceKm: number) {
  const rate = VEHICLE_RATES[(cargo ?? DEFAULT_CARGO).vehicle] ?? VEHICLE_RATES.spark;
  const distanceFee = Math.round((rate.perKm * distanceKm) / 1000) * 1000;
  return { baseFee: rate.base, distanceFee, total: rate.base + distanceFee };
}
// ── Order details: stops, Tafsilotlar, comment, add-ons ─────────────────────
// Limits, prices and keyword matching all live here; the UI reads them.
const ORDER_DETAILS_RULES: OrderDetailsRules = {
  maxStops: 3,
  commentMaxLength: 300,
  addressFieldMaxLength: 10,
  intercomMaxLength: 16,
  addressNoteMaxLength: 200,
};
const STOP_FEE = 5_000;
const ORDER_OPTIONS: Record<ServiceType, OrderOption[]> = {
  passenger: [
    { id: "child_seat", titleKey: "option.child_seat", descKey: "option.child_seat.desc", price: 15_000 },
    { id: "big_luggage", titleKey: "option.big_luggage", descKey: "option.big_luggage.desc", price: 10_000 },
  ],
  delivery: [],
};
/** Word-start stems per add-on, uz/ru/en. Matched against whole words so
 * "bolalar" and "ребёнком" hit but a stem in the middle of a word doesn't. */
const HINT_STEMS: Record<OrderOptionId, { stems: string[]; messageKey: string }> = {
  child_seat: {
    stems: ["bola", "farzand", "chaqaloq", "ребён", "ребен", "дети", "детей", "детьми", "детск", "малыш", "child", "kid", "baby", "toddler"],
    messageKey: "hint.childSeat",
  },
  big_luggage: {
    stems: ["velosiped", "velik", "chamadon", "sumka", "bagaj", "yuk", "велосипед", "велик", "чемодан", "сумк", "багаж", "bicycle", "bike", "suitcase", "luggage", "bag"],
    messageKey: "hint.bigLuggage",
  },
};
const SAVED_DETAILS_KEY = "saved_address_details";
const SEEDED_SAVED_DETAILS: Record<string, AddressDetails> = {
  "smq-1": { entrance: "2", floor: "5", apartment: "18", intercom: "18K4927", note: "Sariq darvoza, bekat ro'parasida" },
};

function savedAddressDetails(): Record<string, AddressDetails> {
  return readJSON<Record<string, AddressDetails>>(SAVED_DETAILS_KEY, SEEDED_SAVED_DETAILS);
}

/** Trims every field, drops empty ones, enforces the lengths. Returns
 * undefined for "nothing filled in". */
function normalizeDetails(details: AddressDetails | undefined): AddressDetails | undefined {
  if (!details) return undefined;
  const r = ORDER_DETAILS_RULES;
  const limits: Record<keyof AddressDetails, number> = {
    entrance: r.addressFieldMaxLength,
    floor: r.addressFieldMaxLength,
    apartment: r.addressFieldMaxLength,
    intercom: r.intercomMaxLength,
    note: r.addressNoteMaxLength,
  };
  const out: AddressDetails = {};
  for (const key of Object.keys(limits) as (keyof AddressDetails)[]) {
    const value = (details[key] ?? "").trim();
    if (!value) continue;
    if (value.length > limits[key]) throw new ApiError("TOO_LONG", "details.error.tooLong");
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeComment(comment: string | undefined): string | undefined {
  const value = (comment ?? "").trim();
  if (value.length > ORDER_DETAILS_RULES.commentMaxLength) throw new ApiError("TOO_LONG", "comment.tooLong");
  return value || undefined;
}

function validateStopsCount(count: number) {
  if (count > ORDER_DETAILS_RULES.maxStops) throw new ApiError("TOO_MANY_STOPS", "stops.tooMany");
}

function validateOptions(serviceType: ServiceType, optionIds: OrderOptionId[] | undefined): OrderOptionId[] {
  const allowed = new Set(ORDER_OPTIONS[serviceType].map((o) => o.id));
  const ids = [...new Set(optionIds ?? [])];
  if (ids.some((id) => !allowed.has(id))) throw new ApiError("INVALID_OPTION", "order.quoteError");
  return ids;
}

type PriceInput = {
  serviceType: ServiceType;
  fromAddressId: string;
  toAddressId: string;
  stops: string[];
  mode: OrderMode;
  seatIds: string[];
  cargo?: CargoInput;
  optionIds: OrderOptionId[];
};

/** The one price for an order — quote, create and update all call this, so
 * the charged price can't drift from the quote. Lines sum to the total. */
function priceOrder(input: PriceInput) {
  validateStopsCount(input.stops.length);
  const optionIds = validateOptions(input.serviceType, input.optionIds);
  const cities = [input.fromAddressId, ...input.stops, input.toAddressId].map((id) => addressOf(id).cityId);
  const directKm = roadDistanceKm(cities[0], cities[cities.length - 1]);
  if (directKm === 0) throw new ApiError("INVALID_ROUTE", "order.quoteError");
  let routeKm = 0;
  for (let i = 1; i < cities.length; i++) routeKm += roadDistanceKm(cities[i - 1], cities[i]);
  const detourKm = Math.max(0, routeKm - directKm);

  const lines: QuoteLine[] = [];
  let detourPerKm: number;
  if (input.serviceType === "delivery") {
    const { baseFee, distanceFee } = deliveryPrice(input.cargo, directKm);
    lines.push({ key: "quote.cargoBase", amount: baseFee });
    lines.push({ key: "quote.cargoDistance", params: { km: directKm }, amount: distanceFee });
    detourPerKm = (VEHICLE_RATES[(input.cargo ?? DEFAULT_CARGO).vehicle] ?? VEHICLE_RATES.spark).perKm;
  } else {
    const fare = computePrice(directKm, input.mode, input.seatIds, DEFAULT_TARIFF);
    if (input.mode === "car") {
      lines.push({ key: "quote.carFare", amount: fare });
      detourPerKm = DEFAULT_TARIFF.perKmCar;
    } else {
      const frontSurcharge = input.seatIds.includes("front") ? DEFAULT_TARIFF.frontSeatSurcharge : 0;
      lines.push({ key: "quote.seatFare", params: { count: Math.max(input.seatIds.length, 1) }, amount: fare - frontSurcharge });
      if (frontSurcharge > 0) lines.push({ key: "quote.frontSurcharge", amount: frontSurcharge });
      detourPerKm = DEFAULT_TARIFF.perKmSeat * Math.max(input.seatIds.length, 1);
    }
  }
  input.stops.forEach((id, i) => {
    lines.push({ key: "quote.stop", params: { n: i + 1, place: addressOf(id).label }, amount: STOP_FEE });
  });
  if (detourKm > 0) {
    lines.push({ key: "quote.detour", params: { km: detourKm }, amount: Math.round((detourPerKm * detourKm) / 1000) * 1000 });
  }
  for (const option of ORDER_OPTIONS[input.serviceType]) {
    if (optionIds.includes(option.id)) lines.push({ key: `quote.option.${option.id}`, amount: option.price });
  }
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return { directKm, routeKm, lines, total, optionIds };
}

const SEAT_POSITIONS: SeatPosition[] = ["front", "back-left", "back-mid", "back-right"];
const BONUS_MIN_WITHDRAW = 50_000;
const BONUS_MONTHLY_MAX = 300_000;
const BONUS_TRIP_RATE = 0.02;
const BONUS_WITHDRAWALS_KEY = "bonus_withdrawals";
const RATING_REASONS_KEY = "rating_reasons";
const NOTIFICATION_PREFS_KEY = "notification_prefs";
const ACCOUNTS_KEY = "accounts";
const HELP_REQUESTS_KEY = "help_requests";
const ORDER_EXTRAS_KEY = "order_extras";
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { master: true, orderStatus: true, news: true, bonus: true };

function loadOrderExtras(): Record<string, OrderExtras> {
  return readJSON<Record<string, OrderExtras>>(ORDER_EXTRAS_KEY, {});
}

function saveOrderExtra(orderId: string, extras: OrderExtras) {
  const all = loadOrderExtras();
  all[orderId] = extras;
  writeJSON(ORDER_EXTRAS_KEY, all);
}

const SCHEDULING_RULES: SchedulingRules = { bookableDays: 21, maxRangeDays: 3, minRangeMinutes: 30, stepMinutes: 5 };

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Days from today (local) to an ISO date or the legacy "today"/"tomorrow". */
function dayOffset(date: string, now: Date) {
  if (date === "today") return 0;
  if (date === "tomorrow") return 1;
  const today = new Date(`${isoDay(now)}T00:00:00`);
  const chosen = new Date(`${date}T00:00:00`);
  if (Number.isNaN(chosen.getTime())) return Number.NaN;
  return Math.round((chosen.getTime() - today.getTime()) / 86_400_000);
}
function toMinutes(hhmm: string | undefined) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN;
}

/** Validation lives here, not in the UI. The picker already steers away
 * from all of these; this is the authoritative check. */
function validateTiming(timing: OrderTiming) {
  if (timing.timeMode !== "scheduled") return;
  const rules = SCHEDULING_RULES;
  const now = new Date();
  const start = dayOffset(timing.date, now);
  if (Number.isNaN(start)) throw new ApiError("INVALID_DATE", "order.timing.pastDate");
  if (start < 0) throw new ApiError("PAST_DATE", "order.timing.pastDate");
  if (start > rules.bookableDays - 1) throw new ApiError("DATE_TOO_FAR", "order.timing.tooFar");
  if (timing.dateEnd) {
    const end = dayOffset(timing.dateEnd, now);
    if (Number.isNaN(end) || end < start) throw new ApiError("INVALID_DATE_RANGE", "order.timing.invalidRange");
    if (end - start > rules.maxRangeDays) throw new ApiError("DATE_RANGE_TOO_LONG", "order.timing.rangeTooLong");
    if (end > rules.bookableDays - 1) throw new ApiError("DATE_TOO_FAR", "order.timing.tooFar");
  }
  const first = timing.timeKind === "range" ? toMinutes(timing.timeRange?.from) : toMinutes(timing.time);
  if (Number.isNaN(first)) throw new ApiError("INVALID_TIME", "order.timing.invalidRange");
  if (timing.timeKind === "range") {
    const last = toMinutes(timing.timeRange?.to);
    if (Number.isNaN(last) || last - first < rules.minRangeMinutes) {
      throw new ApiError("INVALID_TIME_RANGE", "order.timing.invalidRange");
    }
  }
  // Past check on the first day only; one step of grace so a slot that was
  // valid when picked isn't rejected because the minute ticked over.
  if (start === 0 && first < now.getHours() * 60 + now.getMinutes() - rules.stepMinutes) {
    throw new ApiError("PAST_TIME", "order.timing.pastTime");
  }
}

function loadAccounts(): AccountSummary[] {
  const stored = readJSON<AccountSummary[] | null>(ACCOUNTS_KEY, null);
  if (stored) return stored;
  const p = db.passengers().find((x) => x.id === currentPassengerId())!;
  const seeded: AccountSummary[] = [
    { id: p.id, name: p.name, phoneMasked: p.phoneMasked, avatarSeed: p.avatarSeed, active: true },
  ];
  writeJSON(ACCOUNTS_KEY, seeded);
  return seeded;
}

type BonusLedgerEntry = { id: string; sourceId: string; type: "earn" | "withdraw"; amount: number; createdAt: number };

function isSameMonth(ts: number, ref: number) {
  const a = new Date(ts);
  const b = new Date(ref);
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function bonusLedger(): BonusLedgerEntry[] {
  const passengerId = currentPassengerId();
  const now = Date.now();
  const earnedFromTrips: BonusLedgerEntry[] = db
    .orders()
    .filter((o) => o.passengerId === passengerId && o.status === "completed")
    .map((o) => ({
      id: `bns_trip_${o.id}`,
      sourceId: "trip",
      type: "earn",
      amount: Math.round((o.price * BONUS_TRIP_RATE) / 100) * 100,
      createdAt: o.createdAt,
    }));
  const seeded: BonusLedgerEntry[] = [
    { id: `bns_${passengerId}_invite1`, sourceId: "invite", type: "earn", amount: 15_000, createdAt: now - 9 * 86_400_000 },
    { id: `bns_${passengerId}_invite2`, sourceId: "invite", type: "earn", amount: 15_000, createdAt: now - 34 * 86_400_000 },
    { id: `bns_${passengerId}_rate1`, sourceId: "rate", type: "earn", amount: 3_000, createdAt: now - 4 * 86_400_000 },
  ];
  const withdrawals = readJSON<BonusLedgerEntry[]>(BONUS_WITHDRAWALS_KEY, []);
  return [...earnedFromTrips, ...seeded, ...withdrawals].sort((a, b) => b.createdAt - a.createdAt);
}

function bonusBalance(): number {
  return Math.max(0, bonusLedger().reduce((sum, e) => sum + (e.type === "earn" ? e.amount : -e.amount), 0));
}

function cityOf(id: string): City {
  const c = db.cities().find((x) => x.id === id);
  if (!c) throw new ApiError("NOT_FOUND", "Shahar topilmadi");
  return c;
}

function addressOf(id: string): Address {
  const a = addressById(id);
  if (!a) throw new ApiError("NOT_FOUND", "Manzil topilmadi");
  return a;
}

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

function currentPassengerId(): string {
  return db.passengers()[2].id; // fixed demo passenger: a stable "me"
}

const RATING_EDIT_WINDOW_MS = 7 * 86_400_000;

function toDetails(order: Order): OrderWithDetails {
  const driver = order.driverId ? db.drivers().find((d) => d.id === order.driverId) : undefined;
  const ratingEditable =
    order.status === "completed" && (!order.rating || Date.now() - order.createdAt < RATING_EDIT_WINDOW_MS);
  return {
    ...order,
    driver,
    fromCity: cityOf(order.fromCityId),
    toCity: cityOf(order.toCityId),
    ratingEditable,
    lockedReasonKey: order.status === "completed" && !ratingEditable ? "history.rating.lockedReason" : undefined,
    extras: loadOrderExtras()[order.id],
    editable: order.status === "accepted",
  };
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Pure function of time: resolves a live order's transient status. */
function resolveLiveStatus(order: Order): Order {
  if (!order.timeline) return order;
  const now = Date.now();
  const t = order.timeline;

  if (order.status === "searching" && now >= t.searchResolvesAt) {
    if (t.outcome === "no_driver") {
      order.status = "no_driver";
    } else {
      const approvedDrivers = db.drivers().filter((d) => d.documentsStatus === "approved");
      const driver = approvedDrivers[Math.floor(Math.random() * approvedDrivers.length)];
      order.driverId = driver.id;
      order.status = "accepted";
      const pickupMs = 15_000 + Math.random() * 15_000;
      t.acceptedAt = now;
      t.tripStartsAt = now + pickupMs;
      const tripMs = Math.min(60_000, Math.max(20_000, order.distanceKm * 150));
      t.tripEndsAt = t.tripStartsAt + tripMs;
    }
  } else if (order.status === "accepted" && t.tripStartsAt && now >= t.tripStartsAt) {
    order.status = "in_progress";
  } else if (order.status === "in_progress" && t.tripEndsAt && now >= t.tripEndsAt) {
    order.status = "completed";
  }
  db.updateOrder(order.id, order);
  return order;
}

function popularPairs(): { from: string; to: string }[] {
  return [
    { from: "tsh", to: "smq" },
    { from: "tsh", to: "frg" },
    { from: "tsh", to: "and" },
    { from: "smq", to: "bxr" },
    { from: "tsh", to: "nmn" },
    { from: "nks", to: "xva" },
  ];
}

function routeSuggestion(fromId: string, toId: string): RouteSuggestion {
  const distanceKm = roadDistanceKm(fromId, toId);
  return {
    fromCityId: fromId,
    toCityId: toId,
    distanceKm,
    fromPrice: computePrice(distanceKm, "seat", [], DEFAULT_TARIFF),
    label: `${cityOf(fromId).name} \u2192 ${cityOf(toId).name}`,
  };
}

export const mockAdapter: ApiAdapter = {
  getCities: () => withLatency(() => db.cities()),

  getPopularRoutes: () =>
    withLatency(() => popularPairs().map((p) => routeSuggestion(p.from, p.to))),

  getRecentRoutes: () =>
    withLatency(() => {
      const mine = db
        .orders()
        .filter((o) => o.passengerId === currentPassengerId())
        .slice(0, 8);
      const seen = new Set<string>();
      const result: RouteSuggestion[] = [];
      for (const o of mine) {
        const key = `${o.fromCityId}-${o.toCityId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(routeSuggestion(o.fromCityId, o.toCityId));
        if (result.length >= 3) break;
      }
      return result;
    }),

  getAddressSuggestions: (query: string, excludeCityId?: string) =>
    withLatency(() => addressesForQuery(query, excludeCityId), { minMs: 150, maxMs: 350 }),

  getRecentAddresses: () =>
    withLatency(() => {
      const mine = db
        .orders()
        .filter((o) => o.passengerId === currentPassengerId())
        .slice(0, 6);
      const seen = new Set<string>();
      const result: Address[] = [];
      for (const o of mine) {
        for (const cityId of [o.fromCityId, o.toCityId]) {
          if (seen.has(cityId)) continue;
          seen.add(cityId);
          const addr = ADDRESSES.find((a) => a.cityId === cityId);
          if (addr) result.push(addr);
          if (result.length >= 4) break;
        }
        if (result.length >= 4) break;
      }
      return result;
    }),

  getSavedAddresses: (fromAddressId: string) =>
    withLatency<SavedAddressInfo[]>(() => {
      const fromCityId = addressOf(fromAddressId).cityId;
      const details = savedAddressDetails();
      return savedAddresses().map((address) => {
        const distanceKm = roadDistanceKm(fromCityId, address.cityId);
        return { address, details: details[address.id], distanceKm, etaMinutes: Math.round((distanceKm / 70) * 60) };
      });
    }, { minMs: 150, maxMs: 350 }),

  reverseGeocode: (x: number, y: number, excludeCityId?: string) =>
    withLatency(() => nearestAddress(x, y, excludeCityId), { minMs: 200, maxMs: 450 }),

  getPickupEta: () =>
    withLatency(() => ({ minutes: 2 + Math.round(Math.random() * 6) }), { minMs: 150, maxMs: 300 }),

  getSeatMap: ({ fromAddressId, toAddressId }) =>
    withLatency<Seat[]>(() => {
      const distanceKm = roadDistanceKm(addressOf(fromAddressId).cityId, addressOf(toAddressId).cityId);
      const rng = makeRng(hashSeed(`${fromAddressId}|${toAddressId}`));
      const takenIdx = rng.bool(0.3) ? rng.int(1, SEAT_POSITIONS.length - 1) : -1;
      return SEAT_POSITIONS.map((position, i) => ({
        id: position,
        position,
        taken: i === takenIdx,
        price: computePrice(distanceKm, "seat", position === "front" ? ["front"] : [], DEFAULT_TARIFF),
      }));
    }, { minMs: 200, maxMs: 450 }),

  getSchedulingRules: () => withLatency<SchedulingRules>(() => ({ ...SCHEDULING_RULES }), { minMs: 100, maxMs: 250 }),

  getOrderDetailsRules: () =>
    withLatency<OrderDetailsRules>(() => ({ ...ORDER_DETAILS_RULES }), { minMs: 100, maxMs: 250 }),

  getOrderOptions: (serviceType) =>
    withLatency<OrderOption[]>(() => ORDER_OPTIONS[serviceType].map((o) => ({ ...o })), { minMs: 100, maxMs: 250 }),

  getCommentHints: ({ text, serviceType, selectedOptionIds }) =>
    withLatency<CommentHint[]>(() => {
      const words = text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      const available = ORDER_OPTIONS[serviceType].map((o) => o.id).filter((id) => !selectedOptionIds.includes(id));
      return available
        .filter((id) => words.some((w) => HINT_STEMS[id].stems.some((stem) => w.startsWith(stem))))
        .map((id) => ({ optionId: id, messageKey: HINT_STEMS[id].messageKey }));
    }, { minMs: 80, maxMs: 180 }),

  getSavedAddressDetails: (addressId) =>
    withLatency<AddressDetails | null>(() => {
      if (!savedAddresses().some((a) => a.id === addressId)) return null;
      return savedAddressDetails()[addressId] ?? null;
    }, { minMs: 80, maxMs: 200 }),

  saveAddressDetails: (addressId, details) =>
    withLatency<AddressDetails>(() => {
      addressOf(addressId);
      const normalized = normalizeDetails(details) ?? {};
      if (savedAddresses().some((a) => a.id === addressId)) {
        const all = savedAddressDetails();
        if (Object.keys(normalized).length) all[addressId] = normalized;
        else delete all[addressId];
        writeJSON(SAVED_DETAILS_KEY, all);
      }
      return normalized;
    }, { minMs: 150, maxMs: 300 }),

  getDeliveryVehicles: () =>
    withLatency<DeliveryVehicleSpec[]>(
      () =>
        DELIVERY_VEHICLES.map((id) => {
          const { sizeLabel, descKey, dimensionsCm, maxWeightKg } = VEHICLES[id];
          return { id, sizeLabel, descKey, dimensionsCm: { ...dimensionsCm }, maxWeightKg };
        }),
      { minMs: 200, maxMs: 450 }
    ),

  getQuote: (input: QuoteInput) =>
    withLatency<Quote>(() => {
      const { routeKm, lines, total } = priceOrder({
        serviceType: input.serviceType,
        fromAddressId: input.fromAddressId,
        toAddressId: input.toAddressId,
        stops: input.stops ?? [],
        mode: input.mode,
        seatIds: input.seatIds,
        cargo: input.serviceType === "delivery" ? input.cargo : undefined,
        optionIds: input.optionIds ?? [],
      });
      return {
        distanceKm: routeKm,
        lines,
        total,
        currency: "som",
        etaMinutes: 3 + Math.round(Math.random() * 6),
        durationMinutes: Math.round((routeKm / 70) * 60),
      };
    }, { minMs: 300, maxMs: 600 }),

  requestOtp: (_phone: string) =>
    withLatency<OtpRequestResult>(() => ({
      requestId: genId("otp"),
      demoCode: DEMO_OTP_CODE,
    }), { minMs: 250, maxMs: 500 }),

  verifyOtp: (_requestId: string, code: string) =>
    withLatency(() => {
      if (code !== DEMO_OTP_CODE) {
        throw new ApiError("INVALID_CODE", "Kod noto'g'ri. Qaytadan urinib ko'ring.");
      }
      return submitForReview("otp_verify", { phone: _requestId });
    }, { minMs: 200, maxMs: 400 }),

  getReviewStatus: (reviewId: string) => withLatency(() => pollReview(reviewId), { minMs: 150, maxMs: 350 }),

  createOrder: (input: CreateOrderInput) =>
    withLatency<OrderWithDetails>(() => {
      validateTiming(input.timing);
      const scenarios = getDemoScenarios();
      const fromCityId = addressOf(input.fromAddressId).cityId;
      const toCityId = addressOf(input.toAddressId).cityId;
      const cargo = input.serviceType === "delivery" ? input.cargo : undefined;
      const stops: RouteStop[] = (input.stops ?? []).map((st) => ({
        addressId: addressOf(st.addressId).id,
        details: normalizeDetails(st.details),
      }));
      const fromPointDetails = normalizeDetails(input.fromDetails);
      const toPointDetails = normalizeDetails(input.toDetails);
      const comment = normalizeComment(input.comment);
      const { routeKm: distanceKm, total: price, optionIds } = priceOrder({
        serviceType: input.serviceType,
        fromAddressId: input.fromAddressId,
        toAddressId: input.toAddressId,
        stops: stops.map((st) => st.addressId),
        mode: input.mode,
        seatIds: input.seatIds,
        cargo,
        optionIds: input.optionIds ?? [],
      });
      const now = Date.now();
      const searchMs = scenarios.noDriverFound
        ? 9_000 + Math.random() * 6_000
        : 4_000 + Math.random() * 5_000;
      const order: Order = {
        id: genId("ord"),
        passengerId: currentPassengerId(),
        driverId: null,
        fromCityId,
        toCityId,
        distanceKm,
        mode: input.mode,
        seatIds: input.seatIds,
        price,
        paymentMethod: input.paymentMethod,
        status: "searching",
        createdAt: now,
        timeline: {
          searchResolvesAt: now + searchMs,
          outcome: scenarios.noDriverFound ? "no_driver" : "accepted",
        },
      };
      db.addOrder(order);
      saveOrderExtra(order.id, {
        fromAddressId: input.fromAddressId,
        toAddressId: input.toAddressId,
        timing: input.timing,
        serviceType: input.serviceType,
        cargo,
        fromDetails: fromPointDetails,
        toDetails: toPointDetails,
        stops,
        comment,
        optionIds,
      });
      return toDetails(order);
    }, { minMs: 400, maxMs: 800 }),

  getOrder: (orderId: string) =>
    withLatency<OrderWithDetails>(() => {
      const order = db.getOrder(orderId);
      if (!order) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      resolveLiveStatus(order);
      return toDetails(order);
    }, { minMs: 150, maxMs: 400 }),

  updateOrder: (orderId: string, patch: UpdateOrderInput) =>
    withLatency<OrderWithDetails>(() => {
      const order = db.getOrder(orderId);
      if (!order) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      resolveLiveStatus(order);
      if (order.status !== "accepted") {
        throw new ApiError("LOCKED", "order.locked.notEditable");
      }
      if (patch.timing) validateTiming(patch.timing);

      const extras: OrderExtras = loadOrderExtras()[orderId] ?? {
        fromAddressId: ADDRESSES.find((a) => a.cityId === order.fromCityId)?.id ?? "",
        toAddressId: ADDRESSES.find((a) => a.cityId === order.toCityId)?.id ?? "",
        timing: { timeMode: "now" as const },
      };
      // Merge: a field missing from the patch is unchanged, not cleared — the
      // track screen's sheet only sends the fields it edits.
      const nextExtras: OrderExtras = {
        ...extras,
        fromAddressId: patch.fromAddressId ?? extras.fromAddressId,
        toAddressId: patch.toAddressId ?? extras.toAddressId,
        timing: patch.timing ?? extras.timing,
      };
      // A new address starts without the old one's Tafsilotlar.
      if (patch.fromAddressId && patch.fromAddressId !== extras.fromAddressId) nextExtras.fromDetails = undefined;
      if (patch.toAddressId && patch.toAddressId !== extras.toAddressId) nextExtras.toDetails = undefined;
      if (patch.fromDetails) nextExtras.fromDetails = normalizeDetails(patch.fromDetails);
      if (patch.toDetails) nextExtras.toDetails = normalizeDetails(patch.toDetails);
      if (patch.stops) {
        nextExtras.stops = patch.stops.map((st) => ({ addressId: addressOf(st.addressId).id, details: normalizeDetails(st.details) }));
      }
      if (patch.comment !== undefined) nextExtras.comment = normalizeComment(patch.comment);

      const mode = patch.mode ?? order.mode;
      const seatIds = patch.seatIds ?? order.seatIds;
      const paymentMethod = patch.paymentMethod ?? order.paymentMethod;
      const serviceType = nextExtras.serviceType ?? "passenger";
      const priced = priceOrder({
        serviceType,
        fromAddressId: nextExtras.fromAddressId,
        toAddressId: nextExtras.toAddressId,
        stops: (nextExtras.stops ?? []).map((st) => st.addressId),
        mode,
        seatIds,
        cargo: nextExtras.cargo,
        optionIds: patch.optionIds ?? nextExtras.optionIds ?? [],
      });
      nextExtras.optionIds = priced.optionIds;
      const fromCityId = addressOf(nextExtras.fromAddressId).cityId;
      const toCityId = addressOf(nextExtras.toAddressId).cityId;

      db.updateOrder(orderId, { fromCityId, toCityId, distanceKm: priced.routeKm, mode, seatIds, paymentMethod, price: priced.total });
      saveOrderExtra(orderId, nextExtras);
      return toDetails(db.getOrder(orderId)!);
    }, { minMs: 300, maxMs: 600 }),

  cancelOrder: (orderId: string, reason: string) =>
    withLatency<OrderWithDetails>(() => {
      db.updateOrder(orderId, { status: "cancelled", cancelReason: reason });
      return toDetails(db.getOrder(orderId)!);
    }),

  rateOrder: (orderId: string, rating: number, reasons?: string[], note?: string) =>
    withLatency<OrderWithDetails>(() => {
      const order = db.getOrder(orderId);
      if (!order) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      const editable =
        order.status === "completed" && (!order.rating || Date.now() - order.createdAt < RATING_EDIT_WINDOW_MS);
      if (!editable) throw new ApiError("LOCKED", "Bahoni tahrirlab bo'lmaydi");
      db.updateOrder(orderId, { rating });
      if (reasons) {
        const all = readJSON<Record<string, { reasons: string[]; note?: string }>>(RATING_REASONS_KEY, {});
        all[orderId] = { reasons, note };
        writeJSON(RATING_REASONS_KEY, all);
      }
      return toDetails(db.getOrder(orderId)!);
    }, { minMs: 200, maxMs: 500 }),

  getOrderHistory: (params) =>
    withLatency<OrderHistoryPage>(() => {
      let list = db
        .orders()
        .filter((o) => o.passengerId === currentPassengerId())
        .sort((a, b) => b.createdAt - a.createdAt);
      if (params?.status) list = list.filter((o) => o.status === params.status);
      const pageSize = 8;
      const cursor = params?.cursor ?? 0;
      const orders = list.slice(cursor, cursor + pageSize).map(toDetails);
      const nextCursor = cursor + pageSize < list.length ? cursor + pageSize : null;
      return { orders, nextCursor };
    }),

  getSavedCards: () => withLatency(() => readJSON<SavedCard[]>("saved_cards", [])),

  linkCard: (payload) =>
    withLatency(() => {
      // The (simulated) provider is what tokenizes a card — IZGO never
      // receives a real number, so the brand/last4 are invented here.
      const brands: SavedCard["brand"][] = ["uzcard", "humo", "visa"];
      const rng = makeRng(hashSeed(payload.label + Date.now()));
      const card: SavedCard = {
        id: genId("card"),
        label: payload.label,
        last4: String(rng.int(1000, 9999)),
        brand: rng.pick(brands),
      };
      const review = submitForReview("card_link", payload);
      const cards = readJSON<SavedCard[]>("saved_cards", []);
      cards.push(card);
      writeJSON("saved_cards", cards);
      return review;
    }, { minMs: 300, maxMs: 600 }),

  getNotifications: () =>
    withLatency(() => {
      const seeded: NotificationItem[] = [
        {
          id: "ntf_1",
          title: "Haydovchi topildi",
          body: "Jahongir Yusupov sizning tomoningizga yo'l oldi.",
          createdAt: Date.now() - 2 * 86_400_000,
          read: true,
          kind: "order",
        },
        {
          id: "ntf_2",
          title: "Promo-kod faollashtirildi",
          body: "IZGO10 kodi bilan 10% chegirma qo'llandi.",
          createdAt: Date.now() - 6 * 86_400_000,
          read: true,
          kind: "promo",
        },
        {
          id: "ntf_3",
          title: "Karta muvaffaqiyatli bog'landi",
          body: "Uzcard *4821 endi to'lov usuli sifatida mavjud.",
          createdAt: Date.now() - 10 * 86_400_000,
          read: false,
          kind: "wallet",
        },
      ];
      return readJSON<NotificationItem[]>("notifications", seeded);
    }),

  markNotificationRead: (id: string) =>
    withLatency(() => {
      const list = readJSON<NotificationItem[]>("notifications", []);
      const next = list.map((n) => (n.id === id ? { ...n, read: true } : n));
      writeJSON("notifications", next);
    }, { minMs: 100, maxMs: 200 }).then(() => undefined),

  getProfile: () =>
    withLatency<Profile>(() => {
      const p = db.passengers().find((x) => x.id === currentPassengerId())!;
      return {
        id: p.id,
        name: p.name,
        phoneMasked: p.phoneMasked,
        avatarSeed: p.avatarSeed,
        rating: p.rating,
        totalTrips: p.totalTrips,
      };
    }),

  /**
   * Passenger wallet — all balance/ledger computation lives here, never in
   * a component. Derived believably from the passenger's own card-paid
   * orders (card is the only payment method that ever touches the
   * in-app wallet — cash trips are paid directly to the driver):
   *  - a couple of seeded top-ups kick off the balance,
   *  - each completed card order debits a `trip_payment`,
   *  - each cancelled card order is paired with a `refund`,
   *  - a referral `bonus` entry rounds out the seeded history.
   * The balance never goes negative (passengers top up before it would).
   */
  getWallet: () =>
    withLatency<WalletSummary>(() => {
      const scenarios = getDemoScenarios();
      const passengerId = currentPassengerId();
      const myCardOrders = db
        .orders()
        .filter((o) => o.passengerId === passengerId && o.paymentMethod === "card")
        .sort((a, b) => a.createdAt - b.createdAt);

      const oldestTs = myCardOrders[0]?.createdAt ?? Date.now() - 25 * 86_400_000;

      type Draft = Omit<PassengerWalletEntry, "balanceAfter">;
      const drafts: Draft[] = [
        { id: `wtp_${passengerId}_seed1`, type: "topup", amount: 300_000, createdAt: oldestTs - 6 * 86_400_000 },
        { id: `wtp_${passengerId}_seed2`, type: "bonus", amount: 60_000, createdAt: oldestTs - 2 * 86_400_000 },
      ];

      for (const o of myCardOrders) {
        if (o.status === "completed") {
          drafts.push({ id: `wtx_${o.id}`, type: "trip_payment", amount: -o.price, createdAt: o.createdAt, orderId: o.id });
        } else if (o.status === "cancelled") {
          // Charged then refunded in full — cancellations never cost the passenger.
          drafts.push({ id: `wtx_${o.id}`, type: "trip_payment", amount: -o.price, createdAt: o.createdAt, orderId: o.id });
          drafts.push({ id: `wrf_${o.id}`, type: "refund", amount: o.price, createdAt: o.createdAt + 1, orderId: o.id });
        }
      }

      // One more top-up roughly halfway through, so the ledger isn't just a
      // single opening deposit for passengers with few trips.
      drafts.push({ id: `wtp_${passengerId}_seed3`, type: "topup", amount: 150_000, createdAt: oldestTs + 10 * 86_400_000 });

      drafts.sort((a, b) => a.createdAt - b.createdAt);
      let running = 0;
      for (const d of drafts) running = Math.max(0, running + d.amount);

      // Demo-only "low balance" scenario: there's no debt/blocking concept
      // for passengers (that's driver-only) — just a believable extra trip
      // that brings the balance down, so the low-balance notice has
      // something real to show, while balance === newest balanceAfter.
      if (scenarios.walletLimit && running > 4_000) {
        drafts.push({
          id: `wtx_${passengerId}_lowbal`,
          type: "trip_payment",
          amount: -(running - 4_000),
          createdAt: Date.now() - 2 * 3_600_000,
        });
        running = 4_000;
      }

      const entries: PassengerWalletEntry[] = [];
      let acc = 0;
      for (const d of drafts) {
        acc = Math.max(0, acc + d.amount);
        entries.push({ ...d, balanceAfter: acc });
      }

      return {
        balance: acc,
        lowBalance: acc < 20_000,
        entries: [...entries].reverse(),
      };
    }),

  applyPromoCode: (code: string) =>
    withLatency(() => {
      const normalized = code.trim().toUpperCase();
      if (normalized === "IZGO10") {
        return { valid: true, discountPct: 10, message: "10% chegirma qo'llandi" };
      }
      return { valid: false, discountPct: 0, message: "Promo-kod topilmadi yoki muddati tugagan" };
    }, { minMs: 300, maxMs: 600 }),

  getBonusSummary: () =>
    withLatency<BonusSummary>(() => {
      const scenarios = getDemoScenarios();
      let balance = bonusBalance();
      if (scenarios.bonusBelowMin) balance = Math.min(balance, BONUS_MIN_WITHDRAW - 8_000);
      const monthlyWithdrawn = bonusLedger()
        .filter((e) => e.type === "withdraw" && isSameMonth(e.createdAt, Date.now()))
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        balance,
        minWithdraw: BONUS_MIN_WITHDRAW,
        monthlyMax: BONUS_MONTHLY_MAX,
        monthlyWithdrawn,
        canWithdraw: balance >= BONUS_MIN_WITHDRAW && monthlyWithdrawn < BONUS_MONTHLY_MAX,
        progress: Math.min(1, balance / BONUS_MIN_WITHDRAW),
      };
    }),

  getBonusSources: () =>
    withLatency<BonusSource[]>(() => {
      const ledger = bonusLedger();
      const thisMonth = (sourceId: string) =>
        ledger
          .filter((e) => e.sourceId === sourceId && e.type === "earn" && isSameMonth(e.createdAt, Date.now()))
          .reduce((sum, e) => sum + e.amount, 0);
      return [
        {
          id: "trip",
          icon: "order",
          titleKey: "bonus.source.trip.title",
          descriptionKey: "bonus.source.trip.desc",
          amountThisMonth: thisMonth("trip"),
          action: "goto_order",
        },
        {
          id: "invite",
          icon: "invite",
          titleKey: "bonus.source.invite.title",
          descriptionKey: "bonus.source.invite.desc",
          amountThisMonth: thisMonth("invite"),
          action: "invite",
        },
        {
          id: "rate",
          icon: "rate",
          titleKey: "bonus.source.rate.title",
          descriptionKey: "bonus.source.rate.desc",
          amountThisMonth: thisMonth("rate"),
          action: "rate_trip",
        },
      ];
    }),

  getBonusHistory: (params) =>
    withLatency<BonusHistoryPage>(() => {
      let ledger = bonusLedger();
      if (params?.type) ledger = ledger.filter((e) => e.type === params.type);
      const pageSize = 10;
      const cursor = params?.cursor ?? 0;
      const entries = ledger.slice(cursor, cursor + pageSize);
      const nextCursor = cursor + pageSize < ledger.length ? cursor + pageSize : null;
      return { entries, nextCursor };
    }),

  requestBonusWithdraw: (amount: number) =>
    withLatency(() => {
      const withdrawals = readJSON<BonusLedgerEntry[]>(BONUS_WITHDRAWALS_KEY, []);
      withdrawals.push({ id: genId("bwd"), sourceId: "withdraw", type: "withdraw", amount, createdAt: Date.now() });
      writeJSON(BONUS_WITHDRAWALS_KEY, withdrawals);
      return submitForReview("bonus_withdraw", { amount });
    }, { minMs: 300, maxMs: 600 }),

  getNotificationPrefs: () => withLatency(() => readJSON<NotificationPrefs>(NOTIFICATION_PREFS_KEY, DEFAULT_NOTIFICATION_PREFS)),

  setNotificationPrefs: (patch) =>
    withLatency(() => {
      const current = readJSON<NotificationPrefs>(NOTIFICATION_PREFS_KEY, DEFAULT_NOTIFICATION_PREFS);
      const next = { ...current, ...patch };
      writeJSON(NOTIFICATION_PREFS_KEY, next);
      return next;
    }, { minMs: 150, maxMs: 350 }),

  getAccounts: () => withLatency(() => loadAccounts()),

  switchAccount: (id: string) =>
    withLatency(() => {
      const accounts = loadAccounts().map((a) => ({ ...a, active: a.id === id }));
      writeJSON(ACCOUNTS_KEY, accounts);
      return accounts;
    }, { minMs: 200, maxMs: 400 }),

  addAccount: (payload: { name: string; phone: string }) =>
    withLatency(() => {
      const accounts = loadAccounts();
      accounts.push({
        id: genId("acc"),
        name: payload.name,
        phoneMasked: payload.phone,
        avatarSeed: genId("av"),
        active: false,
      });
      writeJSON(ACCOUNTS_KEY, accounts);
      return submitForReview("account_add", payload);
    }, { minMs: 300, maxMs: 600 }),

  deleteAccount: (id: string) =>
    withLatency(() => {
      const accounts = loadAccounts();
      const target = accounts.find((a) => a.id === id);
      if (target?.active) throw new ApiError("INVALID", "Faol akkauntni o'chirib bo'lmaydi");
      writeJSON(ACCOUNTS_KEY, accounts.filter((a) => a.id !== id));
      return submitForReview("account_delete", { id });
    }, { minMs: 300, maxMs: 600 }),

  requestAccountDeletion: () =>
    withLatency(() => submitForReview("account_delete", { self: true }), { minMs: 300, maxMs: 600 }),

  requestPhoneChange: (_newPhone: string) =>
    withLatency<OtpRequestResult>(() => ({ requestId: genId("otp"), demoCode: DEMO_OTP_CODE }), { minMs: 250, maxMs: 500 }),

  confirmPhoneChange: (_requestId: string, code: string, newPhone: string) =>
    withLatency(() => {
      if (code !== DEMO_OTP_CODE) throw new ApiError("INVALID_CODE", "Kod noto'g'ri. Qaytadan urinib ko'ring.");
      db.updatePassenger(currentPassengerId(), { phoneMasked: newPhone });
      return submitForReview("phone_change", { newPhone });
    }, { minMs: 200, maxMs: 400 }),

  updateProfileName: (firstName: string, lastName: string) =>
    withLatency<Profile>(() => {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim();
      db.updatePassenger(currentPassengerId(), { name });
      const p = db.passengers().find((x) => x.id === currentPassengerId())!;
      return { id: p.id, name: p.name, phoneMasked: p.phoneMasked, avatarSeed: p.avatarSeed, rating: p.rating, totalTrips: p.totalTrips };
    }, { minMs: 200, maxMs: 400 }),

  submitHelpRequest: (topic, message) =>
    withLatency(() => {
      const review = submitForReview("support_ticket", { topic, message });
      const requests = readJSON<HelpRequest[]>(HELP_REQUESTS_KEY, []);
      requests.unshift({ id: review.id, topicKey: `help.topic.${topic}`, message, status: "pending", createdAt: Date.now() });
      writeJSON(HELP_REQUESTS_KEY, requests);
      return review;
    }, { minMs: 300, maxMs: 600 }),

  getHelpRequests: () =>
    withLatency(() => {
      const requests = readJSON<HelpRequest[]>(HELP_REQUESTS_KEY, []);
      return requests.map((r) => {
        const review = getReviewRequest(r.id);
        return review && review.status !== "pending" ? { ...r, status: "resolved" as const } : r;
      });
    }),

  submitSupportTicket: (message: string) =>
    withLatency(() => submitForReview("support_ticket", { message }), { minMs: 300, maxMs: 600 }),
};
