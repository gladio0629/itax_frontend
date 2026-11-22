// The one place where api/openapi.yml shapes become the driver UI's types
// (and back). Unit conversions only — tiyin ↔ so'm, metres → km, seconds →
// minutes. Nothing here decides prices, limits or permissions: every
// number and status comes from the server.
import type * as Api from "@shared/api/openapi";
import { ApiError } from "@shared/http/errors";
import type {
  Booking,
  CapabilitiesInput,
  CarClass,
  CityRef,
  DebtLevel,
  DebtState,
  DriverCapabilities,
  DriverProfile,
  HistoryItem,
  LedgerEntry,
  LedgerType,
  NotificationItem,
  NotificationKind,
  OfferPlace,
  PaymentType,
  RideRequest,
  RideTime,
  RoutesPage,
  SeatPosition,
  TimelineEvent,
  TripAction,
  TripDetail,
  TripStage,
  TripStep,
  TripWhen,
} from "./types";

// ------------------------------------------------------------------ units
export const toSom = (tiyin: number | null | undefined) => Math.round((tiyin ?? 0) / 100);
export const toTiyin = (som: number) => Math.round(som * 100);
const km = (metres: number | null | undefined) => Math.round(((metres ?? 0) / 1000) * 10) / 10;

/** "+998901234567" → "+998 90 *** ** 67". */
export function maskPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 12) return "";
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} *** ** ${d.slice(10, 12)}`;
}

/** UI phone input (9 national digits) → contract Phone. */
export const toApiPhone = (digits: string) => `+998${digits.replace(/\D/g, "").slice(-9)}`;

/** Only http(s) provider pages may be opened (never javascript: etc.). */
export function safeRedirect(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
  } catch {
    /* fall through */
  }
  throw new ApiError("UNKNOWN_ERROR");
}

// ------------------------------------------------- registration references
// No endpoint serves car models/colors (docs/backend-gaps/driver.md): static
// form choices, sent as-is; the server validates them. Cities come from
// GET /api/v1/cities; REG_CITIES is only the fallback when that fails.
export const REG_CITIES: CityRef[] = [
  "Toshkent", "Samarqand", "Buxoro", "Andijon", "Namangan", "Farg'ona", "Qarshi", "Nukus", "Xiva",
  "Jizzax", "Navoiy", "Termiz", "Guliston", "Urganch",
].map((name) => ({ id: name, name }));
export const REG_CAR_BRANDS = [
  { brand: "Chevrolet", models: ["Cobalt", "Nexia 3", "Gentra", "Malibu 2", "Onix", "Tracker", "Damas", "Labo"] },
  { brand: "Kia", models: ["K5", "Sportage"] },
  { brand: "Hyundai", models: ["Sonata", "Elantra"] },
  { brand: "BYD", models: ["Chazor", "Song Plus"] },
];
export const REG_CAR_COLORS = [
  { key: "white", hex: "#FFFFFF" },
  { key: "black", hex: "#1B1F27" },
  { key: "silver", hex: "#B9C1CB" },
  { key: "blue", hex: "#2F5DA8" },
  { key: "red", hex: "#8C1D24" },
  { key: "beige", hex: "#E9E1CF" },
  { key: "gray", hex: "#6B7280" },
];
/** Driving-licence categories under "Toifa" (no endpoint yet). */
export const REG_LICENSE_CATEGORIES = ["A", "B", "BE", "C", "D"];
export const REG_CAR_CLASSES: CarClass[] = ["economy", "comfort", "business", "minivan"];
/** Car.seats: 1–8 in the contract. */
export const REG_SEAT_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];

/** "Sardor Karimov" → first/last name (the form has one field). */
export function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) throw new ApiError("NAME_INVALID");
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

/** "Chevrolet Cobalt" → brand + model. */
export function splitCarModel(full: string): { brand: string; model: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) throw new ApiError("MODEL_REQUIRED");
  return { brand: parts[0], model: parts.slice(1).join(" ") };
}

/** Plate as typed ("01 A 123 BC") → contract form ("01A123BC"). */
export const toApiPlate = (plate: string) => plate.toUpperCase().replace(/\s+/g, "");

/** "01A123BC" → "01 A 123 BC" for display; anything else unchanged. */
export function displayPlate(plate: string): string {
  const m = /^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/.exec(plate) ?? /^(\d{2})(\d{3})([A-Z]{3})$/.exec(plate);
  return m ? m.slice(1).join(" ") : plate;
}

/** VALIDATION_ERROR `params.fields` → the field codes the screens already
 * show next to their inputs. Other errors pass through unchanged. */
export function mapFieldError(err: unknown): unknown {
  if (!(err instanceof ApiError) || err.code !== "VALIDATION_ERROR") return err;
  const fields = Object.keys((err.params.fields as Record<string, unknown> | undefined) ?? {}).join(" ");
  const pick: [RegExp, string][] = [
    [/first_name|last_name/, "NAME_INVALID"],
    [/birth_date/, "BIRTH_DATE_INVALID"],
    [/\bcity\b/, "CITY_REQUIRED"],
    [/plate/, "PLATE_INVALID"],
    [/brand|model/, "MODEL_REQUIRED"],
    [/color/, "COLOR_REQUIRED"],
    [/car_class/, "CAR_CLASS_REQUIRED"],
    [/seats/, "SEATS_REQUIRED"],
    [/documents|step_3/, "DOCS_REQUIRED"],
    [/phone/, "PHONE_INVALID"],
    [/code/, "CODE_INVALID"],
    [/amount/, "AMOUNT_INVALID"],
  ];
  for (const [re, code] of pick) if (re.test(fields)) return new ApiError(code, code, { params: err.params, status: err.status });
  return err;
}

// ---------------------------------------------------------------- places
/** City id → name, from GET /api/v1/cities. Empty when the catalogue couldn't be read. */
export type CityNames = ReadonlyMap<string, string>;

/** A contract GeoPoint: the city comes from the catalogue (`*_city_id`) when known,
 * the address line from the point. Without a city the address is the place name. */
export function placeOf(p: Api.GeoPoint, cityId: string | null | undefined, cities: CityNames): OfferPlace {
  const address = p.address?.trim() ?? "";
  const cityName = cityId ? cities.get(cityId) : undefined;
  // The coordinates go along for the map.
  if (cityName && cityId) return { city: { id: cityId, name: cityName }, address: address === cityName ? "" : address, lat: p.lat, lng: p.lng };
  return { city: { id: "", name: address || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` }, address: "", lat: p.lat, lng: p.lng };
}

