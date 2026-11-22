import { db, getReviewRequest } from "@/mockDb/db";
import { withLatency, ApiError } from "@/mockDb/latency";
import { submitForReview, pollReview } from "@/lib/reviewMechanism";
import { getTestScenarios } from "@/stores/testScenariosStore";
import { computePrice, roadDistanceKm, DEFAULT_TARIFF, type City, type Order } from "@/seed/generate";
import { readJSON, writeJSON } from "@/mockDb/storage";
import {
  ADDRESSES,
  WAREHOUSES,
  addressById,
  mockCoords,
  addressesForQuery,
  defaultAddressesForCity,
  nearestAddress,
  savedAddresses,
  type Address,
} from "@/clientData/addresses";
import { makeRng } from "@/lib/prng";
import { offsetPoint } from "@shared/map/geo";
import type { ApiAdapter } from "../adapterTypes";
import type {
  AddressDetails,
  AddressSearchResult,
  CargoCheck,
  CargoContact,
  CargoInfo,
  CargoRules,
  RideAlong,
  Warehouse,
  CarClass,
  CarClassId,
  EmergencyContact,
  EmergencyContacts,
  LuggageRules,
  OptionVariants,
  PromoResult,
  Rider,
  TipOptions,
  TripShare,
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

const TEST_OTP_CODE = "0000";
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

// ── Kargo (part 3): tabs, loaders, hourly, ride-along, contacts ─────────────
// Hourly rate and the cab seats a passenger (or loaders) can use, per vehicle.
const CARGO_VEHICLE: Record<DeliveryVehicle, { hourRate: number; cabSeats: number }> = {
  spark: { hourRate: 60_000, cabSeats: 1 },
  damas: { hourRate: 90_000, cabSeats: 2 },
  labo: { hourRate: 100_000, cabSeats: 1 },
  isuzu: { hourRate: 180_000, cabSeats: 2 },
  isuzu2: { hourRate: 240_000, cabSeats: 2 },
  fura: { hourRate: 400_000, cabSeats: 0 },
};
/** In town a km costs more than on the highway. */
const CITY_KM_FACTOR = 5;
const DROPOFF_FEE = 5_000;
const CARGO_RULES: CargoRules = {
  tabs: [
    { id: "city", labelKey: "kargo.tab.city" },
    { id: "intercity", labelKey: "kargo.tab.intercity" },
    { id: "marketplace", labelKey: "kargo.tab.marketplace" },
  ],
  // Step 1's route is always between cities, so start there.
  defaultTab: "intercity",
  loaders: {
    counts: [0, 1, 2],
    pricePerLoader: 40_000,
    infoLines: [
      { key: "kargo.loaders.rule", params: { n: 1, kg: 30 } },
      { key: "kargo.loaders.rule", params: { n: 2, kg: 60 } },
    ],
  },
  hours: { min: 2, max: 12 },
  pricingModes: {
    city: [
      { id: "route", labelKey: "kargo.mode.route", available: true },
      { id: "hourly", labelKey: "kargo.mode.hourly", available: true },
    ],
    intercity: [
      { id: "route", labelKey: "kargo.mode.route", available: true },
      { id: "hourly", labelKey: "kargo.mode.hourly", available: false, reasonKey: "kargo.mode.hourlyCityOnly" },
    ],
    marketplace: [
      { id: "route", labelKey: "kargo.mode.route", available: true },
      { id: "hourly", labelKey: "kargo.mode.hourly", available: false, reasonKey: "kargo.mode.hourlyCityOnly" },
    ],
  },
  maxExtraDropoffs: { city: 2, intercity: 2, marketplace: 0 },
  infoTopics: [
    { id: "delivery", labelKey: "kargo.info.delivery.chip" },
    { id: "loaders", labelKey: "kargo.info.loaders.chip" },
    { id: "body", labelKey: "kargo.info.body.chip" },
    { id: "insurance", labelKey: "kargo.info.insurance.chip" },
  ],
};

function rideAlongFor(vehicle: DeliveryVehicle, loaders: number): RideAlong {
  const seats = CARGO_VEHICLE[vehicle]?.cabSeats ?? 0;
  if (seats === 0) return { available: false, reasonKey: "kargo.rideAlong.noSeat" };
  if (seats - loaders < 1) return { available: false, reasonKey: "kargo.rideAlong.loadersTakeSeats" };
  return { available: true };
}

/** Defaults for orders made before Kargo tabs, then every field checked. */
function normalizeCargo(cargo: CargoInput | undefined): Required<Omit<CargoInput, "note" | "hours">> & Pick<CargoInput, "note" | "hours"> {
  const c = cargo ?? DEFAULT_CARGO;
  if (!VEHICLES[c.vehicle]) throw new ApiError("INVALID_VEHICLE", "order.quoteError");
  const tab = c.tab ?? CARGO_RULES.defaultTab;
  if (!CARGO_RULES.tabs.some((t) => t.id === tab)) throw new ApiError("INVALID_TAB", "order.quoteError");
  const loaders = c.loaders ?? 0;
  if (!CARGO_RULES.loaders.counts.includes(loaders)) throw new ApiError("CARGO_LOADERS", "kargo.error.loaders");
  const pricingMode = c.pricingMode ?? "route";
  const mode = CARGO_RULES.pricingModes[tab].find((m) => m.id === pricingMode);
  if (!mode?.available) throw new ApiError("CARGO_MODE", mode?.reasonKey ?? "order.quoteError");
  let hours: number | undefined;
  if (pricingMode === "hourly") {
    const h = c.hours ?? CARGO_RULES.hours.min;
    if (!Number.isInteger(h) || h < CARGO_RULES.hours.min || h > CARGO_RULES.hours.max) {
      throw new ApiError("CARGO_HOURS", "kargo.error.hours");
    }
    hours = h;
  }
  const rideAlong = !!c.rideAlong;
  if (rideAlong) {
    const r = rideAlongFor(c.vehicle, loaders);
    if (!r.available) throw new ApiError("CARGO_RIDE_ALONG", r.reasonKey ?? "order.quoteError");
  }
  return { vehicle: c.vehicle, note: c.note, tab, loaders, pricingMode, hours, rideAlong };
}

/** Distance between two points of the same city, from their map positions. */
function cityLegKm(a: Address, b: Address) {
  return Math.max(2, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 0.3));
}

