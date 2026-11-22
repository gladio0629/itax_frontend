// Every conversion between the contract's shapes (api/openapi.yml, typed in
// shared/api/openapi.ts) and the client UI's types lives here. Conversions
// only: no prices, statuses or rules are computed — those come from the
// server as they are.
import type * as Api from "@shared/api/openapi";
import { uz } from "@/lib/i18n/uz";
import type {
  AddressDetails,
  CarClassId,
  City,
  DeliveryVehicleSpec,
  Driver,
  NotificationItem,
  NotificationPrefs,
  OrderStatus,
  OrderTiming,
  OrderWithDetails,
  PassengerWalletEntry,
  PaymentMethod,
  PayMethod,
  Profile,
  Quote,
  QuoteLine,
  RouteSuggestion,
  Seat,
  WalletSummary,
} from "./types";

// ------------------------------------------------------------------- money
/** API money is integer tiyin; the UI shows so'm. */
export const somFromTiyin = (tiyin: number | null | undefined): number => Math.round((tiyin ?? 0) / 100);
export const tiyinFromSom = (som: number): number => Math.round(som * 100);

/** Metres → km with one decimal (the UI's unit). */
const kmFromM = (m: number | null | undefined): number => (m != null ? Math.round(m / 100) / 10 : 0);

// ------------------------------------------------------------------- phone
/** "+998 90 123 45 67" (UI) → "+998901234567" (contract pattern). */
export function toApiPhone(uiPhone: string): string {
  const digits = uiPhone.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  return `+998${local.slice(-9)}`;
}

