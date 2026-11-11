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

export type OrderTiming =
  | { timeMode: "now" }
  | {
      timeMode: "scheduled";
      date: "today" | "tomorrow" | string; // string = ISO date for "boshqa sana"
      timeKind: "exact" | "range";
      time?: string;
      timeRange?: { from: string; to: string };
    };

export type QuoteInput = {
  serviceType: ServiceType;
  fromAddressId: string;
  toAddressId: string;
  mode: OrderMode;
  seatIds: string[];
  cargo?: CargoInput;
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
};

/** Everything about an order that isn't on the shared Order type (which
 * can't change — see seed/generate.ts) but that Tafsilotlar needs to show
 * and edit: the addresses actually picked and the requested timing. */
export type OrderExtras = {
  fromAddressId: string;
  toAddressId: string;
  timing: OrderTiming;
};

export type UpdateOrderInput = Partial<{
  fromAddressId: string;
  toAddressId: string;
  mode: OrderMode;
  seatIds: string[];
  cargo: CargoInput;
  paymentMethod: PaymentMethod;
  timing: OrderTiming;
}>;

export type SavedAddressInfo = {
  address: Address;
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