function priceCargo(input: { fromAddressId: string; toAddressId: string; stops: string[]; cargo?: CargoInput }) {
  const cargo = normalizeCargo(input.cargo);
  const tab = cargo.tab;
  if (input.stops.length > CARGO_RULES.maxExtraDropoffs[tab]) throw new ApiError("TOO_MANY_DROPOFFS", "kargo.error.tooManyDrops");
  // Drop-offs in order: the extra ones, then "Qayerga".
  const points = [input.fromAddressId, ...input.stops, input.toAddressId].map(addressOf);
  const from = points[0];
  const to = points[points.length - 1];
  const sameCity = points.every((p) => p.cityId === from.cityId);
  if (tab === "city" && !sameCity) throw new ApiError("CARGO_CITY_ONLY", "kargo.error.cityOnly");
  if (tab === "intercity" && to.cityId === from.cityId) throw new ApiError("CARGO_INTERCITY_ONLY", "kargo.error.intercityOnly");
  if (tab === "marketplace" && !to.warehouse) throw new ApiError("CARGO_WAREHOUSE_ONLY", "kargo.error.warehouseOnly");
  if (to.id === from.id) throw new ApiError("INVALID_ROUTE", "kargo.error.sameAddress");

  let directKm: number;
  let routeKm = 0;
  for (let i = 1; i < points.length; i++) {
    routeKm += points[i].cityId === points[i - 1].cityId ? cityLegKm(points[i - 1], points[i]) : roadDistanceKm(points[i - 1].cityId, points[i].cityId);
  }
  if (sameCity) directKm = cityLegKm(from, to);
  else directKm = roadDistanceKm(from.cityId, to.cityId);
  const rate = VEHICLES[cargo.vehicle];
  const lines: QuoteLine[] = [];
  if (cargo.pricingMode === "hourly") {
    // Time covers every drop-off and the distance.
    const hourRate = CARGO_VEHICLE[cargo.vehicle].hourRate;
    lines.push({ key: "quote.cargoHourly", params: { hours: cargo.hours! }, amount: hourRate * cargo.hours! });
  } else {
    const perKm = sameCity ? rate.perKm * CITY_KM_FACTOR : rate.perKm;
    lines.push({ key: "quote.cargoBase", amount: rate.base });
    lines.push({ key: "quote.cargoDistance", params: { km: directKm }, amount: Math.round((perKm * directKm) / 1000) * 1000 });
    input.stops.forEach((id, i) => {
      lines.push({ key: "quote.dropoff", params: { n: i + 1, place: addressOf(id).label }, amount: DROPOFF_FEE });
    });
    const detourKm = Math.max(0, routeKm - directKm);
    if (detourKm > 0) lines.push({ key: "quote.detour", params: { km: detourKm }, amount: Math.round((perKm * detourKm) / 1000) * 1000 });
  }
  if (cargo.loaders > 0) {
    lines.push({ key: "quote.loaders", params: { n: cargo.loaders }, amount: cargo.loaders * CARGO_RULES.loaders.pricePerLoader });
  }
  return { cargo, directKm, routeKm, lines };
}

function normalizeReceiver(c: CargoContact | undefined): CargoContact {
  const name = (c?.name ?? "").trim();
  if (!name) throw new ApiError("RECEIVER_NAME", "kargo.error.receiverName");
  if (name.length > ORDER_DETAILS_RULES.riderNameMaxLength) throw new ApiError("RECEIVER_NAME", "rider.error.nameLong");
  const digits = nationalDigits(c?.phone ?? "");
  if (digits.length !== PHONE_DIGITS) throw new ApiError("RECEIVER_PHONE", "rider.error.phone");
  return { name, phone: formatPhone(digits) };
}

