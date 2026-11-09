import type {
  City,
  Order,
  OrderMode,
  OrderStatus,
  PaymentMethod,
  Passenger,
  PassengerStatus,
  Driver,
  DriverStatus,
  WalletEntry,
  WalletEntryType,
  Complaint,
  ComplaintType,
  ComplaintStatus,
  ComplaintNote,
  Tariff,
} from "@/seed/generate";
import type {
  AdminUser,
  AdminRole,
  StaffStatus,
  Section,
  Action,
  AuditEntry,
  AuditAction,
  TariffProposal,
  TariffProposalType,
  AdjustmentProposal,
  ReviewKind,
  ReviewRequest,
  QueueItem,
  QueueReason,
  QueueStatus,
  HistoryEntry,
  HistoryResult,
} from "@/mockDb/db";

export type QueueListItem = Omit<QueueItem, "phoneFull">;
/** Only returned by startTask() — the one place the mock "server" reveals a
 * full fake number, for the single task an operator has open. */
export type ActiveTask = QueueItem;

export type {
  City,
  Order,
  OrderMode,
  OrderStatus,
  PaymentMethod,
  Passenger,
  PassengerStatus,
  Driver,
  DriverStatus,
  WalletEntry,
  WalletEntryType,
  Complaint,
  ComplaintType,
  ComplaintStatus,
  ComplaintNote,
  Tariff,
  AdminUser,
  AdminRole,
  StaffStatus,
  Section,
  Action,
  AuditEntry,
  AuditAction,
  TariffProposal,
  TariffProposalType,
  AdjustmentProposal,
  ReviewKind,
  ReviewRequest,
  QueueItem,
  QueueReason,
  QueueStatus,
  HistoryEntry,
  HistoryResult,
};

export type OrderWithNames = Order & {
  passengerName: string;
  driverName: string | null;
  fromCityName: string;
  toCityName: string;
};

export type WalletLedgerRow = WalletEntry & { driverName: string };

/** What the current admin is allowed to see and do — the ONLY source of
 * truth for permissions on the client. Every screen, the sidebar, route
 * guards and the "create staff" role dropdown read from this, never from a
 * raw `role` comparison. */
export type Me = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AdminRole;
  avatarSeed: string;
  sections: Section[];
  actions: Action[];
  creatableRoles: AdminRole[];
  landingPath: string;
};

export type DashboardStats = {
  driversOnline: number;
  driversTotal: number;
  passengersTotal: number;
  ordersToday: number;
  completedToday: number;
  revenueToday: number;
  revenueWeek: number;
  weekPoints: { date: string; revenue: number; orders: number }[];
  openComplaints: number;
  flaggedComplaints: number;
};

/** Money-free statistics for the "marketolog" role. No field here is ever
 * a price, commission, wallet balance or tariff value — the adapter simply
 * never puts those fields on this object. */
export type MarketingStats = {
  period: StatsPeriod;
  passengersTotal: number;
  passengersNew: number;
  driversTotal: number;
  driversActive: number;
  driversBlocked: number;
  driversNew: number;
  ordersByStatus: { status: OrderStatus; count: number }[];
  ordersByRoute: { from: string; to: string; count: number }[];
  registrations: { date: string; passengers: number; drivers: number }[];
};

export type StatsPeriod = "7d" | "30d" | "90d";

export type LoginStep = "email_code" | "phone_code";

export type LoginStartResult = {
  requestId: string;
  steps: LoginStep[];
  maskedDestination: string;
  demoCode: string;
  resendSeconds: number;
  attemptsLeft: number;
};

export type LoginStepResult =
  | { done: false; requestId: string; step: LoginStep; maskedDestination: string; demoCode: string; resendSeconds: number; attemptsLeft: number }
  | { done: true; reviewId: string };
