// Operator windows (2026-11-24): search, passengers, passenger card and
// driver card (doc 2.5 "Operator huquqlari"). Types only: no values here,
// so the http build never pulls in sample data.
//
// Every number, status and allowed action comes from the server. The
// screens only choose labels and colours for the codes below.
import type { CargoBodySize, DriverStatus, ListPeriod, OrderKind, OrderStatus, PassengerStatus, PaymentMethod, TariffCarClass, WalletEntryType } from "../types";

/** One server page. `page` is 1-based. */
export type OpPage<T> = { rows: T[]; total: number; page: number; pageSize: number };

/** Buttons the server allows on a card, for this operator and this person
 * right now. A button not in the list is not shown. */
export type OpCardAction =
  | "call"
  /** "Menejerga so'rov" (opens the request modal via ?request=…). */
  | "request"
  /** "Qaytarish so'rash" on the payments tab (same request modal). */
  | "refund_request"
  | "sms_unlock"
  | "sms_resend"
  | "add_note";

export type OpSubjectKind = "passenger" | "driver";
export type OpSubject = { kind: OpSubjectKind; id: string };

/** One row of "Holat tarixi" / "Tekshiruv tarixi". `tone` picks the dot. */
export type OpTimelineItem = { id: string; title: string; detail: string | null; at: number; tone: "success" | "danger" | "neutral" };

// ---------------------------------------------------------------- search

export type OpSearchPassengerHit = { id: string; name: string; phone: string; ordersCount: number; status: PassengerStatus };
export type OpSearchDriverHit = {
  id: string;
  name: string;
  phone: string;
  carModel: string;
  plate: string;
  status: DriverStatus;
  atDebtLimit: boolean | null;
};
export type OpSearchOrderHit = {
  id: string;
  kind: OrderKind;
  from: string;
  to: string;
  createdAt: number;
  /** The other side shown in the sub line ("haydovchi Aziz Karimov"). */
  person: { role: "driver" | "passenger"; name: string } | null;
  price: number;
  status: OrderStatus;
};
export type OpSearchResult = {
  passengers: OpSearchPassengerHit[];
  drivers: OpSearchDriverHit[];
  orders: OpSearchOrderHit[];
  /** Totals per group (the lists may be cut to the first N). */
  counts: { passengers: number; drivers: number; orders: number };
};

// ------------------------------------------------------- passengers list

export type OpPassengerStatusFilter = "all" | PassengerStatus;
export type OpPassengersQuery = { search?: string; status: OpPassengerStatusFilter; page: number };
export type OpPassengerRow = {
  id: string;
  name: string;
  phone: string;
  ordersCount: number;
  rating: number | null;
  lastTripAt: number | null;
  status: PassengerStatus;
};
export type OpPassengersPage = OpPage<OpPassengerRow> & {
  /** Chip counts for the same search, every status. */
  counts: Partial<Record<OpPassengerStatusFilter, number>>;
};

// ---------------------------------------------------------- passenger card

export type OpPassengerCard = {
  id: string;
  /** "P-20931" */
  displayId: string;
  name: string;
  phone: string;
  status: PassengerStatus;
  joinedAt: number;
  /** "o'zbek" */
  language: string | null;
  actions: OpCardAction[];
  /** Tab counters and the red dot on "Kirish (SMS)". */
  tabs: { orders: number; payments: number; notes: number; smsAlert: boolean };
  /** Why the passenger is warned or blocked (the banner under the tabs). */
  statusNote: { text: string; byName: string; at: number } | null;
  stats: { orders: number; cancelled: number; cancelledThisWeek: number; bonusBalance: number; rating: number | null };
  profile: {
    /** "1.8.2 · iPhone, iOS 18" */
    app: string | null;
    mainPayment: PaymentMethod | null;
    savedAddresses: string[];
    lastOrder: { id: string; createdAt: number } | null;
  };
  statusHistory: OpTimelineItem[];
  deletionRequest: { requestedAt: number; reason: string | null; autoDeleteAt: number } | null;
};