// ── Order details: stops, Tafsilotlar, comment, add-ons ─────────────────────
// Limits, prices and keyword matching all live here; the UI reads them.
const ORDER_DETAILS_RULES: OrderDetailsRules = {
  maxStops: 3,
  commentMaxLength: 300,
  addressFieldMaxLength: 10,
  intercomMaxLength: 16,
  addressNoteMaxLength: 200,
  riderNameMaxLength: 40,
};
const STOP_FEE = 5_000;
type OptionDef = Omit<OrderOption, "available" | "reasonKey"> & {
  /** Classes that can't offer it, with the reason shown on the disabled row. */
  notIn?: { classes: CarClassId[]; reasonKey: string };
};
const CHILD_SEAT_AGES = [
  { id: "0_9m", labelKey: "option.child_seat.age.0_9m" },
  { id: "9m_4y", labelKey: "option.child_seat.age.9m_4y" },
  { id: "4_12y", labelKey: "option.child_seat.age.4_12y" },
];
const OPTION_DEFS: Record<ServiceType, OptionDef[]> = {
  passenger: [
    { id: "child_seat", titleKey: "option.child_seat", descKey: "option.child_seat.desc", price: 15_000, variants: CHILD_SEAT_AGES, defaultVariant: "9m_4y" },
    { id: "pet", titleKey: "option.pet", descKey: "option.pet.desc", price: 20_000, notIn: { classes: ["biznes"], reasonKey: "option.reason.notInBiznes" } },
    { id: "big_luggage", titleKey: "option.big_luggage", descKey: "option.big_luggage.desc", price: 10_000 },
    { id: "find_car", titleKey: "option.find_car", descKey: "option.find_car.desc", price: 0 },
    { id: "wheelchair", titleKey: "option.wheelchair", descKey: "option.wheelchair.desc", price: 0, notIn: { classes: ["standart", "komfort", "biznes"], reasonKey: "option.reason.minivenOnly" } },
    { id: "text_only", titleKey: "option.text_only", descKey: "option.text_only.desc", price: 0 },
  ],
  delivery: [],
};

function orderOptions(serviceType: ServiceType, carClass: CarClassId = "standart"): OrderOption[] {
  return OPTION_DEFS[serviceType].map(({ notIn, ...o }) => {
    const blocked = !!notIn && notIn.classes.includes(carClass);
    return { ...o, variants: o.variants?.map((v) => ({ ...v })), available: !blocked, reasonKey: blocked ? notIn!.reasonKey : undefined };
  });
}

/** Car classes: a surcharge on the base fare, and when each can't be booked. */
const CAR_CLASSES: Record<CarClassId, { nameKey: string; seats: number; surchargePct: number }> = {
  standart: { nameKey: "class.standart", seats: 4, surchargePct: 0 },
  komfort: { nameKey: "class.komfort", seats: 4, surchargePct: 25 },
  biznes: { nameKey: "class.biznes", seats: 4, surchargePct: 70 },
  miniven: { nameKey: "class.miniven", seats: 6, surchargePct: 40 },
};
const CAR_CLASS_IDS = Object.keys(CAR_CLASSES) as CarClassId[];
const BIZNES_MAX_KM = 700;

function classAvailability(id: CarClassId, mode: OrderMode, directKm: number): string | undefined {
  // The seat map has 4 seats; a 6-seat minivan is booked whole.
  if (id === "miniven" && mode === "seat") return "class.reason.wholeCarOnly";
  if (id === "biznes" && directKm > BIZNES_MAX_KM) return "class.reason.longRoute";
  return undefined;
}

const PROMO_CODES: Record<string, number> = { IZGO10: 10 };
/** Entrances the mock knows, by point index (1 = Avtovokzal, 3 = Temir yo'l vokzali). */
const ENTRANCES: Record<string, string[]> = { "1": ["1", "2"], "3": ["1"] };

// Tips: chip amounts and the custom range. A tip goes through the review
// mechanism like any other money movement in the demo.
const TIP_RULES = { presets: [0, 5_000, 10_000, 20_000], min: 1_000, max: 200_000 };
const TIPS_KEY = "tips";
type StoredTip = { amount: number; reviewId: string };
function loadTips() {
  return readJSON<Record<string, StoredTip>>(TIPS_KEY, {});
}

const EMERGENCY_KEY = "emergency_contacts";
const EMERGENCY_MAX = 3;
const SUPPORT_PHONE = "+998 71 200 00 00";
function loadEmergency() {
  return readJSON<EmergencyContact[]>(EMERGENCY_KEY, []);
}
const LUGGAGE_MAX = 4;
const PHONE_DIGITS = 9;
/** "+998 90 123 45 67" → "901234567"; the country code is fixed. */
function nationalDigits(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("998") && d.length === PHONE_DIGITS + 3 ? d.slice(3) : d;
}
function formatPhone(digits: string) {
  return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}
function normalizeRider(rider: Rider | undefined): Rider {
  if (!rider || rider.kind === "me") return { kind: "me" };
  const name = rider.name.trim();
  if (!name) throw new ApiError("RIDER_NAME", "rider.error.name");
  if (name.length > ORDER_DETAILS_RULES.riderNameMaxLength) throw new ApiError("RIDER_NAME", "rider.error.nameLong");
  const digits = nationalDigits(rider.phone);
  if (digits.length !== PHONE_DIGITS) throw new ApiError("RIDER_PHONE", "rider.error.phone");
  return { kind: "other", name, phone: formatPhone(digits) };
}
function normalizeLuggage(route: { fromAddressId: string; toAddressId: string }, luggage: number | undefined) {
  const rules = luggageRules(route);
  const n = luggage ?? 0;
  if (!rules) return n === 0 ? undefined : (() => { throw new ApiError("LUGGAGE", "luggage.error"); })();
  if (!Number.isInteger(n) || n < rules.min || n > rules.max) throw new ApiError("LUGGAGE", "luggage.error");
  return n || undefined;
}
function luggageRules(route: { fromAddressId: string; toAddressId: string }) {
  // Bags are counted for intercity trips only.
  return addressOf(route.fromAddressId).cityId !== addressOf(route.toAddressId).cityId ? { min: 0, max: LUGGAGE_MAX } : null;
}

