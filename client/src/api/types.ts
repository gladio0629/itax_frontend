import type {
  City,
  Driver,
  Order,
  OrderMode,
  PaymentMethod,
} from "@/seed/generate";
import type { ReviewKind, ReviewRequest } from "@/mockDb/db";
import type { Address } from "@/clientData/addresses";

export type { City, Driver, Order, OrderMode, PaymentMethod, ReviewKind, ReviewRequest, Address };

export type ServiceType = "passenger" | "delivery";
export type CargoPreset = "small" | "medium" | "large";
export type CargoInput = {
  preset: CargoPreset;
  volumeM3: number;
  weightKg: number;
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

export type OrderWithDetails = Order & {
  driver?: Driver;
  fromCity: City;
  toCity: City;
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