/** "+998901234567" → "+998 90 *** ** 67" (how the UI shows a phone). */
export function maskPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 12) return "";
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} *** ** ${d.slice(10, 12)}`;
}

// ------------------------------------------------------------------ orders
/** The UI has no "arrived" or "expired" step: arrived is still "driver on
 * the way" (accepted), expired is "no driver found". */
const STATUS: Record<Api.OrderStatus, OrderStatus> = {
  searching: "searching",
  accepted: "accepted",
  arrived: "accepted",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
  expired: "no_driver",
};

/** UI class ids ↔ the contract's CarClass. */
const CAR_CLASS: Record<CarClassId, Api.CarClass> = {
  standart: "economy",
  komfort: "comfort",
  biznes: "business",
  miniven: "minivan",
};
export const toApiCarClass = (c: CarClassId): Api.CarClass => CAR_CLASS[c];
export const toUiCarClass = (c: Api.CarClass): CarClassId =>
  (Object.keys(CAR_CLASS) as CarClassId[]).find((k) => CAR_CLASS[k] === c) ?? "standart";

/** A breakdown line: the key is already the UI's i18n key. A key this app
 * has no text for is shown under a generic label (amount unchanged). */
export function toUiLine(l: Api.PriceLine): QuoteLine {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(l.params ?? {})) if (typeof v === "string" || typeof v === "number") params[k] = v;
  return { key: l.key in uz ? l.key : "quote.other", params, amount: somFromTiyin(l.amount) };
}

export function toUiQuote(q: Api.Quote): Quote {
  return {
    distanceKm: kmFromM(q.distance_m),
    lines: q.lines.map(toUiLine),
    total: somFromTiyin(q.price),
    currency: "som",
    // No pickup ETA in the contract: etaMinutes / arrivalAt stay unset.
    durationMinutes: Math.round(q.duration_s / 60),
  };
}

export const toUiSeat = (s: Api.SeatMap["seats"][number]): Seat => ({ id: s.id, position: s.id, taken: s.taken, price: somFromTiyin(s.price) });

export function toUiCity(c: Api.City): City {
  return { id: c.id, name: c.name, region: c.region, lat: c.lat, lng: c.lng };
}

/** price_from null = the server couldn't price it: no price, not 0. */
export function toUiPopularRoute(r: Api.PopularRoute): RouteSuggestion {
  return {
    fromCityId: r.from.city_id,
    toCityId: r.to.city_id,
    distanceKm: kmFromM(r.distance_m),
    fromPrice: r.price_from === null ? null : somFromTiyin(r.price_from),
    label: `${r.from.address} \u2192 ${r.to.address}`,
  };
}

/** vehicle_type is the UI's vehicle id (spark…fura). */
export function toUiVehicle(v: Api.DeliveryVehicleSpec): DeliveryVehicleSpec {
  return {
    id: v.vehicle_type,
    sizeLabel: v.size_label,
    descKey: `cargo.desc.${v.vehicle_type}`,
    dimensionsCm: { width: v.dimensions_cm.width, depth: v.dimensions_cm.depth, height: v.dimensions_cm.height },
    maxWeightKg: v.max_weight_kg,
  };
}

/** Saved place details ↔ the UI's Tafsilotlar (same five fields). */
export function toUiDetails(d: Api.PlaceDetails | null | undefined): AddressDetails | undefined {
  if (!d) return undefined;
  const out: AddressDetails = {};
  for (const k of ["entrance", "floor", "apartment", "intercom", "note"] as const) if (d[k]) out[k] = d[k];
  return Object.keys(out).length ? out : undefined;
}
export function toApiDetails(d: AddressDetails | undefined): Api.PlaceDetails | undefined {
  if (!d) return undefined;
  const out: Api.PlaceDetails = {};
  for (const k of ["entrance", "floor", "apartment", "intercom", "note"] as const) {
    const v = d[k]?.trim();
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

// ------------------------------------------------------------------ timing
const pad = (n: number) => String(n).padStart(2, "0");
function localDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Legacy "today"/"tomorrow" → an ISO date (local). */
function resolveDay(date: string, now = new Date()): string {
  if (date === "today") return localDay(now);
  if (date === "tomorrow") return localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  return date;
}
/** A local day + "HH:MM" as ISO 8601 with the device's UTC offset. */
export function localIso(day: string, hhmm: string): string {
  const d = new Date(`${day}T${hhmm}:00`);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return `${localDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

type ApiTiming = Pick<Api.OrderCreate, "scheduled_at" | "scheduled_from" | "scheduled_to">;
/** "Haydovchi istagan" → no time fields; one day + exact time →
 * scheduled_at; a date range and/or a time window → scheduled_from (first
 * day + start) … scheduled_to (last day + end). */
export function toApiTiming(t: OrderTiming | undefined): ApiTiming {
  if (!t || t.timeMode !== "scheduled") return {};
  const first = resolveDay(t.date);
  const last = t.dateEnd ? resolveDay(t.dateEnd) : first;
  if (t.timeKind === "range" && t.timeRange) {
    return { scheduled_from: localIso(first, t.timeRange.from), scheduled_to: localIso(last, t.timeRange.to) };
  }
  if (!t.time) return {};
  if (last !== first) return { scheduled_from: localIso(first, t.time), scheduled_to: localIso(last, t.time) };
  return { scheduled_at: localIso(first, t.time) };
}

const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** The order's requested time back in the UI's shape (local time). */
export function toUiTiming(o: Pick<Api.Order, "scheduled_at" | "scheduled_from" | "scheduled_to">): OrderTiming {
  if (o.scheduled_at) {
    const d = new Date(o.scheduled_at);
    if (!Number.isNaN(d.getTime())) return { timeMode: "scheduled", date: localDay(d), timeKind: "exact", time: hhmm(d) };
  }
  if (o.scheduled_from && o.scheduled_to) {
    const a = new Date(o.scheduled_from);
    const b = new Date(o.scheduled_to);
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
      const date = localDay(a);
      const dateEnd = localDay(b) !== date ? localDay(b) : undefined;
      // Same clock time on several days = an exact time on any of them.
      if (dateEnd && hhmm(a) === hhmm(b)) return { timeMode: "scheduled", date, dateEnd, timeKind: "exact", time: hhmm(a) };
      return { timeMode: "scheduled", date, dateEnd, timeKind: "range", timeRange: { from: hhmm(a), to: hhmm(b) } };
    }
  }
  return { timeMode: "now" };
}

/** The UI knows cash and card; wallet / Payme / Click are card-like. */
export const toUiPayment = (p: Api.PaymentMethod): PaymentMethod => (p === "cash" ? "cash" : "card");
export const toApiPayment = (p: PayMethod): Api.PaymentMethod => p;

/** A GeoPoint shown where the UI expects a city: its address text. */
export function placeAsCity(point: Api.GeoPoint): City {
  const name = point.address?.trim() || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
  return { id: "", name, region: "", lat: point.lat, lng: point.lng };
}

