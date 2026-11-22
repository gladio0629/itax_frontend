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
  OrderKind,
  CargoBodySize,
  DriverLevel,
  DriverDocument,
} from "@/seed/generate";
import type {
  AdminUser,
  AdminRole,
  StaffStatus,
  Section,
  Action,
  AuditEntry as SeedAuditEntry,
  AuditAction,
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
export type WalletEntryType = SeedWalletEntryType | "trip_payment" | "bonus";
export type WalletEntry = Omit<SeedWalletEntry, "type"> & { type: WalletEntryType };
export type QueueReason = SeedQueueReason | "driver_application" | "document_update";
/** `phone` is null when the backend doesn't send one (real API queue items
 * carry only a subject id); `subjectLabel` is shown instead. */
export type QueueItem = Omit<SeedQueueItem, "reason" | "phone"> & { reason: QueueReason; phone: string | null; subjectLabel?: string };
export type HistoryEntry = Omit<SeedHistoryEntry, "reason" | "phone"> & { reason: QueueReason; phone: string | null; subjectLabel?: string };
/** Passenger car classes (Standart, Komfort, Biznes, Miniven). */
export type TariffCarClass = "economy" | "comfort" | "business" | "minivan";

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
  /** Ledger: search, kind chips and period filter. */
  walletLedgerFilters: boolean;
  walletDriverName: boolean;
  /** Ledger kinds this backend reports (chips are shown only for these). */
  walletKinds: readonly WalletEntryType[];
  /** Ledger KPI tiles (getLedgerSummary). */
  ledgerSummary: boolean;
  /** "Qaysi yozuvga" on a correction (entry reference). */
  correctionEntryRef: boolean;
  /** New tariff model (fuel price, markups, extras, level commissions). */
  tariffSettings: boolean;
  /** Tariffs per city ("Shahar" filter). */
  tariffCities: boolean;
  queueFilters: boolean;
  historyFilters: boolean;
  historyEdit: boolean;
  operatorCounts: boolean;
  sectionBadges: boolean;
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
  /** v2 group 3 */
  orderCounts: boolean;
  orderKindFilter: boolean;
  orderDateFilter: boolean;
  /** "Operatorga yuborish" on an order. */
  orderToOperator: boolean;
  driverCounts: boolean;
  driverRouteFilter: boolean;
  driverLevelFilter: boolean;
  /** Driver history (trips per driver). */
  driverTrips: boolean;
  passengerCounts: boolean;
  passengerJoinedFilter: boolean;
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
  QueueStatus,
  HistoryResult,
};

export type { OrderKind, CargoBodySize, DriverLevel, DriverDocument };

export type OrderWithNames = Order & {
  /** Passenger phone in full, when the server sends it. */
  passengerPhone?: string | null;
  passengerName: string;
  driverName: string | null;
  fromCityName: string;
  toCityName: string;
  /** The adapter's own verdict on whether this order can still be
   * cancelled — screens render it, they don't re-derive it from status. */
  canCancel: boolean;
};

export type WalletLedgerRow = WalletEntry & { driverName: string };

// ---------------------------------------------------------------------
// v2 group 4: ledger, correction, tariff settings. All values from the
// server; the UI only edits inputs and shows what comes back.
// ---------------------------------------------------------------------

/** Ledger KPI tiles; null = not reported (hidden). */
export type LedgerSummary = {
  toppedUpToday: number | null;
  /** Display text, e.g. "Payme 61% · Click 39%". */
  topupSplit: string | null;
  commissionToday: number | null;
  commissionTrips: number | null;
  driversAtLimit: number | null;
  reconciliation: { matchPct: number; at: number } | null;
};

/** A correction entry: one request (decision 2026-11-22, no second person). */
export type WalletCorrectionInput = {
  driverId: string;
  /** Optional: the ledger entry this corrects (`capabilities.correctionEntryRef`). */
  entryId?: string;
  /** Signed so'm: positive adds, negative takes. */
  amount: number;
  reason: string;
};
/** `applied: false` = the server did not apply it (e.g. it still holds
 * corrections for approval); the UI must say so, never claim success. */
export type WalletCorrectionResult = { applied: boolean; entry: WalletLedgerRow | null };

export type FuelKind = "gas" | "petrol";
export type MarkupKind = "percent" | "sum";
export type TariffMarkup = { fuel: FuelKind; markupKind: MarkupKind; markupValue: number };
export type TariffExtraKey = "free_wait_min" | "wait_per_min" | "stop" | "loader" | "cancel_fee";

/** Tariff model (doc 2.5, 2026-11-22): base = distance × 1 litre of fuel;
 * per class / body markup in percent or so'm; extra fees; level
 * commissions. Examples are the server's, for the saved values. */
export type TariffSettings = {
  cityId: string | null;
  fuel: { kind: FuelKind; label: string; pricePerLitre: number; updatedAt: number | null }[];
  classes: ({ key: TariffCarClass; label: string; seats: number | null; examplePrice: number | null } & TariffMarkup)[];
  bodies: ({ size: CargoBodySize; exampleBase: number | null; examplePrice: number | null } & TariffMarkup)[];
  extras: { key: TariffExtraKey; label: string; unit: "min" | "som"; value: number }[];
  levels: { level: DriverLevel; commissionPct: number; minTripsWeek: number | null; minRating: number | null; maxCancelsWeek: number | null }[];
  /** km the example columns use ("Misol, 40 km"). */
  exampleDistanceKm: number | null;
  /** The dark "Narx qanday hisoblanadi" card, as the server computed it. */
  example: {
    title: string;
    distanceKm: number;
    fuelLabel: string;
    fuelPrice: number;
    base: number;
    markupLabel: string;
    markup: number;
    total: number;
  } | null;
};