// ------------------------------------------------------------------ times
const DAY_MS = 86_400_000;
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const isoDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Pickup time as the server sent it: `scheduled_at` (exact) or
 * `scheduled_from`–`scheduled_to` (window). None = "now": no `when`. */
export function whenOf(at?: string | null, from?: string | null, to?: string | null): TripWhen | undefined {
  const exact = at ? Date.parse(at) : NaN;
  const a = from ? Date.parse(from) : NaN;
  const b = to ? Date.parse(to) : NaN;
  const time: RideTime | null = !Number.isNaN(exact)
    ? { kind: "exact", at: exact }
    : !Number.isNaN(a) && !Number.isNaN(b)
      ? { kind: "interval", from: a, to: b }
      : null;
  if (!time) return undefined;
  const dayStart = startOfDay(time.kind === "exact" ? time.at : time.from);
  return { date: isoDay(dayStart), dayOffset: Math.round((dayStart - startOfDay(Date.now())) / DAY_MS), dayStart, time };
}

const parseTime = (s: string | null | undefined) => {
  const v = s ? Date.parse(s) : NaN;
  return Number.isNaN(v) ? undefined : v;
};

// ----------------------------------------------------------------- orders
/** Only cash and card have a label in the driver UI; wallet etc. stay unlabelled. */
export function paymentOf(m: Api.PaymentMethod | undefined): PaymentType | undefined {
  if (m === "cash") return "cash";
  if (m === "card" || m === "payme" || m === "click") return "card";
  return undefined;
}

const SEAT_POSITIONS: readonly SeatPosition[] = ["front", "back-left", "back-mid", "back-right"];
const seatIdsOf = (ids: Api.SeatId[] | undefined): SeatPosition[] | undefined => {
  const out = (ids ?? []).filter((s): s is SeatPosition => SEAT_POSITIONS.includes(s as SeatPosition));
  return out.length ? out : undefined;
};

