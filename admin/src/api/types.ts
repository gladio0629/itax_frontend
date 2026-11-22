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
  Complaint as SeedComplaint,
  ComplaintType as SeedComplaintType,
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
  AuditEntry as SeedAuditEntry,
  AuditAction,
  TariffProposal as SeedTariffProposal,
  TariffProposalType,
  AdjustmentProposal as SeedAdjustmentProposal,
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
  /** Requested pickup range (epoch ms), when the order has one. */
  scheduledRange?: { from: number; to: number };
};
/** Contract reasons for an admin cancel (AdminOrderCancel.reason). */
export type OrderCancelReasonCode = "admin_decision" | "passenger_request" | "driver_request" | "duplicate" | "fraud" | "other";
/** Fields the order edit form may send; which ones a backend accepts is
 * `capabilities.orderEditFields`. */
export type OrderEditField = "seats" | "timeWindow" | "note" | "paymentMethod" | "schedule";
export type OrderFieldsPatch = {
  seatIds?: string[];
  note?: string;
  timeWindow?: { from: string; to: string } | null;
  paymentMethod?: PaymentMethod;
  /** Exact pickup time or a pickup range, epoch ms. */
  schedule?: { at: number } | { from: number; to: number };
};
/** The real API's complaint categories next to the sample data's types. */
export type ComplaintCategory = "driver_behavior" | "passenger_behavior" | "payment" | "safety" | "lost_item" | "app_issue" | "other";
export type ComplaintType = SeedComplaintType | ComplaintCategory;
export type ComplaintSubjectType = "passenger" | "driver" | "order";
export type Complaint = Omit<SeedComplaint, "type"> & {
  type: ComplaintType;
  /** Real API only: what the complaint is about. */
  subjectType?: ComplaintSubjectType;
  subjectId?: string;
  /** Real API only: the closing text of a resolved/rejected complaint. */
  resolution?: string;
};
/** Real API actions are dotted strings ("staff.update"); the sample data
 * uses its own AuditAction names. */
export type AuditEntry = Omit<SeedAuditEntry, "action"> & { action: AuditAction | (string & {}) };
/** `subjectLabel`: what to show when the driver isn't known (the real list
 * only carries a wallet id). */
export type AdjustmentProposal = SeedAdjustmentProposal & { subjectLabel?: string };
export type WalletEntryType = SeedWalletEntryType | "trip_payment" | "bonus";
export type WalletEntry = Omit<SeedWalletEntry, "type"> & { type: WalletEntryType };
export type QueueReason = SeedQueueReason | "driver_application" | "document_update";
/** `phone` is null when the backend doesn't send one (real API queue items
 * carry only a subject id); `subjectLabel` is shown instead. */
export type QueueItem = Omit<SeedQueueItem, "reason" | "phone"> & { reason: QueueReason; phone: string | null; subjectLabel?: string };
export type HistoryEntry = Omit<SeedHistoryEntry, "reason" | "phone"> & { reason: QueueReason; phone: string | null; subjectLabel?: string };
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
  /** Order fields the edit form shows (and the backend accepts). */
  orderEditFields: readonly OrderEditField[];
  /** Longest order note the backend accepts (null = no limit). */
  orderNoteMaxLength: number | null;
  /** Cancel takes a reason code from a fixed list (+ optional comment)
   * instead of free text. */
  orderCancelReasons: boolean;
  /** Shortest correction reason the backend accepts. */
  adjustmentReasonMinLength: number;
  /** Complaint list: free-text search and the sample fraud/service split. */
  complaintSearch: boolean;
  complaintCategoryFilter: boolean;
  /** Complaint list: filter by subject (passenger/driver/order) and "assigned to me". */
  complaintSubjectFilter: boolean;
  complaintAssigneeFilter: boolean;
  /** false: the list has no notes; the card loads them with getComplaint(). */
  complaintNotesInList: boolean;
  /** Closing (resolved/rejected) needs a resolution text. */
  complaintResolution: boolean;
  /** Audit log: free-text search. */
  auditSearch: boolean;
  /** Audit log: the backend's dotted action names and an entity-type filter. */
  auditApiFilters: boolean;
  /** Header search over orders, drivers, passengers and staff (v2). */
  globalSearch: boolean;
};

/** One header-search hit. The server returns only what the current admin
 * may see; `subtitle` is display text. */
export type GlobalSearchKind = "order" | "driver" | "passenger" | "staff";
export type GlobalSearchHit = {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  subtitle: string;
};

export type QueueListItem = QueueItem;
/** The task an operator has open (same shape as a list item). */
export type ActiveTask = QueueItem;

export type {
  City,
  OrderMode,
  Passenger,
  PassengerStatus,
  ComplaintStatus,
  ComplaintNote,
  AdminUser,
  AdminRole,
  StaffStatus,
  Section,
  Action,
  AuditAction,
  TariffProposalType,
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
  ordersExpired?: number | null;
  /** Real API only: orders and completed orders per day. */
  ordersOverTime?: { date: string; orders: number; completed: number }[] | null;
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

/**
 * Admin login (doc 2.5, design Main + Verify). Email accounts: email code,
 * then the staff phone + SMS code (`needsPhone`: the phone is sent together
 * with the email code). Operators: phone + SMS code only. Nothing is
 * remembered on the device; the session ends on logout.
 */
export type LoginStartResult = {
  requestId: string;
  steps: LoginStep[];
  /** Set by the mock adapter only (sample-data build); never by the server. */
  testCode?: string;
  resendSeconds: number;
  attemptsLeft: number;
  /** The code step must also collect the staff phone (real API: email code
   * and phone go together in step 2). */
  needsPhone?: boolean;
  /** Shortest accepted code (SMS codes may be 4–6 digits); default 6. */
  codeMinLength?: number;
  /** Exact length of the code that was sent, when the server says (code boxes). */
  codeLength?: number;
};

export type LoginStepResult =
  | {
      done: false;
      requestId: string;
      step: LoginStep;
      testCode?: string;
      resendSeconds: number;
      attemptsLeft: number;
      needsPhone?: boolean;
      codeMinLength?: number;
      codeLength?: number;
    }
  /** Signed in: the session exists now (no review/approval step). */
  | { done: true };

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
export type OrderQuery = { search?: string; status?: OrderStatus | "all"; passengerId?: string };
export type WalletQuery = { search?: string; type?: WalletEntryType | "all" };
export type TariffQuery = { search?: string; status?: "active" | "archived" | "all" };

export type ProposalStatusFilter = "pending_second" | "approved" | "rejected" | "all";
export type TariffProposalQuery = { status?: ProposalStatusFilter };
export type AdjustmentProposalQuery = { status?: ProposalStatusFilter };

export type ComplaintCategoryFilter = "all" | "fraud" | "service";
export type ComplaintQuery = {
  search?: string;
  status?: ComplaintStatus | "all";
  category?: ComplaintCategoryFilter;
  subjectType?: ComplaintSubjectType | "all";
  assignedToMe?: boolean;
};

export type AuditQuery = { search?: string; action?: string; dateFrom?: string; dateTo?: string; entityType?: string };

export type OperatorQueueQuery = { search?: string; reason?: QueueReason | "all" };
export type OperatorInProgressQuery = { search?: string };
export type OperatorHistoryQuery = { search?: string; result?: HistoryResult | "all"; dateFrom?: string; dateTo?: string };
export type OperatorApprovedQuery = OperatorHistoryQuery & { operatorId?: string | "all" };

export type SectionBadges = Partial<Record<Section, number>>;
export type OperatorCounts = { queue: number; inProgress: number; approvedToday: number };