/** One section per save. */
export type TariffSettingsPatch =
  | { section: "fuel"; fuel: { kind: FuelKind; pricePerLitre: number }[] }
  | { section: "classes"; classes: ({ key: TariffCarClass } & TariffMarkup)[] }
  | { section: "bodies"; bodies: ({ size: CargoBodySize } & TariffMarkup)[] }
  | { section: "extras"; extras: { key: TariffExtraKey; value: number; unit: "min" | "som" }[] }
  | { section: "levels"; levels: TariffSettings["levels"] };

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

export type StatsPeriod = "today" | "7d" | "30d" | "90d";

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

/** The one fallback when the server sends no `code_length`: 6 boxes,
 * codes of 4–6 digits accepted (SMS codes may be shorter). */
export const LOGIN_CODE_FALLBACK = { length: 6, minLength: 4 } as const;

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
export type DriverQuery = {
  search?: string;
  status?: ArchivableStatusFilter<DriverStatus>;
  /** capabilities.driverRouteFilter / driverLevelFilter */
  route?: string | "all";
  level?: DriverLevel | "all";
};
export type PassengerQuery = {
  search?: string;
  status?: ArchivableStatusFilter<PassengerStatus>;
  /** Registered in this period (the server resolves the dates);
   * capabilities.passengerJoinedFilter. */
  joined?: ListPeriod;
};
export type OrderQuery = {
  search?: string;
  status?: OrderStatus | "all";
  passengerId?: string;
  /** capabilities.orderKindFilter */
  kind?: OrderKind | "all";
  /** Created in this period (the server resolves the dates);
   * capabilities.orderDateFilter. */
  period?: ListPeriod;
};

/** Relative period filters; the server turns them into dates. */
export type ListPeriod = "all" | "today" | "yesterday" | "7d" | "30d" | "90d";

/** Chip counters, decided by the server (`null` = not reported). The
 * screen never counts rows itself: lists may be cut off. */
export type ListCounts<K extends string> = Partial<Record<K | "all", number>>;

// ---------------------------------------------------------------------
// Redesign v2 (group 3): dashboard, order detail, driver profile/history.
// Every number, label and verdict below comes from the server.
// ---------------------------------------------------------------------

export type DashboardPeriod = "today" | "7d" | "30d" | "90d";

/** A KPI: value, change vs the previous period in % (server), sparkline. */
export type Kpi = { value: number; deltaPct: number | null; spark: number[] | null };

export type AttentionItem = {
  id: string;
  tone: "info" | "warning" | "danger";
  title: string;
  detail: string;
  /** Where the card leads; shown only when the admin has that section. */
  section: Section;
};

export type Dashboard = {
  period: DashboardPeriod;
  orders: Kpi | null;
  activeDrivers: Kpi | null;
  newPassengers: Kpi | null;
  /** In so'm. */
  commission: Kpi | null;
  /** Last 14 days. `passenger`/`delivery` are null when the server only
   * reports the total. */
  ordersByDay: { date: number; total: number; passenger: number | null; delivery: number | null }[] | null;
  topRoutes: { from: string; to: string; count: number }[] | null;
  /** null = not reported or not allowed for this admin. */
  recentOrders: OrderWithNames[] | null;
  attention: AttentionItem[] | null;
};

export type OrderTimelineStep = {
  title: string;
  detail: string | null;
  /** epoch ms; `estimated` marks a server forecast ("~19:40"). */
  at: number | null;
  estimated?: boolean;
  state: "done" | "current" | "pending";
};

export type OrderPriceLine = {
  label: string;
  amount: number;
  /** "payout" is the driver's share (shown green), "total" a sum line. */
  kind: "line" | "commission" | "payout" | "total";
};

export type OrderDetail = OrderWithNames & {
  passengerRating: number | null;
  driverRating: number | null;
  /** "Chevrolet Cobalt · 01 A 123 BC" */
  driverCar: string | null;
  carClassLabel: string | null;
  /** Status history (server); null = not reported. */
  steps: OrderTimelineStep[] | null;
  priceLines: OrderPriceLine[] | null;
  /** Server verdict: the order can still be edited. */
  canEdit: boolean;
};

export type DriverTripRow = {
  orderId: string;
  kind: OrderKind;
  at: number;
  fromName: string;
  toName: string;
  /** "Dilnoza R. · 2 kishi" / "Nodira S. · Kuzov M" (server display text). */
  subject: string;
  price: number;
  paymentMethod: PaymentMethod;
  commission: number | null;
  payout: number | null;
  status: OrderStatus;
  cancelledBy: "passenger" | "driver" | "admin" | null;
};

export type DriverProfile = Driver & {
  recentTrips: DriverTripRow[] | null;
};

export type DriverTripsQuery = { kind?: OrderKind | "cancelled" | "all"; month?: string /* YYYY-MM */ };
export type DriverTrips = {
  month: string;
  summary: {
    trips: number;
    tripsTotal: number;
    income: number;
    commission: number;
    commissionAvgPct: number | null;
    cancelled: number;
    cancelledPct: number | null;
  } | null;
  counts: ListCounts<OrderKind | "cancelled"> | null;
  rows: DriverTripRow[];
  /** Months the filter offers (YYYY-MM), newest first. */
  months: string[];
};
export type WalletQuery = {
  search?: string;
  type?: WalletEntryType | "all";
  /** One driver's entries (real API: driver_id). */
  driverId?: string;
  period?: ListPeriod;
};


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
