// Wire types between screens and the adapter. Everything a screen shows —
// money, statuses, limits, progress ratios, labels-as-keys — is computed by
// the adapter. Screens only render and send requests.

export type CityRef = { id: string; name: string };
export type Place = { city: CityRef; address: string };
export type PaymentType = "cash" | "card";
export type OrderKind = "passengers" | "delivery";
export type Cargo = { labelKey: string; weightKg: number };

export type ReviewKind =
  | "otp_verify"
  | "driver_registration"
  | "wallet_topup"
  | "card_link"
  | "trip_step"
  | "profile_change"
  | "help_request";

export type ReviewRequest = {
  id: string;
  kind: ReviewKind;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  resolvesAt: number;
  payload?: Record<string, unknown>;
  applied?: boolean;
};

export type DocumentStatus = "none" | "auto_review" | "approved";
export type DriverDocument = { kind: "license" | "registration"; status: DocumentStatus; fileName?: string };

export type Car = { model: string; color: string; colorHex: string; plate: string; year: number };

export type DriverProfile = {
  id: string;
  name: string;
  phoneMasked: string;
  avatarSeed: string;
  rating: number;
  ratingCount: number;
  totalTrips: number;
  city: CityRef;
  car: Car;
  online: boolean;
  documents: DriverDocument[];
  memberSinceYear: number;
};

export type DebtLevel = "ok" | "near" | "blocked";
export type DebtState = {
  level: DebtLevel;
  balance: number;
  /** Negative number, e.g. -50 000 */
  limit: number;
  /** Current debt as an absolute number (0 when balance ≥ 0). */
  debtAmount: number;
  /** 0..1 — how much of the limit is used. */
  usedRatio: number;
};

export type HomeSummary = {
  online: boolean;
  todayEarnings: number;
  todayTrips: number;
  unreadNotifications: number;
  debt: DebtState;
  canAcceptOrders: boolean;
  bonusActive: boolean;
};

export type Offer = {
  id: string;
  pickup: Place;
  dropoff: Place;
  distanceKm: number;
  durationMin: number;
  pickupEtaMin: number;
  priceMin: number;
  priceMax: number;
  kind: OrderKind;
  passengers?: number;
  cargo?: Cargo;
  payment: PaymentType;
  createdAt: number;
  expiresAt: number;
  /** Total countdown length in seconds (30). */
  countdownSec: number;
};

export type TripStage = "to_pickup" | "waiting" | "in_progress" | "completed";
export type TripStep = { stage: TripStage; state: "done" | "active" | "upcoming" };
export type TripAction = "arrived" | "start" | "finish";

export type PassengerInfo = { name: string; rating: number; phoneMasked: string; avatarSeed: string };

export type ActiveTrip = {
  id: string;
  stage: TripStage;
  steps: TripStep[];
  nextAction: TripAction | null;
  /** Review id when the current step is being confirmed. */
  pendingReviewId: string | null;
  passenger: PassengerInfo;
  pickup: Place;
  dropoff: Place;
  remainingKm: number;
  remainingMin: number;
  price: number;
  payment: PaymentType;
  kind: OrderKind;
  passengers?: number;
  cargo?: Cargo;
  acceptedAt: number;
};

export type TripSummary = {
  tripId: string;
  gross: number;
  commissionPct: number;
  commission: number;
  baseCommissionPct: number;
  /** What the commission would have been without the bonus. */
  baseCommission: number;
  /** True when a bonus waived the commission (show it crossed out). */
  commissionWaived: boolean;
  net: number;
  ratingReceived: number | null;
  payment: PaymentType;
};

export type HistoryRange = "all" | "today" | "week" | "month";
export type HistoryFilter = { range: HistoryRange; minEarnings: number; city: string };
export type HistoryItem = {
  id: string;
  createdAt: number;
  from: CityRef;
  to: CityRef;
  passengerName: string;
  earnings: number;
  payment: PaymentType;
  ratingReceived: number | null;
  status: "completed" | "cancelled";
  kind: OrderKind;
};
export type HistoryPage = {
  items: HistoryItem[];
  total: number;
  filterOptions: { minEarnings: number[]; ranges: HistoryRange[] };
};

export type TimelineEvent = { stage: "accepted" | "arrived" | "started" | "completed" | "cancelled"; at: number };
export type TripDetail = HistoryItem & {
  pickup: Place;
  dropoff: Place;
  distanceKm: number;
  durationMin: number;
  passenger: PassengerInfo;
  passengers?: number;
  cargo?: Cargo;
  timeline: TimelineEvent[];
  breakdown: { base: number; commission: number; commissionPct: number; bonusDiscount: number; net: number };
  cancelReasonKey?: string;
};

export type LedgerType = "trip" | "commission" | "topup" | "bonus";
export type LedgerEntry = {
  id: string;
  type: LedgerType;
  amount: number;
  createdAt: number;
  descKey: string;
  descParams?: Record<string, string | number>;
  balanceAfter: number;
};
export type LedgerQuery = { type: LedgerType | "all"; range: HistoryRange; page: number };
export type LedgerPage = { items: LedgerEntry[]; page: number; pageCount: number; total: number };

export type LinkedCard = { id: string; brand: "uzcard" | "humo"; last4: string; provider: PayProvider };
export type PayProvider = "payme" | "click";

export type WalletSummary = {
  balance: number;
  debt: DebtState;
  today: { earnings: number; trips: number; avgPerTrip: number };
  commission: { pct: number; bonusPct: number; bonusActive: boolean };
  cards: LinkedCard[];
};

export type TopupOptions = { presets: number[]; min: number; max: number; providers: PayProvider[] };

export type BonusLevel = { key: "bronze" | "silver" | "gold"; tripsRequired: number; commissionPct: number };
export type BonusRule = { key: string; progress: number; target: number; done: boolean };
export type BonusInfo = {
  active: boolean;
  currentLevel: BonusLevel;
  nextLevel: BonusLevel | null;
  levels: BonusLevel[];
  weekTrips: number;
  /** 0..1 progress toward next level (1 when at top). */
  progressRatio: number;
  tripsToNext: number;
  commissionPct: number;
  baseCommissionPct: number;
  rules: BonusRule[];
  savedThisWeek: number;
  resetsInDays: number;
};

export type NotificationKind = "order" | "wallet" | "docs" | "bonus" | "news";
export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  titleKey: string;
  bodyKey: string;
  params?: Record<string, string | number>;
  createdAt: number;
  read: boolean;
};
export type NotificationPrefs = { master: boolean; newOrders: boolean; payments: boolean; news: boolean; bonus: boolean };

export type HelpTopic = "order" | "payment" | "app" | "docs";
export type HelpRequest = { id: string; topic: HelpTopic; message?: string; createdAt: number; status: "in_review" | "resolved" };

export type SessionStage = "signed_out" | "personal" | "car" | "documents" | "review" | "active";
export type Session = { stage: SessionStage; phone?: string; documentsReviewId?: string };

export type RegistrationOptions = {
  cities: CityRef[];
  carModels: string[];
  carColors: { key: string; hex: string }[];
  years: number[];
  platePattern: string;
};

export type CancelReason = { key: string };

export type DemoPreset = "new" | "online" | "near_debt" | "debt" | "bonus" | "offline";
