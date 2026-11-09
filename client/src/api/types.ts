import type {
  City,
  Driver,
  Order,
  OrderMode,
  PaymentMethod,
} from "@/seed/generate";
import type { ReviewKind, ReviewRequest } from "@/mockDb/db";

export type { City, Driver, Order, OrderMode, PaymentMethod, ReviewKind, ReviewRequest };

export type RouteSuggestion = {
  fromCityId: string;
  toCityId: string;
  distanceKm: number;
  fromPrice: number;
  label: string;
};

export type QuoteInput = {
  fromCityId: string;
  toCityId: string;
  mode: OrderMode;
  seatIds: string[];
};

export type Quote = {
  distanceKm: number;
  price: number;
  perSeatPrice?: number;
  etaMinutes: number;
  durationMinutes: number;
};

export type CreateOrderInput = {
  fromCityId: string;
  toCityId: string;
  mode: OrderMode;
  seatIds: string[];
  paymentMethod: PaymentMethod;
  timeMode: "now" | "range";
  timeRange?: { from: string; to: string };
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
