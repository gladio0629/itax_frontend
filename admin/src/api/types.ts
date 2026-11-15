import type {
  City,
  Order as SeedOrder,
  OrderMode,
  OrderStatus as SeedOrderStatus,
  PaymentMethod as SeedPaymentMethod,
  Passenger,
  PassengerStatus,
  Driver as SeedDriver,
  DriverStatus as SeedDriverStatus,
  WalletEntry as SeedWalletEntry,
  WalletEntryType as SeedWalletEntryType,
  Complaint,
  ComplaintType,
  ComplaintStatus,
  ComplaintNote,
  Tariff as SeedTariff,
} from "@/seed/generate";
import type {
  AdminUser,
  AdminRole,
  StaffStatus,
  Section,
  Action,
  AuditEntry,
  AuditAction,
  TariffProposal as SeedTariffProposal,
  TariffProposalType,
  AdjustmentProposal,
  ReviewKind,
  ReviewRequest,
  QueueItem as SeedQueueItem,
  QueueReason as SeedQueueReason,
  QueueStatus,
  HistoryEntry as SeedHistoryEntry,
  HistoryResult,
} from "@/mockDb/db";

// The seed types are shared with the mock. The real API knows a few more
// values (driver "rejected", order "arrived"/"expired", ledger "bonus"…), so
// the UI types below widen them; the mock simply never produces the extras.
export type DriverStatus = SeedDriverStatus | "rejected";
export type Driver = Omit<SeedDriver, "status"> & { status: DriverStatus };
export type OrderStatus = SeedOrderStatus | "arrived" | "expired";
export type PaymentMethod = SeedPaymentMethod | "wallet" | "payme" | "click";
export type Order = Omit<SeedOrder, "status" | "paymentMethod"> & {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  /** Requested pickup time (epoch ms), when the order has one. */
  scheduledAt?: number;
};
export type WalletEntryType = SeedWalletEntryType | "trip_payment" | "bonus";
export type WalletEntry = Omit<SeedWalletEntry, "type"> & { type: WalletEntryType };
export type QueueReason = SeedQueueReason | "driver_application" | "document_update";
export type QueueItem = Omit<SeedQueueItem, "reason"> & { reason: QueueReason };
export type HistoryEntry = Omit<SeedHistoryEntry, "reason"> & { reason: QueueReason };
/** Contract car classes (tariffs). */
export type TariffCarClass = "economy" | "comfort" | "business" | "minivan";
export type Tariff = SeedTariff & {
  perMin?: number;
  minFare?: number;
  carClass?: TariffCarClass;
};
export type TariffProposal = Omit<SeedTariffProposal, "patch"> & { patch: Partial<Tariff> };
export type TariffNumericField = "baseFare" | "perKmCar" | "perKmSeat" | "frontSeatSurcharge" | "fuelAdjustmentPct" | "commissionPct" | "perMin" | "minFare";

/**
 * What the active adapter can do. The mock can do everything; the http
 * adapter only what api/openapi.yml has endpoints/fields for. Screens hide
 * (never fake) whatever is false. See docs/backend-gaps/admin.md.
 */
export type AdapterCapabilities = {
  staffSearch: boolean;
  staffStatusFilter: boolean;
  staffEmailEdit: boolean;
  staffLastLogin: boolean;
  restoreStaff: boolean;
  driverReviewFilter: boolean;
  driverOnline: boolean;
  driverDebtLimit: boolean;
  driverCarEdit: boolean;
  passengerCity: boolean;
  orderSearch: boolean;
  orderCreate: boolean;
  orderEdit: boolean;
  orderPassenger: boolean;
  walletLedgerFilters: boolean;
  walletDriverName: boolean;
  adjustmentProposalsList: boolean;
  tariffSearch: boolean;
  tariffProposalValues: boolean;
  queueFilters: boolean;
  historyFilters: boolean;
  historyEdit: boolean;
  operatorCounts: boolean;
  sectionBadges: boolean;
  /** Tariff fields this backend knows, in display order. */
  tariffFields: readonly TariffNumericField[];
  tariffCarClass: boolean;
  /** Order statuses the list can be filtered by. */
  orderStatuses: readonly OrderStatus[];
};

export type QueueListItem = Omit<QueueItem, "phoneFull">;
/** Only returned by startTask() — the one place the mock "server" reveals a
 * full fake number, for the single task an operator has open. */
export type ActiveTask = QueueItem;

export type {
  City,
  OrderMode,
  Passenger,
  PassengerStatus,
  Complaint,
  ComplaintType,
  ComplaintStatus,
  ComplaintNote,
  AdminUser,
  AdminRole,
  StaffStatus,
  Section,
  Action,
  AuditEntry,
  AuditAction,
  TariffProposalType,
  AdjustmentProposal,
  ReviewKind,
  ReviewRequest,
  QueueStatus,
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
/** `null` = this backend doesn't report the figure; the screen hides it
 * (never shows a made-up 0). */
export type MarketingStats = {
  period: StatsPeriod;
  passengersTotal: number | null;
  passengersNew: number | null;
  driversTotal: number | null;
  driversActive: number | null;
  driversBlocked: number | null;
  driversNew: number | null;
  /** Real API only: drivers online right now / at the debt limit. */
  driversOnline?: number | null;
  driversOverLimit?: number | null;
  /** Real API only: order totals for the period. */
  ordersTotal?: number | null;
  ordersCompleted?: number | null;
  ordersCancelled?: number | null;
  ordersByStatus: { status: OrderStatus; count: number }[] | null;
  ordersByRoute: { from: string; to: string; count: number }[] | null;
  registrations: { date: string; passengers: number; drivers: number }[] | null;
  totalIncome: number | null;
  totalCommission: number | null;
  averageOrderValue: number | null;
  walletTotalBalance: number | null;
  incomeOverTime: { date: string; income: number }[] | null;
  incomeByRoute: { from: string; to: string; income: number }[] | null;
  incomeByCity: { city: string; income: number }[] | null;
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
  /** The code step must also collect the staff phone (real API: email code
   * and phone go together in step 2). */
  needsPhone?: boolean;
  /** Shortest accepted code (SMS codes may be 4–6 digits); default 6. */
  codeMinLength?: number;
};

export type LoginStepResult =
  | {
      done: false;
      requestId: string;
      step: LoginStep;
      maskedDestination: string;
      testCode?: string;
      resendSeconds: number;
      attemptsLeft: number;
      needsPhone?: boolean;
      codeMinLength?: number;
    }
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
