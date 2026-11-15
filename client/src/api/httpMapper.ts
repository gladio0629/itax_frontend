// Every conversion between the contract's shapes (api/openapi.yml, typed in
// shared/api/openapi.ts) and the client UI's types lives here. Conversions
// only: no prices, statuses or rules are computed — those come from the
// server as they are.
import type * as Api from "@shared/api/openapi";
import type {
  City,
  Driver,
  NotificationItem,
  NotificationPrefs,
  OrderStatus,
  OrderWithDetails,
  PassengerWalletEntry,
  PaymentMethod,
  Profile,
  WalletSummary,
} from "./types";

// ------------------------------------------------------------------- money
/** API money is integer tiyin; the UI shows so'm. */
export const somFromTiyin = (tiyin: number | null | undefined): number => Math.round((tiyin ?? 0) / 100);
export const tiyinFromSom = (som: number): number => Math.round(som * 100);

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

/** The UI knows cash and card; wallet / Payme / Click are card-like. */
const toUiPayment = (p: Api.PaymentMethod): PaymentMethod => (p === "cash" ? "cash" : "card");
export const toApiPayment = (p: PaymentMethod): Api.PaymentMethod => p;

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

export function toUiOrder(o: Api.Order, extra: { rating?: number } = {}): OrderWithDetails {
  const seats = o.seats ?? 0;
  return {
    id: o.id,
    passengerId: "",
    driverId: o.driver?.id ?? null,
    fromCityId: "",
    toCityId: "",
    distanceKm: o.distance_m != null ? Math.round(o.distance_m / 100) / 10 : 0,
    mode: o.seats ? "seat" : "car",
    // The contract has a seat count, not seat positions.
    seatIds: Array.from({ length: seats }, (_, i) => `seat-${i + 1}`),
    price: somFromTiyin(o.price),
    paymentMethod: toUiPayment(o.payment_method),
    status: STATUS[o.status] ?? "searching",
    createdAt: Date.parse(o.created_at) || Date.now(),
    rating: extra.rating,
    driver: o.driver ? toUiDriver(o.driver) : undefined,
    fromCity: placeAsCity(o.from),
    toCity: placeAsCity(o.to),
    // The contract has no "can edit / can rate" verdicts: let the action
    // through and show the server's 403 if it refuses.
    ratingEditable: true,
    editable: true,
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
  else if (o.car_class && !o.seats) body.car_class = o.car_class;
  else if (o.seats) body.seats = o.seats;
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
export function toApiRating(stars: number, reasons: string[] = [], note?: string): Api.RatingInput {
  if (stars !== 5) return { stars };
  for (const r of reasons) {
    if (RATING_REASON[r]) return { stars, reason: { kind: RATING_REASON[r] } };
    const text = note?.trim();
    if (r === "other" && text) return { stars, reason: { kind: "custom", custom_text: text.slice(0, 200) } };
  }
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