export type OpPassengerOrdersFilter = "all" | "active" | "completed" | "cancelled";
export type OpPassengerOrdersQuery = { status: OpPassengerOrdersFilter; period: ListPeriod; page: number };
export type OpPassengerOrderRow = {
  id: string;
  kind: OrderKind;
  from: string;
  to: string;
  createdAt: number;
  driver: { name: string; phone: string } | null;
  payment: PaymentMethod;
  price: number;
  status: OrderStatus;
  cancelledBy: "passenger" | "driver" | "admin" | null;
};
export type OpPassengerOrdersPage = OpPage<OpPassengerOrderRow> & { counts: Partial<Record<OpPassengerOrdersFilter, number>> };

export type OpPaymentType = "card" | "payme" | "click" | "cash" | "refund" | "tip";
export type OpPaymentStatus = "held" | "paid" | "refunded" | "failed" | "to_driver";
export type OpPaymentsFilter = "all" | "card" | "payme" | "click" | "refund" | "tip";
export type OpPaymentsQuery = { type: OpPaymentsFilter; page: number };
export type OpPaymentRow = {
  id: string;
  at: number;
  type: OpPaymentType;
  orderId: string | null;
  /** Provider transaction ID ("PM-7731-0042"); null for cash. */
  txnId: string | null;
  cardLast4: string | null;
  /** Positive. A refund goes back to the passenger. */
  amount: number;
  status: OpPaymentStatus;
};
export type OpPassengerPayments = OpPage<OpPaymentRow> & {
  summary: {
    paid: number;
    refunded: number;
    refundCount: number;
    tips: number;
    tipCount: number;
    failedCount: number;
    /** Last failed payment, for the tile's sub line. */
    lastFailed: { type: OpPaymentType; at: number } | null;
  };
  counts: Partial<Record<OpPaymentsFilter, number>>;
};

export type OpBonusEntry = { id: string; at: number; text: string; orderId: string | null; amount: number; balanceAfter: number };
export type OpPromoCode = {
  code: string;
  discount: { percent: number; maxAmount: number | null } | { amount: number };
  usedAt: number | null;
  validUntil: number | null;
  status: "used" | "active" | "expired";
};
export type OpPassengerBonus = { balance: number; entries: OpBonusEntry[]; promos: OpPromoCode[] };

// ------------------------------------------------------- SMS and notes (both cards)

export type OpSmsType = "login" | "login_retry" | "login_resent";
export type OpSmsResult = "delivered" | "entered" | "wrong_code" | "limit" | "not_delivered";
export type OpSmsPeriod = "7d" | "14d" | "30d";
export type OpSmsRow = { id: string; at: number; type: OpSmsType; provider: string; result: OpSmsResult; limit: { used: number; max: number } | null };
export type OpSmsInfo = {
  lastAt: number | null;
  lastResult: OpSmsResult | null;
  attempts: { used: number; max: number };
  /** Set while login is locked after wrong codes. */
  lock: { wrongAttempts: number; minutes: number } | null;
  /** sms_unlock / sms_resend, when the server allows them now. */
  actions: OpCardAction[];
  log: OpSmsRow[];
};

export type OpNoteCategory = "complaint" | "login" | "info" | "payment";
export type OpNote = { id: string; authorName: string; category: OpNoteCategory; text: string; at: number };
export type OpRequestType = "refund" | "sms_unlock" | "ledger_fix" | "compensation" | "penalty_cancel" | "block" | "unblock" | "phone_change" | "deletion_cancel";
export type OpRequestStatus = "pending" | "approved" | "rejected";
/** A "Menejerga so'rov" about this person. `amount` is signed for ledger fixes. */
export type OpSubjectRequest = { id: string; displayId: string; type: OpRequestType; amount: number | null; status: OpRequestStatus };
export type OpNotes = { notes: OpNote[]; requests: OpSubjectRequest[]; actions: OpCardAction[] };

// ------------------------------------------------------------- driver card

