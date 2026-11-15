// The one place where api/openapi.yml shapes become the driver UI's types
// (and back). Unit conversions only — tiyin ↔ so'm, metres → km, seconds →
// minutes. Nothing here decides prices, limits or permissions: every
// number and status comes from the server.
import type * as Api from "@shared/api/openapi";
import { ApiError } from "@shared/http/errors";
import type {
  Booking,
  CarClass,
  CityRef,
  DebtLevel,
  DebtState,
  DriverProfile,
  LedgerEntry,
  LedgerType,
  NotificationItem,
  NotificationKind,
  OfferPlace,
  RideRequest,
  TripStage,
  TripStep,
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
// No endpoint serves these yet (docs/backend-gaps/driver.md): static form
// choices so the registration form can be filled in. They are sent as-is;
// the server validates them.
export const REG_CITIES: CityRef[] = [
  "Toshkent", "Samarqand", "Buxoro", "Andijon", "Namangan", "Farg'ona", "Qarshi", "Nukus", "Xiva",
  "Jizzax", "Navoiy", "Termiz", "Guliston", "Urganch",
].map((name) => ({ id: name, name }));
export const REG_CAR_MODELS = [
  "Chevrolet Cobalt", "Chevrolet Nexia 3", "Chevrolet Gentra", "Chevrolet Malibu 2",
  "Chevrolet Onix", "Chevrolet Tracker", "Kia K5", "Hyundai Sonata",
];
export const REG_CAR_COLORS = [
  { key: "white", hex: "#F4F6F5" },
  { key: "silver", hex: "#C9CFCD" },
  { key: "black", hex: "#1C2420" },
  { key: "blue", hex: "#3B6FA0" },
  { key: "gray", hex: "#6B7280" },
];
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
/** A contract GeoPoint has only an address line: shown as the place name. */
export function placeOf(p: Api.GeoPoint): OfferPlace {
  const name = p.address?.trim() || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
  return { city: { id: "", name }, address: "" };
}

// ----------------------------------------------------------------- offers
export function offerToRequest(o: Api.Offer): RideRequest {
  const price = toSom(o.price);
  const net = o.commission == null ? price : toSom(o.price - o.commission);
  const wholeCar = o.type === "passenger" && !o.seats && !!o.car_class;
  return {
    id: o.id,
    directionId: "",
    pickup: placeOf(o.from),
    dropoff: placeOf(o.to),
    kind: o.type === "delivery" ? "delivery" : "passengers",
    seats: o.seats ?? 0,
    wholeCar,
    price,
    earnings: { net },
    distanceKm: km(o.distance_m),
    durationMin: 0,
    pickupEtaMin: o.pickup_eta_s == null ? undefined : Math.max(1, Math.round(o.pickup_eta_s / 60)),
    status: "open",
    acceptBlock: null,
    carClass: o.car_class,
    stops: [],
    comment: null,
    options: [],
    luggageCount: 0,
    forOther: null,
    contactMode: "call",
    freight: null,
  };
}

// ------------------------------------------------------------------ trips
const STAGE_OF: Record<Api.TripStatus, TripStage> = {
  assigned: "to_pickup",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "completed",
};
// The contract has no "arrived" call: three steps.
const STEP_ORDER: TripStage[] = ["to_pickup", "in_progress", "completed"];

/** A trip the driver accepted, shown with the offer it came from. The only
 * calls the contract has are start (assigned) and complete (in_progress);
 * the server answers 403 if the trip isn't in that state. */
export function tripToBooking(trip: Api.Trip, offer: RideRequest, acceptedAt: number): Booking {
  const stage = STAGE_OF[trip.status];
  const at = STEP_ORDER.indexOf(stage);
  const steps: TripStep[] = STEP_ORDER.map((s, i) => ({ stage: s, state: i < at || stage === "completed" ? "done" : i === at ? "active" : "upcoming" }));
  return {
    ...offer,
    id: trip.id,
    stage,
    steps,
    nextAction: trip.status === "assigned" ? "start" : trip.status === "in_progress" ? "finish" : null,
    pendingReviewId: null,
    passenger: undefined,
    pickup: offer.pickup,
    dropoff: offer.dropoff,
    stops: [],
    price: trip.final_price == null ? offer.price : toSom(trip.final_price),
    earnings:
      trip.final_price != null && trip.commission != null ? { net: toSom(trip.final_price - trip.commission) } : offer.earnings,
    acceptedAt,
  };
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