function toUiDriver(d: Api.OrderDriver): Driver {
  const car = d.car;
  return {
    id: d.id ?? "",
    name: d.first_name ?? "",
    // The contract gives no driver phone (calls are unavailable in the UI).
    phoneMasked: "",
    cityId: "",
    carModel: car ? `${car.brand} ${car.model}`.trim() : "",
    carColor: car?.color ?? "",
    // No colour code in the contract: a neutral swatch.
    carColorHex: "#9ca3af",
    plate: car?.plate_number ?? "",
    rating: d.rating ?? 0,
    totalTrips: 0,
    online: true,
    walletBalance: 0,
    documentsStatus: "approved",
    avatarSeed: d.id ?? d.first_name ?? "driver",
    joinedAt: 0,
  };
}

/** Order.cancel_reason (passenger or admin enum value) → UI text key. */
const CANCEL_REASON_KEY: Record<string, string> = {
  changed_plans: "cancel.reason.plansChanged",
  long_wait: "cancel.reason.waitedTooLong",
  driver_asked: "cancel.reason.driverAsked",
  wrong_address: "cancel.reason.wrongAddress",
  other: "cancel.reason.other",
  admin_decision: "cancel.reason.byAdmin",
  passenger_request: "cancel.reason.byAdmin",
  driver_request: "cancel.reason.byAdmin",
  duplicate: "cancel.reason.byAdmin",
  fraud: "cancel.reason.byAdmin",
};

/** `points`: the adapter's ids for the order's from/to (its address book). */
/** Only an https link is opened in the browser. */
function httpsUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  try {
    return new URL(v).protocol === "https:" ? v : undefined;
  } catch {
    return undefined;
  }
}

export function toUiOrder(o: Api.Order, extra: { rating?: number; fromAddressId?: string; toAddressId?: string } = {}): OrderWithDetails {
  const seatIds = o.seat_ids?.length ? [...o.seat_ids] : Array.from({ length: o.seats ?? 0 }, (_, i) => `seat-${i + 1}`);
  const perSeat = o.type === "passenger" && (o.seat_ids?.length || o.seats);
  return {
    id: o.id,
    passengerId: "",
    driverId: o.driver?.id ?? null,
    fromCityId: o.from_city_id ?? "",
    toCityId: o.to_city_id ?? "",
    distanceKm: kmFromM(o.distance_m),
    mode: perSeat ? "seat" : "car",
    // Real positions when the order has them; an old count-only order keeps
    // placeholder ids (no position is shown as picked).
    seatIds,
    price: somFromTiyin(o.price),
    paymentMethod: toUiPayment(o.payment_method),
    status: STATUS[o.status] ?? "searching",
    createdAt: Date.parse(o.created_at) || Date.now(),
    rating: extra.rating,
    cancelReason: o.cancel_reason ? CANCEL_REASON_KEY[o.cancel_reason] ?? "cancel.reason.other" : undefined,
    driver: o.driver ? toUiDriver(o.driver) : undefined,
    fromCity: placeAsCity(o.from),
    toCity: placeAsCity(o.to),
    // No rating verdict in the contract: let it through, show a 403.
    ratingEditable: true,
    editable: o.editable === true,
    canCancel: o.can_cancel === true,
    driverArrived: o.status === "arrived",
    priceLines: o.price_lines?.length ? o.price_lines.map(toUiLine) : undefined,
    // Not in the contract yet (backend-gaps/client.md, Payme / Click): used if present.
    paymentUrl: httpsUrl((o as { payment?: { redirect_url?: unknown } }).payment?.redirect_url),
    extras: {
      fromAddressId: extra.fromAddressId ?? "",
      toAddressId: extra.toAddressId ?? "",
      timing: toUiTiming(o),
      serviceType: o.type,
      cargo: o.vehicle_type ? { vehicle: o.vehicle_type } : undefined,
      carClass: o.car_class ? toUiCarClass(o.car_class) : undefined,
      comment: o.comment ?? undefined,
    },
  };
}

/** Same order again (repeat search): everything the client chose. */
export function orderCreateFrom(o: Api.Order): Api.OrderCreate {
  const body: Api.OrderCreate = {
    type: o.type,
    from: o.from,
    to: o.to,
    payment_method: o.payment_method,
  };
  if (o.type === "delivery" && o.vehicle_type) body.vehicle_type = o.vehicle_type;
  else if (o.seat_ids?.length) body.seat_ids = [...o.seat_ids];
  else if (o.seats) body.seats = o.seats;
  else if (o.car_class) body.car_class = o.car_class;
  if (o.comment) body.comment = o.comment;
  return body;
}

/** UI cancel reasons are translation keys. The contract's enum has no
 * "price reconsidered" / "chose another way": those go as "other". */
