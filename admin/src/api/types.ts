import type {
  City,
  Order,
  OrderMode,
  OrderStatus,
  PaymentMethod,
  Passenger,
  Driver,
  WalletEntry,
  WalletEntryType,
  Complaint,
  ComplaintType,
  Tariff,
} from "@/seed/generate";
import type { AdminUser, AdminRole, AuditEntry, AuditAction, TariffProposal, ReviewKind, ReviewRequest } from "@/mockDb/db";

export type {
  City,
  Order,
  OrderMode,
  OrderStatus,
  PaymentMethod,
  Passenger,
  Driver,
  WalletEntry,
  WalletEntryType,
  Complaint,
  ComplaintType,
  Tariff,
  AdminUser,
  AdminRole,
  AuditEntry,
  AuditAction,
  TariffProposal,
  ReviewKind,
  ReviewRequest,
};

export type OrderWithNames = Order & {
  passengerName: string;
  driverName: string | null;
  fromCityName: string;
  toCityName: string;
};

export type WalletLedgerRow = WalletEntry & { driverName: string };

export type DashboardStats = {
  driversOnline: number;
  driversTotal: number;
  passengersTotal: number;
  ordersToday: number;
  completedToday: number;
  revenueToday: number;
  revenueWeek: number;
  weekPoints: { date: string; revenue: number; orders: number }[];
  pendingVerifications: number;
  openSupportTickets: number;
  flaggedRiskItems: number;
};

export type OtpRequestResult = {
  requestId: string;
  demoCode: string;
};
