import type {
  City,
  Driver,
  Order,
  OrderMode,
  OrderStatus,
  PaymentMethod,
} from "@/seed/generate";
import type { ReviewKind, ReviewRequest } from "@/mockDb/db";
import type { Address } from "@/clientData/addresses";

export type { City, Driver, Order, OrderMode, OrderStatus, PaymentMethod, ReviewKind, ReviewRequest, Address };

export type ServiceType = "passenger" | "delivery";
/** Delivery is priced by the vehicle the client picks — no weight or volume. */
export type DeliveryVehicle = "spark" | "damas" | "labo" | "isuzu" | "isuzu2" | "fura";
export const DELIVERY_VEHICLES: DeliveryVehicle[] = ["spark", "damas", "labo", "isuzu", "isuzu2", "fura"];
/** What the delivery picker shows for one vehicle. Dimensions are the cargo
 * space in cm: width (along the vehicle) × depth × height. */
export type DeliveryVehicleSpec = {
  id: DeliveryVehicle;
  /** Size chip label — S, M, L, XL, XXL, 3XL. Not translated. */
  sizeLabel: string;
  descKey: string;
  dimensionsCm: { width: number; depth: number; height: number };
  maxWeightKg: number;
};
export type CargoInput = {
  vehicle: DeliveryVehicle;
  note?: string;
};

export type SeatPosition = "front" | "back-left" | "back-mid" | "back-right";
export type Seat = {
  id: SeatPosition;
  position: SeatPosition;
  taken: boolean;
  price: number;
};

/** Quote/validation/error text is returned as a translation key + params,
 * never as localized text — the UI maps it through useT(). */
export type QuoteLine = {
  key: string;
  params?: Record<string, string | number>;
  amount: number;
};

export type RouteSuggestion = {
  fromCityId: string;
  toCityId: string;
  distanceKm: number;
  fromPrice: number;
  label: string;
};

/** "now" is "Haydovchi istagan" — the driver picks the moment, no input.
 * "scheduled" is "Siz istagan". `date` is an ISO date (YYYY-MM-DD); orders
 * saved before ISO dates may still carry "today"/"tomorrow". `dateEnd` is set
 * only for a date range (the passenger can travel any day in date…dateEnd). */
export type OrderTiming =
  | { timeMode: "now" }
  | {
      timeMode: "scheduled";
      date: "today" | "tomorrow" | string;
      dateEnd?: string;
      timeKind: "exact" | "range";
      time?: string;
      timeRange?: { from: string; to: string };
    };

/** Booking-window rules the time picker clamps to. The adapter owns them
 * (and re-validates on create/update); the UI never hardcodes the numbers. */
export type SchedulingRules = {
  /** Days that can be booked, counting today (21 = today … today+20). */
  bookableDays: number;
  /** Longest date range, in days between the first and last day. */
  maxRangeDays: number;
  /** Shortest "dan"→"gacha" window, in minutes. */
  minRangeMinutes: number;
  /** Wheel granularity, in minutes. */
  stepMinutes: number;
};

/** "Tafsilotlar" for one route point. Every field is optional free text —
 * the adapter trims, drops empty fields and enforces the lengths in
 * OrderDetailsRules. */
export type AddressDetails = {
  /** Podyezd */
  entrance?: string;
  /** Qavat */
  floor?: string;
  /** Kvartira */
  apartment?: string;
  /** Domofon kodi — the UI never shows it unmasked outside its own input. */
  intercom?: string;
  /** Izoh */
  note?: string;
};

/** One intermediate stop between Qayerdan and Qayerga. */
export type RouteStop = {
  addressId: string;
  details?: AddressDetails;
};

export type OrderOptionId = "child_seat" | "big_luggage";

/** An add-on the passenger can switch on. The price is the adapter's; the
 * UI only shows it. */
export type OrderOption = {
  id: OrderOptionId;
  titleKey: string;
  descKey: string;
  price: number;
};

/** A suggestion derived from the driver comment ("bola", "чемодан", …).
 * Suggestions only — nothing is applied until the passenger taps. */
export type CommentHint = {
  optionId: OrderOptionId;
  messageKey: string;
};

/** Limits for the order-details inputs. The adapter owns them and
 * re-validates on quote/create/update; the UI only reads them for
 * maxLength attributes, counters and hiding "To'xtash qo'shish". */
export type OrderDetailsRules = {
  maxStops: number;
  commentMaxLength: number;
  /** Podyezd, Qavat, Kvartira. */
  addressFieldMaxLength: number;
  intercomMaxLength: number;
  addressNoteMaxLength: number;
};

export type QuoteInput = {
  serviceType: ServiceType;
  fromAddressId: string;
  toAddressId: string;
  /** Intermediate stops' address ids, in route order. */
  stops?: string[];
  mode: OrderMode;
  seatIds: string[];
  cargo?: CargoInput;
  optionIds?: OrderOptionId[];
};