const CANCEL_REASON: Record<string, Api.OrderCancelReason> = {
  "cancel.reason.plansChanged": "changed_plans",
  "cancel.reason.waitedTooLong": "long_wait",
  "cancel.reason.priceReconsidered": "other",
  "cancel.reason.choseAnotherWay": "other",
  "cancel.reason.other": "other",
};
export const toApiCancel = (uiReason: string): Api.OrderCancel => ({ reason: CANCEL_REASON[uiReason] ?? "other" });

/** UI: several reasons + an "other" note. Contract: one reason, only (and
 * always) with 5 stars. The first applicable choice is sent. */
const RATING_REASON: Record<string, Api.RatingReasonKind> = {
  "history.reason.polite": "polite",
  "history.reason.conversation": "good_talk",
  "history.reason.comfort": "comfort",
  "history.reason.simple": "just_because",
};
/** RatingInput keeps one reason, and only with 5 stars. A comment goes as
 * the "custom" reason (it says the most); otherwise the first known chip. */
export function toApiRating(stars: number, reasons: string[] = [], note?: string): Api.RatingInput {
  if (stars !== 5) return { stars };
  const text = note?.trim();
  if (text) return { stars, reason: { kind: "custom", custom_text: text.slice(0, 200) } };
  for (const r of reasons) if (RATING_REASON[r]) return { stars, reason: { kind: RATING_REASON[r] } };
  return { stars, reason: { kind: "just_because" } };
}

// ----------------------------------------------------------------- profile
export function toUiProfile(p: Api.Profile, tripsCount = 0): Profile {
  const firstName = p.first_name ?? "";
  const lastName = p.last_name ?? "";
  return {
    id: p.id,
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    phoneMasked: maskPhone(p.phone),
    avatarSeed: p.id,
    rating: p.rating ?? 0,
    // Not in the contract's Profile.
    totalTrips: tripsCount,
  };
}

/** master ↔ push, news ↔ promo. The contract has no separate order-status
 * or bonus switch (those rows are hidden in http mode). */
export function toUiPrefs(s: Api.Settings): NotificationPrefs {
  const n = s.notifications ?? {};
  const push = n.push ?? true;
  const promo = n.promo ?? true;
  return { master: push, orderStatus: push, news: promo, bonus: promo };
}
export function toApiSettings(current: Api.Settings, patch: Partial<NotificationPrefs>): Api.Settings {
  const n = current.notifications ?? {};
  return {
    notifications: {
      push: patch.master ?? n.push ?? true,
      sms: n.sms ?? true,
      promo: patch.news ?? patch.bonus ?? n.promo ?? true,
    },
  };
}

// ----------------------------------------------------------- notifications
const NOTIFICATION_KIND: Record<Api.NotificationKind, NotificationItem["kind"]> = {
  order: "order",
  trip: "order",
  wallet: "wallet",
  promo: "promo",
  driver: "system",
  system: "system",
};
function toParams(params: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (typeof v === "string" || typeof v === "number") out[k] = v;
  }
  return out;
}
export function toUiNotification(n: Api.Notification): NotificationItem {
  return {
    id: n.id,
    title: "",
    body: "",
    titleKey: n.title_key,
    bodyKey: n.body_key,
    params: toParams(n.params),
    createdAt: Date.parse(n.created_at) || Date.now(),
    read: n.read,
    kind: NOTIFICATION_KIND[n.kind] ?? "system",
  };
}

// ------------------------------------------------------------------ wallet
const LEDGER_TYPE: Record<Api.LedgerKind, PassengerWalletEntry["type"]> = {
  trip_payment: "trip_payment",
  commission: "commission",
  topup: "topup",
  correction: "correction",
  bonus: "bonus",
};
export function toUiWallet(b: Api.WalletBalance, ledger: Api.LedgerEntry[]): WalletSummary {
  return {
    balance: somFromTiyin(b.balance),
    // The server's own verdict on the balance.
    lowBalance: b.limit_reached || (b.debt_status != null && b.debt_status !== "ok"),
    entries: ledger.map((e) => ({
      id: e.id,
      type: LEDGER_TYPE[e.kind] ?? "correction",
      amount: somFromTiyin(e.amount),
      balanceAfter: somFromTiyin(e.balance_after),
      createdAt: Date.parse(e.created_at) || Date.now(),
      orderId: e.reference_id ?? undefined,
    })),
  };
}
