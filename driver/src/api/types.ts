import type {
  City,
  Order,
  OrderMode,
  Passenger,
  WalletEntry,
} from "@/seed/generate";
import type { ReviewKind, ReviewRequest } from "@/mockDb/db";

export type { City, Order, OrderMode, Passenger, WalletEntry, ReviewKind, ReviewRequest };

export type DriverProfile = {
  id: string;
  name: string;
  phoneMasked: string;
  avatarSeed: string;
  rating: number;
  totalTrips: number;
  cityId: string;
  carModel: string;
  carColor: string;
  carColorHex: string;
  plate: string;
  online: boolean;
  walletBalance: number;
  documentsStatus: "approved" | "pending" | "rejected";
  joinedAt: number;
};

export type OrderWithDetails = Order & {
  passenger?: Passenger;
  fromCity: City;
  toCity: City;
  coRiders?: Array<{ order: Order; passenger?: Passenger }>;
};

export const COMMISSION_PCT = 10;
export const DEBT_LIMIT_SOM = -50_000;

export type WalletSummary = {
  balance: number;
  commissionPct: number;
  debtBlocked: boolean;
  entries: WalletEntry[];
};

export type EarningsPoint = { date: string; amount: number; trips: number };

export type EarningsStats = {
  points: EarningsPoint[];
  totalToday: number;
  tripsToday: number;
  totalWeek: number;
  tripsWeek: number;
  avgRating: number;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  kind: "order" | "wallet" | "docs" | "system";
};

export type RegistrationInput = {
  name: string;
  phone: string;
  cityId: string;
  carModel: string;
  plate: string;
  licensePhotoName: string;
  techPassportPhotoName: string;
};

export type OtpRequestResult = {
  requestId: string;
  demoCode: string;
};