/** Word-start stems per add-on, uz/ru/en. Matched against whole words so
 * "bolalar" and "ребёнком" hit but a stem in the middle of a word doesn't. */
const HINT_STEMS: Partial<Record<OrderOptionId, { stems: string[]; messageKey: string }>> = {
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

/** The seeded saved addresses plus/minus what saveAddress /
 * removeSavedAddress changed (nothing, until a screen calls them). */
const SAVED_CHANGES_KEY = "saved_address_changes";
type SavedChanges = { added: string[]; removed: string[] };
function savedChanges(): SavedChanges {
  return readJSON<SavedChanges>(SAVED_CHANGES_KEY, { added: [], removed: [] });
}
function mySavedAddresses(): Address[] {
  const { added, removed } = savedChanges();
  const seeded = savedAddresses().filter((a) => !removed.includes(a.id));
  const extra = added.map((id) => addressById(id)).filter((a): a is Address => !!a && !seeded.some((s) => s.id === a.id));
  return [...seeded, ...extra];
}

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

function validateOptions(
  serviceType: ServiceType,
  carClass: CarClassId,
  optionIds: OrderOptionId[] | undefined,
  variants: OptionVariants | undefined
): { optionIds: OrderOptionId[]; optionVariants: OptionVariants } {
  const options = orderOptions(serviceType, carClass);
  const ids = [...new Set(optionIds ?? [])];
  const optionVariants: OptionVariants = {};
  for (const id of ids) {
    const o = options.find((x) => x.id === id);
    if (!o) throw new ApiError("INVALID_OPTION", "order.quoteError");
    if (!o.available) throw new ApiError("OPTION_UNAVAILABLE", o.reasonKey ?? "order.quoteError");
    if (o.variants) {
      const v = variants?.[id] ?? o.defaultVariant;
      if (!o.variants.some((x) => x.id === v)) throw new ApiError("INVALID_OPTION", "order.quoteError");
      optionVariants[id] = v;
    }
  }
  return { optionIds: ids, optionVariants };
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
  optionVariants?: OptionVariants;
  carClass?: CarClassId;
  promoCode?: string;
};

/** The one price for an order — quote, class cards, create and update all
 * call this, so the charged price can't drift from the quote. Lines sum to
 * the total. */
function priceOrder(input: PriceInput) {
  const carClass: CarClassId = input.serviceType === "passenger" ? input.carClass ?? "standart" : "standart";
  if (!CAR_CLASSES[carClass]) throw new ApiError("INVALID_CLASS", "order.quoteError");
  const { optionIds, optionVariants } = validateOptions(input.serviceType, carClass, input.optionIds, input.optionVariants);

  let lines: QuoteLine[];
  let directKm: number;
  let routeKm: number;
  let cargo: CargoInput | undefined;
  if (input.serviceType === "delivery") {
    // Kargo has its own route rules per tab (in-city routes are fine there).
    ({ lines, directKm, routeKm, cargo } = priceCargo(input));
  } else {
    validateStopsCount(input.stops.length);
    const cities = [input.fromAddressId, ...input.stops, input.toAddressId].map((id) => addressOf(id).cityId);
    directKm = roadDistanceKm(cities[0], cities[cities.length - 1]);
    if (directKm === 0) throw new ApiError("INVALID_ROUTE", "order.error.sameCity");
    const reason = classAvailability(carClass, input.mode, directKm);
    if (reason) throw new ApiError("CLASS_UNAVAILABLE", reason);
    routeKm = 0;
    for (let i = 1; i < cities.length; i++) routeKm += roadDistanceKm(cities[i - 1], cities[i]);
    const detourKm = Math.max(0, routeKm - directKm);

    lines = [];
    let detourPerKm: number;
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
    const pct = CAR_CLASSES[carClass].surchargePct;
    if (pct > 0) lines.push({ key: `quote.class.${carClass}`, params: { pct }, amount: Math.round((fare * pct) / 100 / 1000) * 1000 });
    input.stops.forEach((id, i) => {
      lines.push({ key: "quote.stop", params: { n: i + 1, place: addressOf(id).label }, amount: STOP_FEE });
    });
    if (detourKm > 0) {
      lines.push({ key: "quote.detour", params: { km: detourKm }, amount: Math.round((detourPerKm * detourKm) / 1000) * 1000 });
    }
    for (const option of OPTION_DEFS[input.serviceType]) {
      if (optionIds.includes(option.id) && option.price > 0) lines.push({ key: `quote.option.${option.id}`, amount: option.price });
    }
  }
  let promoCode: string | undefined;
  if (input.promoCode) {
    promoCode = input.promoCode.trim().toUpperCase();
    const pct = PROMO_CODES[promoCode];
    if (!pct) throw new ApiError("PROMO_INVALID", "promo.invalid");
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
    lines.push({ key: "quote.promo", params: { code: promoCode, pct }, amount: -Math.round((subtotal * pct) / 100 / 1000) * 1000 });
  }
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return { directKm, routeKm, lines, total, optionIds, optionVariants, carClass, promoCode, cargo };
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

/** Mock coordinates the assigned driver starts from: 1.5–3 km from the
 * pickup, in a direction fixed per order. */
function driverStartPoint(order: Order): { lat: number; lng: number } {
  const pickupAddress = addressById(loadOrderExtras()[order.id]?.fromAddressId ?? "");
  const pickup = pickupAddress ?? cityOf(order.fromCityId);
  const rng = makeRng(hashSeed(order.id));
  const angle = rng.float(0, Math.PI * 2, 3);
  const far = rng.int(1500, 3000);
  return offsetPoint({ lat: pickup.lat, lng: pickup.lng }, Math.cos(angle) * far, Math.sin(angle) * far);
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
  otpLength: { min: 4, max: 4 },
  capabilities: {
    ordering: true,
    orderDetails: true,
    repeatOrder: true,
    historyStatusFilter: true,
    tips: true,
    safety: true,
    popularRoutes: true,
    promo: true,
    bonuses: true,
    help: true,
    savedCards: true,
    accounts: true,
    phoneChange: true,
    accountDeletion: true,
    notificationTopics: true,
    stops: true,
    orderOptions: true,
    rider: true,
    addressDetails: true,
    cargoExtras: true,
    mapPick: true,
    pickupEta: true,
    editPickup: true,
  },

  // The sample data keeps no server session: the auth store's own flag
  // decides, and there is nothing to revoke or push.
  hasSession: () => null,
  resumeSession: async () => {},
  logout: async () => {},
  onSessionEnd: () => () => {},
  onOrderEvent: () => () => {},

  // No GPS in the sample data: the car's place follows the order's own
  // timeline — the share of the way to the pickup, then of the trip. The
  // driver "sets off" from mock coordinates a couple of kilometres away.
  onDriverLocation: (orderId, listener) => {
    const tick = () => {
      const order = db.getOrder(orderId);
      const t = order?.timeline;
      if (!order || !t?.acceptedAt || !t.tripStartsAt || !t.tripEndsAt) return;
      const share = (from: number, to: number) => Math.min(1, Math.max(0, (Date.now() - from) / Math.max(1, to - from)));
      const start = driverStartPoint(order);
      if (order.status === "accepted") listener({ orderId, kind: "progress", leg: "to_pickup", fraction: share(t.acceptedAt, t.tripStartsAt), start });
      else if (order.status === "in_progress") listener({ orderId, kind: "progress", leg: "trip", fraction: share(t.tripStartsAt, t.tripEndsAt), start });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  },

  repeatOrder: async (orderId, fallback) => {
    // Re-order exactly what was ordered: the order's extras hold the route,
    // stops, details, class, options and promo (the draft was reset on submit).
    const order = await mockAdapter.getOrder(orderId);
    const x = order.extras;
    const serviceType = x?.serviceType ?? fallback.serviceType;
    return mockAdapter.createOrder({
      serviceType,
      fromAddressId: x?.fromAddressId || defaultAddressesForCity(order.fromCityId)[0]?.id || "",
      toAddressId: x?.toAddressId || defaultAddressesForCity(order.toCityId)[0]?.id || "",
      mode: order.mode ?? fallback.mode,
      seatIds: order.seatIds ?? fallback.seatIds,
      cargo: x?.cargo ?? (serviceType === "delivery" ? fallback.cargo : undefined),
      paymentMethod: order.paymentMethod ?? fallback.paymentMethod,
      timing: x?.timing ?? fallback.timing,
      fromDetails: x?.fromDetails,
      toDetails: x?.toDetails,
      stops: x?.stops,
      comment: x?.comment,
      optionIds: x?.optionIds,
      optionVariants: x?.optionVariants,
      carClass: x?.carClass,
      luggage: x?.luggage,
      rider: x?.rider,
      promoCode: x?.promoCode,
      sender: x?.sender,
      receiver: x?.receiver,
    });
  },

  addressById: (id) => addressById(id),
  // New drafts start from Toshkent.
  defaultPickupId: () => ADDRESSES.find((a) => a.cityId === "tsh")?.id ?? ADDRESSES[0]?.id ?? "",
  // The device position is the map's centre in the sample data.
  locateMe: () => mockAdapter.reverseGeocode(50, 50),
  // The demo passenger "stands" at the centre of Toshkent (69.2401, 41.2995).
  simulatedPosition: () => mockCoords("tsh", 50, 50),

  getCities: () => withLatency(() => db.cities()),

  getPopularRoutes: () =>
    withLatency(() => popularPairs().map((p) => routeSuggestion(p.from, p.to))),

  getRecentRoutes: () =>
    withLatency(() => {
      if (getTestScenarios().newPassenger) return [];
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

  searchAddresses: ({ query, fromAddressId, excludeCityId, onlyCityId }) =>
    withLatency<AddressSearchResult[]>(() => {
      const from = fromAddressId ? addressById(fromAddressId) : undefined;
      const out: AddressSearchResult[] = [];
      for (const address of addressesForQuery(query, excludeCityId, onlyCityId)) {
        const distanceKm = !from
          ? 0
          : from.cityId === address.cityId
          ? cityLegKm(from, address)
          : roadDistanceKm(from.cityId, address.cityId);
        const area = cityOf(address.cityId).region;
        out.push({ address, area, distanceKm });
        // Points with several entrances come back once per entrance too.
        for (const entrance of ENTRANCES[address.id.split("-")[1] ?? ""] ?? []) out.push({ address, area, distanceKm, entrance });
      }
      return out.slice(0, 14);
    }, { minMs: 150, maxMs: 350 }),

  getAddressSuggestions: (query: string, excludeCityId?: string, onlyCityId?: string) =>
    withLatency(() => addressesForQuery(query, excludeCityId, onlyCityId), { minMs: 150, maxMs: 350 }),

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
      // No pickup yet: distances come out as 0 (roadDistanceKm of an unknown city).
      const fromCityId = fromAddressId ? addressOf(fromAddressId).cityId : "";
      const details = savedAddressDetails();
      // "Yangi yo'lovchi": only what the passenger saves in this session.
      const list = getTestScenarios().newPassenger ? mySavedAddresses().filter((a) => savedChanges().added.includes(a.id)) : mySavedAddresses();
      return list.map((address) => {
        const distanceKm = roadDistanceKm(fromCityId, address.cityId);
        return { address, area: cityOf(address.cityId).region, details: details[address.id], distanceKm, etaMinutes: Math.round((distanceKm / 70) * 60) };
      });
    }, { minMs: 150, maxMs: 350 }),

  saveAddress: ({ addressId, details }) =>
    withLatency<SavedAddressInfo>(() => {
      const address = addressOf(addressId);
      const c = savedChanges();
      writeJSON(SAVED_CHANGES_KEY, { added: [...c.added.filter((id) => id !== addressId), addressId], removed: c.removed.filter((id) => id !== addressId) });
      const normalized = normalizeDetails(details);
      const all = savedAddressDetails();
      if (normalized) all[addressId] = normalized;
      else delete all[addressId];
      writeJSON(SAVED_DETAILS_KEY, all);
      return { address, area: cityOf(address.cityId).region, details: normalized };
    }),

  removeSavedAddress: (addressId) =>
    withLatency<void>(() => {
      const c = savedChanges();
      writeJSON(SAVED_CHANGES_KEY, { added: c.added.filter((id) => id !== addressId), removed: [...c.removed.filter((id) => id !== addressId), addressId] });
    }),

  reverseGeocode: (x: number, y: number, excludeCityId?: string, onlyCityId?: string) =>
    withLatency(() => nearestAddress(x, y, excludeCityId, onlyCityId), { minMs: 200, maxMs: 450 }),

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

  getOrderOptions: ({ serviceType, carClass }) =>
    withLatency<OrderOption[]>(() => orderOptions(serviceType, carClass), { minMs: 100, maxMs: 250 }),

  getCommentHints: ({ text, serviceType, carClass, selectedOptionIds }) =>
    withLatency<CommentHint[]>(() => {
      const words = text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      // Never suggest something already on, or that this class can't offer.
      return orderOptions(serviceType, carClass)
        .filter((o) => o.available && !selectedOptionIds.includes(o.id))
        .flatMap((o) => {
          const h = HINT_STEMS[o.id];
          return h && words.some((w) => h.stems.some((stem) => w.startsWith(stem))) ? [{ optionId: o.id, messageKey: h.messageKey }] : [];
        });
    }, { minMs: 80, maxMs: 180 }),

  getCarClasses: (input) =>
    withLatency<CarClass[]>(() => {
      const directKm = roadDistanceKm(addressOf(input.fromAddressId).cityId, addressOf(input.toAddressId).cityId);
      return CAR_CLASS_IDS.map((id) => {
        const c = CAR_CLASSES[id];
        const reasonKey = classAvailability(id, input.mode, directKm);
        let price = 0;
        if (!reasonKey) {
          // Same price the quote would give with this class; options this
          // class can't offer are left out rather than failing the card.
          const offered = new Set(orderOptions("passenger", id).filter((o) => o.available).map((o) => o.id));
          price = priceOrder({
            serviceType: "passenger",
            fromAddressId: input.fromAddressId,
            toAddressId: input.toAddressId,
            stops: input.stops ?? [],
            mode: input.mode,
            seatIds: input.seatIds,
            optionIds: (input.optionIds ?? []).filter((o) => offered.has(o)),
            optionVariants: input.optionVariants,
            carClass: id,
            promoCode: input.promoCode,
          }).total;
        }
        // A deterministic "nearest car" per class and route.
        const etaMinutes = 3 + (hashSeed(`${input.fromAddressId}|${id}`) % 9);
        return { id, nameKey: c.nameKey, seats: c.seats, price, available: !reasonKey, reasonKey, etaMinutes };
      });
    }, { minMs: 250, maxMs: 500 }),

  getLuggageRules: (route) => withLatency<LuggageRules>(() => luggageRules(route), { minMs: 100, maxMs: 250 }),

  validateRider: (rider) => withLatency<Rider>(() => normalizeRider(rider), { minMs: 150, maxMs: 300 }),

  getSavedAddressDetails: (addressId) =>
    withLatency<AddressDetails | null>(() => {
      if (!mySavedAddresses().some((a) => a.id === addressId)) return null;
      return savedAddressDetails()[addressId] ?? null;
    }, { minMs: 80, maxMs: 200 }),

  saveAddressDetails: (addressId, details) =>
    withLatency<AddressDetails>(() => {
      addressOf(addressId);
      const normalized = normalizeDetails(details) ?? {};
      if (mySavedAddresses().some((a) => a.id === addressId)) {
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
        optionVariants: input.optionVariants,
        carClass: input.carClass,
        promoCode: input.promoCode,
      });
      const etaMinutes = 3 + Math.round(Math.random() * 6);
      const durationMinutes = Math.round((routeKm / 70) * 60);
      return {
        distanceKm: routeKm,
        lines,
        total,
        currency: "som",
        etaMinutes,
        durationMinutes,
        arrivalAt: Date.now() + (etaMinutes + durationMinutes) * 60_000,
      };
    }, { minMs: 300, maxMs: 600 }),

  requestOtp: (_phone: string) =>
    withLatency<OtpRequestResult>(() => ({
      requestId: genId("otp"),
      testCode: TEST_OTP_CODE,
    }), { minMs: 250, maxMs: 500 }),

  verifyOtp: (_requestId: string, code: string) =>
    withLatency(() => {
      if (code !== TEST_OTP_CODE) {
        throw new ApiError("INVALID_CODE", "Kod noto'g'ri. Qaytadan urinib ko'ring.");
      }
      return submitForReview("otp_verify", { phone: _requestId });
    }, { minMs: 200, maxMs: 400 }),

  getReviewStatus: (reviewId: string) => withLatency(() => pollReview(reviewId), { minMs: 150, maxMs: 350 }),

  createOrder: (input: CreateOrderInput) =>
    withLatency<OrderWithDetails>(() => {
      validateTiming(input.timing);
      const scenarios = getTestScenarios();
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
      const rider = normalizeRider(input.rider);
      // Kargo: who hands it over and who receives it (the receiver is required).
      const sender = input.serviceType === "delivery" ? normalizeRider(input.sender) : undefined;
      const receiver = input.serviceType === "delivery" ? normalizeReceiver(input.receiver) : undefined;
      const luggage = normalizeLuggage(input, input.luggage);
      const { routeKm: distanceKm, total: price, optionIds, optionVariants, carClass, promoCode, cargo: pricedCargo } = priceOrder({
        serviceType: input.serviceType,
        fromAddressId: input.fromAddressId,
        toAddressId: input.toAddressId,
        stops: stops.map((st) => st.addressId),
        mode: input.mode,
        seatIds: input.seatIds,
        cargo,
        optionIds: input.optionIds ?? [],
        optionVariants: input.optionVariants,
        carClass: input.carClass,
        promoCode: input.promoCode,
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
        optionVariants,
        carClass: input.serviceType === "passenger" ? carClass : undefined,
        luggage,
        rider: rider.kind === "other" ? rider : undefined,
        promoCode,
        ...(input.serviceType === "delivery" ? { cargo: pricedCargo, sender, receiver } : {}),
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
        // Class, variants and promo aren't editable here; they must survive
        // a partial save (e.g. payment only) and keep pricing the order.
        optionVariants: nextExtras.optionVariants,
        carClass: nextExtras.carClass,
        promoCode: nextExtras.promoCode,
      });
      nextExtras.optionIds = priced.optionIds;
      nextExtras.optionVariants = priced.optionVariants;
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
      const scenarios = getTestScenarios();
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

  getTipOptions: (orderId) =>
    withLatency<TipOptions>(() => {
      const order = db.getOrder(orderId);
      if (!order) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      const stored = loadTips()[orderId];
      let sent: TipOptions["sent"];
      if (stored) {
        const status = getReviewRequest(stored.reviewId) ? pollReview(stored.reviewId).status : "approved";
        sent = { amount: stored.amount, reviewId: stored.reviewId, status };
      }
      return {
        allowed: order.status === "completed" && !!order.driverId && !stored,
        presets: [...TIP_RULES.presets],
        min: TIP_RULES.min,
        max: TIP_RULES.max,
        sent,
      };
    }, { minMs: 150, maxMs: 350 }),

  sendTip: (orderId, amount) =>
    withLatency(() => {
      const order = db.getOrder(orderId);
      if (!order) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      if (order.status !== "completed" || !order.driverId) throw new ApiError("TIP_NOT_ALLOWED", "tip.error.notAllowed");
      if (loadTips()[orderId]) throw new ApiError("TIP_ALREADY_SENT", "tip.error.alreadySent");
      if (!Number.isInteger(amount) || amount < TIP_RULES.min || amount > TIP_RULES.max) {
        throw new ApiError("TIP_RANGE", "tip.error.range");
      }
      const review = submitForReview("tip", { orderId, amount, driverId: order.driverId });
      writeJSON(TIPS_KEY, { ...loadTips(), [orderId]: { amount, reviewId: review.id } });
      return review;
    }, { minMs: 300, maxMs: 600 }),

  getTripShareLink: (orderId) =>
    withLatency<TripShare>(() => {
      const order = db.getOrder(orderId);
      if (!order) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      const driver = order.driverId ? db.drivers().find((d) => d.id === order.driverId) : undefined;
      // A mock follow-the-trip link on the app's own origin — nothing leaves the device.
      const token = hashSeed(`${orderId}|share`).toString(36);
      return {
        url: `${window.location.origin}/share/${token}`,
        textKey: "safety.shareText",
        params: {
          from: cityOf(order.fromCityId).name,
          to: cityOf(order.toCityId).name,
          car: driver ? `${driver.carModel}, ${driver.plate}` : "—",
        },
      };
    }, { minMs: 200, maxMs: 400 }),

  getEmergencyContacts: () =>
    withLatency<EmergencyContacts>(() => ({ contacts: loadEmergency(), max: EMERGENCY_MAX }), { minMs: 150, maxMs: 300 }),

  addEmergencyContact: (contact) =>
    withLatency<EmergencyContact>(() => {
      const list = loadEmergency();
      if (list.length >= EMERGENCY_MAX) throw new ApiError("CONTACTS_LIMIT", "safety.contacts.limit");
      const normalized = normalizeRider({ kind: "other", ...contact });
      if (normalized.kind !== "other") throw new ApiError("RIDER_NAME", "rider.error.name");
      if (list.some((c) => c.phone === normalized.phone)) throw new ApiError("CONTACT_EXISTS", "safety.contacts.exists");
      const created: EmergencyContact = { id: genId("ec"), name: normalized.name, phone: normalized.phone };
      writeJSON(EMERGENCY_KEY, [...list, created]);
      return created;
    }, { minMs: 250, maxMs: 450 }),

  removeEmergencyContact: (id) =>
    withLatency<void>(() => {
      writeJSON(EMERGENCY_KEY, loadEmergency().filter((c) => c.id !== id));
    }, { minMs: 200, maxMs: 350 }),

  getSupportContact: () => withLatency(() => ({ phone: SUPPORT_PHONE }), { minMs: 100, maxMs: 200 }),

  getCargoRules: () => withLatency<CargoRules>(() => structuredClone(CARGO_RULES), { minMs: 100, maxMs: 250 }),

  getMarketplaceWarehouses: (fromAddressId) =>
    withLatency<Warehouse[]>(() => {
      const from = addressOf(fromAddressId);
      return WAREHOUSES.map((address) => ({
        address,
        marketplace: address.warehouse!.marketplace,
        distanceKm: address.cityId === from.cityId ? cityLegKm(from, address) : roadDistanceKm(from.cityId, address.cityId),
      })).sort((a, b) => a.distanceKm - b.distanceKm);
    }, { minMs: 200, maxMs: 400 }),

  getCargoInfo: (topic) =>
    withLatency<CargoInfo>(() => {
      if (!CARGO_RULES.infoTopics.some((t) => t.id === topic)) throw new ApiError("NOT_FOUND", "order.quoteError");
      return { titleKey: `kargo.info.${topic}.title`, paragraphKeys: [`kargo.info.${topic}.p1`, `kargo.info.${topic}.p2`] };
    }, { minMs: 150, maxMs: 300 }),

  getRideAlong: ({ vehicle, loaders }) => withLatency<RideAlong>(() => rideAlongFor(vehicle, loaders), { minMs: 100, maxMs: 250 }),

  checkCargo: (input) =>
    withLatency<CargoCheck>(() => {
      const issues: CargoCheck["issues"] = [];
      const add = (field: string, err: unknown) => {
        if (err instanceof ApiError) issues.push({ field, messageKey: err.message });
        else throw err;
      };
      try {
        priceCargo({ fromAddressId: input.fromAddressId, toAddressId: input.toAddressId, stops: input.stops, cargo: input.cargo });
      } catch (e) {
        add("route", e);
      }
      // Name and phone are checked separately so every missing field shows.
      const person = (prefix: "sender" | "receiver", name: string, phone: string) => {
        const n = name.trim();
        if (!n) issues.push({ field: `${prefix}.name`, messageKey: prefix === "receiver" ? "kargo.error.receiverName" : "rider.error.name" });
        else if (n.length > ORDER_DETAILS_RULES.riderNameMaxLength) issues.push({ field: `${prefix}.name`, messageKey: "rider.error.nameLong" });
        if (nationalDigits(phone).length !== PHONE_DIGITS) issues.push({ field: `${prefix}.phone`, messageKey: "rider.error.phone" });
      };
      if (input.sender.kind === "other") person("sender", input.sender.name, input.sender.phone);
      person("receiver", input.receiver.name, input.receiver.phone);
      return { ready: issues.length === 0, issues };
    }, { minMs: 80, maxMs: 180 }),

  applyPromoCode: (code: string) =>
    withLatency(() => {
      const normalized = code.trim().toUpperCase();
      const pct = PROMO_CODES[normalized];
      if (pct) {
        return { valid: true, discountPct: pct, message: `${pct}% chegirma qo'llandi`, messageKey: "promo.applied", code: normalized };
      }
      return { valid: false, discountPct: 0, message: "Promo-kod topilmadi yoki muddati tugagan", messageKey: "promo.invalid", code: normalized };
    }, { minMs: 300, maxMs: 600 }),

  getBonusSummary: () =>
    withLatency<BonusSummary>(() => {
      const scenarios = getTestScenarios();
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
    withLatency<OtpRequestResult>(() => ({ requestId: genId("otp"), testCode: TEST_OTP_CODE }), { minMs: 250, maxMs: 500 }),

  confirmPhoneChange: (_requestId: string, code: string, newPhone: string) =>
    withLatency(() => {
      if (code !== TEST_OTP_CODE) throw new ApiError("INVALID_CODE", "Kod noto'g'ri. Qaytadan urinib ko'ring.");
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

/** Picked by the `@active-adapter` alias when VITE_DEMO_MODE=true. */
export const adapter = mockAdapter;