/** The parts shared by an offer and an accepted order. */
function orderFields(o: Api.Offer | Api.Order, cities: CityNames) {
  const seats = o.seats ?? o.seat_ids?.length ?? 0;
  return {
    pickup: placeOf(o.from, o.from_city_id, cities),
    dropoff: placeOf(o.to, o.to_city_id, cities),
    kind: o.type === "delivery" ? ("delivery" as const) : ("passengers" as const),
    seats,
    wholeCar: o.type === "passenger" && !seats && !!o.car_class,
    when: whenOf(o.scheduled_at, o.scheduled_from, o.scheduled_to),
    payment: paymentOf(o.payment_method),
    carClass: o.car_class,
    seatIds: seatIdsOf(o.seat_ids),
    stops: [],
    comment: o.comment?.trim() || null,
    luggageCount: 0,
    forOther: null,
    freight: null,
  };
}

// ----------------------------------------------------------------- offers
export function offerToRequest(o: Api.Offer, cities: CityNames): RideRequest {
  const price = toSom(o.price);
  const net = o.commission == null ? price : toSom(o.price - o.commission);
  return {
    ...orderFields(o, cities),
    id: o.id,
    directionId: "",
    price,
    earnings: { net },
    distanceKm: km(o.distance_m),
    durationMin: 0,
    pickupEtaMin: o.pickup_eta_s == null ? undefined : Math.max(1, Math.round(o.pickup_eta_s / 60)),
    postedAt: parseTime(o.created_at),
    status: "open",
    acceptBlock: null,
  };
}

/** UI reject reasons (i18n keys) ↔ OfferReject.reason. */
export const REJECT_REASON_KEY: Record<Api.OfferRejectReason, string> = {
  too_far: "reject.reason.far",
  bad_price: "reject.reason.price",
  busy: "reject.reason.busy",
  other: "reject.reason.other",
};

/** UI cancel reasons (i18n keys) ↔ TripCancel.reason. */
export const CANCEL_REASON_KEY: Record<Api.TripCancelReason, string> = {
  passenger_no_show: "cancel.reason.passengerNoShow",
  passenger_asked: "cancel.reason.passengerAsked",
  car_problem: "cancel.reason.carIssue",
  emergency: "cancel.reason.emergency",
  other: "cancel.reason.other",
};

export const reasonFromKey = <R extends string>(table: Record<R, string>, key: string | undefined): R | undefined =>
  (Object.keys(table) as R[]).find((r) => table[r] === key);

// ------------------------------------------------------------------ trips
// Progress display only: which of the four steps the trip has reached,
// from the server's status and timestamps. The button is next_actions'.
const STEP_ORDER: TripStage[] = ["to_pickup", "waiting", "in_progress", "completed"];
const ACTION_OF: Partial<Record<Api.TripAction, TripAction>> = { arrive: "arrived", start: "start", complete: "finish" };

/** The server action behind the step button: the first step action in `next_actions`, in its order. */
export const stepActionOf = (t: Api.Trip): Api.TripAction | undefined => (t.next_actions ?? []).find((a) => !!ACTION_OF[a]);

function stageOf(t: Api.Trip): TripStage {
  if (t.status === "completed" || t.status === "cancelled") return "completed";
  if (t.status === "in_progress") return "in_progress";
  return t.arrived_at ? "waiting" : "to_pickup";
}

/** A trip with its order. The step button is the first step the server lists in
 * `next_actions` (in its order); cancel only when the server lists it. */
export function tripToBooking(t: Api.TripWithOrder, cities: CityNames): Booking {
  const stage = stageOf(t);
  const at = STEP_ORDER.indexOf(stage);
  const steps: TripStep[] = STEP_ORDER.map((s, i) => ({ stage: s, state: i < at || stage === "completed" ? "done" : i === at ? "active" : "upcoming" }));
  const actions = t.next_actions ?? [];
  const serverStep = stepActionOf(t);
  const step = (serverStep && ACTION_OF[serverStep]) ?? null;
  const price = toSom(t.final_price ?? t.order.price);
  return {
    ...orderFields(t.order, cities),
    id: t.id,
    directionId: "",
    stage,
    steps,
    nextAction: step,
    canCancel: actions.includes("cancel"),
    pendingReviewId: null,
    // Not in the contract: no passenger row, no call button.
    passenger: undefined,
    price,
    // The order carries no commission; the server gives it on completion.
    earnings: t.final_price != null && t.commission != null ? { net: toSom(t.final_price - t.commission) } : undefined,
    acceptedAt: Date.parse(t.order.created_at) || 0,
  };
}