export type Quote = {
  distanceKm: number;
  lines: QuoteLine[];
  total: number;
  currency: "som";
  etaMinutes: number;
  durationMinutes: number;
};

export type CreateOrderInput = {
  serviceType: ServiceType;
  fromAddressId: string;
  toAddressId: string;
  mode: OrderMode;
  seatIds: string[];
  cargo?: CargoInput;
  paymentMethod: PaymentMethod;
  timing: OrderTiming;
  promoCode?: string;
  fromDetails?: AddressDetails;
  toDetails?: AddressDetails;
  stops?: RouteStop[];
  /** "Haydovchiga izoh". */
  comment?: string;
  optionIds?: OrderOptionId[];
};

/** Everything about an order that isn't on the shared Order type (which
 * can't change — see seed/generate.ts) but that Tafsilotlar needs to show
 * and edit: the addresses actually picked and the requested timing. */
export type OrderExtras = {
  fromAddressId: string;
  toAddressId: string;
  timing: OrderTiming;
  serviceType?: ServiceType;
  cargo?: CargoInput;
  fromDetails?: AddressDetails;
  toDetails?: AddressDetails;
  stops?: RouteStop[];
  comment?: string;
  optionIds?: OrderOptionId[];
};

export type UpdateOrderInput = Partial<{
  fromAddressId: string;
  toAddressId: string;
  mode: OrderMode;
  seatIds: string[];
  cargo: CargoInput;
  paymentMethod: PaymentMethod;
  timing: OrderTiming;
  fromDetails: AddressDetails;
  toDetails: AddressDetails;
  stops: RouteStop[];
  comment: string;
  optionIds: OrderOptionId[];
}>;

export type SavedAddressInfo = {
  address: Address;
  /** Tafsilotlar remembered for this saved address. */
  details?: AddressDetails;
  distanceKm: number;
  etaMinutes: number;
};

export type OrderWithDetails = Order & {
  driver?: Driver;
  fromCity: City;
  toCity: City;
  ratingEditable: boolean;
  lockedReasonKey?: string;
  extras?: OrderExtras;
  /** Whether updateOrder() will currently accept changes (false once the
   * trip is in_progress or later). */
  editable: boolean;
};

export type OrderHistoryPage = {
  orders: OrderWithDetails[];
  nextCursor: number | null;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  kind: "order" | "wallet" | "promo" | "system";
};

// Passenger wallet — distinct from the driver app's WalletEntry (which is
// seeded per-driver in seed/generate.ts and carries commission/debt
// concepts that don't apply to passengers). This type is client-only.
export type PassengerWalletEntryType = "topup" | "trip_payment" | "refund" | "bonus";

export type PassengerWalletEntry = {
  id: string;
  type: PassengerWalletEntryType;
  amount: number; // positive = credit to wallet, negative = debit
  createdAt: number;
  balanceAfter: number;
  orderId?: string;
};

export type WalletSummary = {
  balance: number;
  lowBalance: boolean;
  entries: PassengerWalletEntry[];
};

export type SavedCard = {
  id: string;
  label: string;
  last4: string;
  brand: "uzcard" | "humo" | "visa";
};

export type Profile = {
  id: string;
  name: string;
  phoneMasked: string;
  avatarSeed: string;
  rating: number;
  totalTrips: number;
};

export type OtpRequestResult = {
  requestId: string;
  demoCode: string;
};

export type NotificationPrefs = {
  master: boolean;
  orderStatus: boolean;
  news: boolean;
  bonus: boolean;
};

export type AccountSummary = {
  id: string;
  name: string;
  phoneMasked: string;
  avatarSeed: string;
  active: boolean;
};

export type HelpTopic = "order" | "payment" | "app" | "other";

export type HelpRequest = {
  id: string;
  topicKey: string;
  message?: string;
  status: "pending" | "in_review" | "resolved";
  createdAt: number;
};

export type BonusSummary = {
  balance: number;
  minWithdraw: number;
  monthlyMax: number;
  monthlyWithdrawn: number;
  canWithdraw: boolean;
  /** 0-1 progress toward minWithdraw (capped at 1). */
  progress: number;
};

export type BonusAction = "goto_order" | "invite" | "rate_trip";
export type BonusSourceIcon = "order" | "invite" | "rate";

export type BonusSource = {
  id: string;
  icon: BonusSourceIcon;
  titleKey: string;
  descriptionKey: string;
  amountThisMonth: number;
  action: BonusAction;
};

export type BonusHistoryEntry = {
  id: string;
  sourceId: string;
  type: "earn" | "withdraw";
  amount: number;
  createdAt: number;
};

export type BonusHistoryPage = {
  entries: BonusHistoryEntry[];
  nextCursor: number | null;
};