export type OpDriverCard = {
  id: string;
  /** "D-10482" */
  displayId: string;
  name: string;
  phone: string;
  status: DriverStatus;
  atDebtLimit: boolean | null;
  carModel: string;
  plate: string;
  /** The driver has an order in progress right now ("Safarda"). */
  onTrip: boolean;
  actions: OpCardAction[];
  tabs: { docs: number; trips: number; cancels: number; complaints: number; notes: number };
  /** The last block, shown as a banner while it is recent. */
  lastBlock: { from: number; to: number | null; reason: string; blockedBy: string; unblockedBy: string | null } | null;
  stats: { trips: number; rating: number | null; cancelsThisMonth: number; balance: number };
  car: {
    /** "Chevrolet Cobalt, oq, 2021" */
    title: string;
    plate: string;
    carClass: TariffCarClass | null;
    seats: number | null;
    routes: string[];
    bodies: CargoBodySize[];
    loaderHelp: boolean | null;
  };
  app: {
    /** "2.0.3 · Android 14" */
    version: string | null;
    lastSeenAt: number | null;
    lastLocation: string | null;
    speedKmh: number | null;
    currentTrip: { id: string; from: string; to: string } | null;
    /** Hint shown under the block, e.g. the minimum supported version. */
    minVersion: string | null;
  };
  statusHistory: OpTimelineItem[];
};

export type OpDriverDoc = {
  id: string;
  title: string;
  detail: string;
  status: "verified" | "checking" | "rejected";
  /** Grey note (earlier attempt and so on). */
  note: string | null;
  rejectReason: string | null;
};
export type OpDriverDocs = { docs: OpDriverDoc[]; history: OpTimelineItem[] };

export type OpLedgerRow = {
  id: string;
  at: number;
  type: WalletEntryType;
  orderId: string | null;
  txnId: string | null;
  amount: number;
  balanceAfter: number;
};
export type OpTopUp = { id: string; at: number; provider: "payme" | "click" | "card"; txnId: string; amount: number; status: "ok" | "failed" | "pending" };
export type OpDriverWalletQuery = { month: string; page: number };
export type OpDriverWallet = {
  balance: number;
  debtLimit: number;
  /** How much more the driver may spend before the limit (server). */
  untilLimit: number;
  monthCommission: number;
  /** Fill of the balance bar, 0–100 (server). */
  barPercent: number;
  months: string[];
  month: string;
  ledger: OpPage<OpLedgerRow>;
  topUps: OpTopUp[];
};

export type OpDriverTripsFilter = "all" | "passenger" | "delivery" | "cancelled";
export type OpDriverTripsQuery = { filter: OpDriverTripsFilter; month: string; page: number };
export type OpDriverTripRow = {
  id: string;
  kind: OrderKind;
  from: string;
  to: string;
  at: number;
  passenger: { name: string; phone: string } | null;
  bodySize: CargoBodySize | null;
  price: number;
  commission: number | null;
  status: OrderStatus;
};
export type OpDriverTrips = OpPage<OpDriverTripRow> & {
  summary: { trips: number; earned: number; commission: number; avgPrice: number };
  counts: Partial<Record<OpDriverTripsFilter, number>>;
  months: string[];
  month: string;
};

export type OpCancelsPeriod = "1m" | "3m" | "12m";
export type OpCancelRow = {
  id: string;
  at: number;
  orderId: string;
  by: "driver" | "passenger" | "system";
  reason: string;
  penalty: number | null;
  penaltyStatus: "charged" | "none" | "waived";
};
export type OpDriverCancels = {
  summary: { driverCancels: number; penalties: number; sharePct: number; avgSharePct: number };
  rows: OpCancelRow[];
};

export type OpComplaintRow = {
  id: string;
  at: number;
  fromName: string;
  fromPhone: string;
  topic: string;
  orderId: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed" | "blocked";
};
export type OpReview = { id: string; stars: number; author: string; text: string | null; at: number };
export type OpDriverReviews = {
  rating: number | null;
  ratingBasis: number;
  /** Share of each star value, 5 → 1, in percent (server). */
  distribution: { stars: number; percent: number }[];
  openComplaints: number;
  complaints: OpComplaintRow[];
  reviews: OpReview[];
};