const CANCEL_KEY_OF: Record<string, string> = CANCEL_REASON_KEY;

function historyBase(t: Api.TripWithOrder, cities: CityNames): HistoryItem {
  const o = t.order;
  const cancelled = t.status === "cancelled";
  return {
    id: t.id,
    // When the trip ended (or the order was placed, if the server gives no end time).
    createdAt: parseTime(t.completed_at) ?? parseTime(t.cancelled_at) ?? parseTime(t.started_at) ?? (Date.parse(o.created_at) || 0),
    from: placeOf(o.from, o.from_city_id, cities).city,
    to: placeOf(o.to, o.to_city_id, cities).city,
    passengerName: "",
    earnings: !cancelled && t.final_price != null ? toSom(t.final_price - (t.commission ?? 0)) : 0,
    payment: paymentOf(o.payment_method),
    ratingReceived: null,
    status: cancelled ? "cancelled" : "completed",
    kind: o.type === "delivery" ? "delivery" : "passengers",
  };
}

export const tripToHistoryItem = (t: Api.TripWithOrder, cities: CityNames): HistoryItem => historyBase(t, cities);

export function tripToDetail(t: Api.TripWithOrder, cities: CityNames): TripDetail {
  const o = t.order;
  // Trip has no accepted-at time: the timeline starts at "arrived" when there is one.
  const timeline: TimelineEvent[] = [];
  const events: [TimelineEvent["stage"], string | null | undefined][] = [
    ["arrived", t.arrived_at],
    ["started", t.started_at],
    ["completed", t.completed_at],
    ["cancelled", t.cancelled_at],
  ];
  for (const [stage, iso] of events) {
    const at = parseTime(iso);
    if (at != null) timeline.push({ stage, at });
  }
  timeline.sort((x, y) => x.at - y.at);
  const gross = toSom(t.final_price ?? o.price);
  const commission = t.commission == null ? 0 : toSom(t.commission);
  return {
    ...historyBase(t, cities),
    pickup: placeOf(o.from, o.from_city_id, cities),
    dropoff: placeOf(o.to, o.to_city_id, cities),
    distanceKm: km(t.distance_m ?? o.distance_m),
    durationMin: o.duration_s ? Math.max(1, Math.round(o.duration_s / 60)) : 0,
    passenger: undefined,
    passengers: o.type === "passenger" ? o.seats ?? o.seat_ids?.length : undefined,
    timeline,
    breakdown: { base: gross, commission, bonusDiscount: 0, net: t.final_price == null ? 0 : toSom(t.final_price - (t.commission ?? 0)) },
    // Admin cancels use the admin reason list: shown as "cancelled by an operator".
    cancelReasonKey: t.cancelled_by === "admin" ? "cancel.byAdmin" : t.cancel_reason ? CANCEL_KEY_OF[t.cancel_reason] : undefined,
  };
}

// ----------------------------------------------------------------- routes
export function toRoutesPage(r: Api.DriverRoutes, cities: CityRef[]): RoutesPage {
  const names = new Map(cities.map((c) => [c.id, c.name]));
  const ref = (id: string): CityRef => ({ id, name: names.get(id) ?? "—" });
  return {
    routes: r.routes.map((x, i) => ({ id: x.id ?? `route-${i}`, a: ref(x.a_city_id), b: ref(x.b_city_id), bothWays: x.both_ways })),
    cities,
  };
}

export const toRoutesInput = (routes: RoutesPage["routes"]): Api.DriverRoutesInput => ({
  routes: routes.map((r) => ({ a_city_id: r.a.id, b_city_id: r.b.id, both_ways: r.bothWays })),
});

/** 422 on PUT /drivers/me/routes: `routes.N.b_city_id: same_as_a`, `routes.N: duplicate`. */
export function mapRoutesError(err: unknown): unknown {
  if (!(err instanceof ApiError) || err.code !== "VALIDATION_ERROR") return err;
  const fields = (err.params.fields as Record<string, unknown> | undefined) ?? {};
  const init = { params: err.params, status: err.status };
  for (const [k, v] of Object.entries(fields)) {
    if (/^routes\.\d+\.b_city_id$/.test(k) && v === "same_as_a") return new ApiError("ROUTE_SAME_CITY", "ROUTE_SAME_CITY", init);
    if (/^routes\.\d+$/.test(k) && v === "duplicate") return new ApiError("ROUTE_EXISTS", "ROUTE_EXISTS", init);
    // maxItems 10 (the server's array-size error on the list itself).
    if (k === "routes") return new ApiError("ROUTES_TOO_MANY", "ROUTES_TOO_MANY", init);
  }
  return err;
}

