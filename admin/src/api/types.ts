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
  /** The adapter's own verdict on whether this order can still be
   * cancelled — screens render it, they don't re-derive it from status. */
  canCancel: boolean;
};

export type WalletLedgerRow = WalletEntry & { driverName: string };

/** A staff row plus the adapter's own verdict on whether the current admin
 * may edit/block/archive this particular person — never re-derived from
 * creatableRoles in a screen. */
export type StaffRow = AdminUser & { canEdit: boolean };

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

export type StatsPeriod = "7d" | "30d" | "90d";

/** The one "Umumiy statistika" page every role with the "stats" section
 * gets — demographics AND money (income, commission, average order value,
 * wallet totals, income by route/city). superadmin/owner/menejer have "all
 * statistics" per the permissions matrix and marketolog's statistics are no
 * longer money-free, so everyone gets the same shape from getStats(). */
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
  totalIncome: number;
  totalCommission: number;
  averageOrderValue: number;
  walletTotalBalance: number;
  incomeOverTime: { date: string; income: number }[];
  incomeByRoute: { from: string; to: string; income: number }[];
  incomeByCity: { city: string; income: number }[];
};

export type LoginStep = "email_code" | "phone_code";

export type LoginStartResult = {
  requestId: string;
  steps: LoginStep[];
  maskedDestination: string;
  /** Set by the mock adapter only (sample-data build); never by the server. */
  testCode?: string;
  resendSeconds: number;
  attemptsLeft: number;
};

export type LoginStepResult =
  | { done: false; requestId: string; step: LoginStep; maskedDestination: string; testCode?: string; resendSeconds: number; attemptsLeft: number }
  | { done: true; reviewId: string };

// ---------------------------------------------------------------------
// List query params. Every list screen sends these to the adapter, which
// does the filtering — screens never filter business data themselves.
// "all" means "no filter on this field" (never represented as undefined,
// so a <select> can always have a concrete value bound to it).
// ---------------------------------------------------------------------

export type ArchivableStatusFilter<S extends string> = S | "archived" | "all";

export type StaffQuery = { search?: string; role?: AdminRole | "all"; status?: ArchivableStatusFilter<StaffStatus> };
export type DriverQuery = { search?: string; status?: ArchivableStatusFilter<DriverStatus> };
export type PassengerQuery = { search?: string; status?: ArchivableStatusFilter<PassengerStatus> };
export type OrderQuery = { search?: string; status?: OrderStatus | "all" };
export type WalletQuery = { search?: string; type?: WalletEntryType | "all" };
export type TariffQuery = { search?: string; status?: "active" | "archived" | "all" };

export type ProposalStatusFilter = "pending_second" | "approved" | "rejected" | "all";
export type TariffProposalQuery = { status?: ProposalStatusFilter };
export type AdjustmentProposalQuery = { status?: ProposalStatusFilter };

export type ComplaintCategoryFilter = "all" | "fraud" | "service";
export type ComplaintQuery = { search?: string; status?: ComplaintStatus | "all"; category?: ComplaintCategoryFilter };

export type AuditQuery = { search?: string; action?: AuditAction | "all"; dateFrom?: string; dateTo?: string };

export type OperatorQueueQuery = { search?: string; reason?: QueueReason | "all" };
export type OperatorInProgressQuery = { search?: string };
export type OperatorHistoryQuery = { search?: string; result?: HistoryResult | "all"; dateFrom?: string; dateTo?: string };
export type OperatorApprovedQuery = OperatorHistoryQuery & { operatorId?: string | "all" };

export type SectionBadges = Partial<Record<Section, number>>;
export type OperatorCounts = { queue: number; inProgress: number; approvedToday: number };