// ----------------------------------------------------------- capabilities
/** The contract's child-seat age groups, in its enum order. */
/** Expected cargo-capabilities body (docs/backend-gaps/driver.md, "Redesign v2"). */
export type ApiCargoCapabilities = { body_sizes: string[]; available_body_sizes?: string[]; loader_help: boolean };
const BODY_SIZE_ORDER = ["S", "M", "L", "XL", "XXL", "3XL"];

export function toCapabilities(c: ApiCargoCapabilities, car: Api.Car | undefined): DriverCapabilities {
  return {
    bodySizes: c.body_sizes,
    availableBodySizes: c.available_body_sizes?.length ? c.available_body_sizes : BODY_SIZE_ORDER,
    loaderHelp: c.loader_help,
    carModel: car ? `${car.brand} ${car.model}`.trim() : undefined,
    carClass: car?.car_class,
  };
}

export function toApiCapabilities(input: CapabilitiesInput): ApiCargoCapabilities {
  return { body_sizes: input.bodySizes, loader_help: input.loaderHelp };
}

// ----------------------------------------------------------------- driver
export function toDriverProfile(p: Api.DriverProfile): DriverProfile {
  const car = p.car;
  return {
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(" "),
    phoneMasked: maskPhone(p.phone),
    avatarSeed: p.id,
    rating: p.rating ?? 0,
    totalTrips: p.trips_count,
    car: car
      ? {
          model: `${car.brand} ${car.model}`.trim(),
          color: car.color,
          colorHex: REG_CAR_COLORS.find((c) => c.key === car.color)?.hex ?? "#9CA3AF",
          plate: displayPlate(car.plate_number),
          year: car.year,
        }
      : undefined,
    documents: [],
  };
}

// ----------------------------------------------------------------- wallet
const LEVEL_OF: Record<NonNullable<Api.WalletBalance["debt_status"]>, DebtLevel> = {
  ok: "ok",
  approaching: "near",
  at_limit: "blocked",
};

export function toDebtState(b: Api.WalletBalance): DebtState {
  const limit = -Math.abs(toSom(b.debt_limit));
  const debt = Math.abs(toSom(b.debt));
  return {
    level: b.debt_status ? LEVEL_OF[b.debt_status] : b.limit_reached ? "blocked" : "ok",
    balance: toSom(b.balance),
    limit,
    debtAmount: debt,
    // Progress-bar fill only: the server's two numbers side by side.
    usedRatio: limit === 0 ? 0 : Math.min(1, debt / Math.abs(limit)),
  };
}

const LEDGER_TYPE: Record<Api.LedgerKind, LedgerType> = {
  trip_payment: "trip",
  commission: "commission",
  topup: "topup",
  correction: "correction",
  bonus: "bonus",
};

export function toLedgerEntry(e: Api.LedgerEntry): LedgerEntry {
  return {
    id: e.id,
    type: LEDGER_TYPE[e.kind] ?? "correction",
    amount: toSom(e.amount),
    createdAt: Date.parse(e.created_at),
    descKey: `ledger.kind.${e.kind}`,
    balanceAfter: toSom(e.balance_after),
  };
}

// ---------------------------------------------------------- notifications
const NOTIFICATION_KIND: Record<Api.NotificationKind, NotificationKind> = {
  order: "order",
  trip: "order",
  wallet: "wallet",
  driver: "docs",
  system: "news",
  promo: "bonus",
};

export function toNotification(n: Api.Notification): NotificationItem {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(n.params ?? {})) if (typeof v === "string" || typeof v === "number") params[k] = v;
  return {
    id: n.id,
    kind: NOTIFICATION_KIND[n.kind] ?? "news",
    titleKey: n.title_key,
    bodyKey: n.body_key ?? "",
    params,
    createdAt: Date.parse(n.created_at),
    read: n.read,
  };
}
