// Wire types between screens and the adapter. Everything a screen shows —
// money, statuses, limits, progress ratios, labels-as-keys — is computed by
// the adapter. Screens only render and send requests.

export type CityRef = { id: string; name: string };
export type Place = { city: CityRef; address: string };
export type PaymentType = "cash" | "card";
export type OrderKind = "passengers" | "delivery";
export type Cargo = { labelKey: string; weightKg: number };

/** Class the order was placed in (matches the driver's car class). */
export type CarClass = "economy" | "comfort" | "business";
/** Child-seat age groups: 0–1, 1–4, 4–12 years. */
export type ChildSeatAge = "infant" | "toddler" | "booster";

/** Podyezd / qavat / kvartira, as the passenger typed them. */
export type AddressDetails = { entrance?: string; floor?: string; apartment?: string };
/** Before acceptance the intercom code is withheld; `intercomOnAccept` says one exists. */
export type OfferPlace = Place & { details?: AddressDetails & { intercomOnAccept?: boolean } };
/** After acceptance the adapter adds the intercom code. */
export type TripPlace = Place & { details?: AddressDetails & { intercom?: string } };

export type OrderOption =
  | { kind: "child_seat"; ageGroup: ChildSeatAge }
  | { kind: "pet" }
  | { kind: "big_luggage" }
  | { kind: "wheelchair" }
  | { kind: "text_only" };
export type OrderOptionKind = OrderOption["kind"];

/** How the driver reaches the passenger: text-only orders switch the call button to chat. */
export type ContactMode = "call" | "text";

/** Which client tab the delivery order came from. */
export type DeliveryTab = "dostavka" | "kargo";
/** Cargo body size, S–3XL (same scale as the client's vehicle picker). Dimensions in cm. */
export type CargoBody = { sizeLabel: string; dimensionsCm: { width: number; depth: number; height: number }; maxWeightKg: number };
export type Contact = { name: string; phoneMasked: string };
export type FreightBilling = { mode: "hourly"; hours: number } | { mode: "route" };
/** Cargo-order details. Drop-offs are the order's `stops` plus its final `dropoff`. */
export type Freight = {
  tab: DeliveryTab;
  body: CargoBody;
  loaders: number;
  billing: FreightBilling;
  sender: Contact;
  receiver: Contact;
  /** The cargo owner rides along in the vehicle. */
  rideAlong: boolean;
};

/** Order details shared by the incoming offer and the active trip. */
export type OrderExtras<P extends Place> = {
  carClass: CarClass;
  /** Intermediate stops, in driving order (pickup and final dropoff excluded). */
  stops: P[];
  comment: string | null;
  options: OrderOption[];
  luggageCount: number;
  /** Set when the client ordered the ride for someone else. */
  forOther: { name: string } | null;
  contactMode: ContactMode;
  /** Set on cargo orders only. */
  freight: Freight | null;
};

export type ReviewKind =
  | "otp_verify"
  | "driver_registration"
  | "wallet_topup"
  | "card_link"
  | "trip_step"
  | "request_accept"
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
  /** Translation key explaining a rejection (e.g. another driver took the request). */
  resultKey?: string;
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
  documents: DriverDocument[];
  memberSinceYear: number;
};

/** "Imkoniyatlarim": what the driver offers. Car class and cargo body are read-only (from the car). */
export type DriverCapabilities = {
  childSeat: boolean;
  /** Age groups the seat(s) fit; empty only while childSeat is off. */
  childSeatAges: ChildSeatAge[];
  /** Every age group the driver can pick from, in display order. */
  ageGroups: ChildSeatAge[];
  pets: boolean;
  bigLuggage: boolean;
  carModel: string;
  carClass: CarClass;
  cargoBody: CargoBody;
};
export type CapabilitiesInput = Pick<DriverCapabilities, "childSeat" | "childSeatAges" | "pets" | "bigLuggage">;

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
  todayEarnings: number;
  todayTrips: number;
  unreadNotifications: number;
  debt: DebtState;
  canAcceptOrders: boolean;
  bonusActive: boolean;
  /** New matching requests the driver hasn't looked at yet (Asosiy tab badge). */
  newRequests: number;
};

export type TripStage = "to_pickup" | "waiting" | "in_progress" | "completed";
export type TripStep = { stage: TripStage; state: "done" | "active" | "upcoming" };
export type TripAction = "arrived" | "start" | "finish";

export type PassengerInfo = { name: string; rating: number; phoneMasked: string; avatarSeed: string };

/** When the passenger wants to go: a set time, a window, or "Istagan paytda". Times are epoch ms. */
export type RideTime = { kind: "exact"; at: number } | { kind: "interval"; from: number; to: number } | { kind: "any" };
export type TripWhen = {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** 0 = today, 1 = tomorrow, … */
  dayOffset: number;
  /** Start of that day, epoch ms (for display). */
  dayStart: number;
  time: RideTime;
};

export type Direction = { id: string; from: CityRef; to: CityRef };
/** Why "Qabul qilish" is disabled, decided by the adapter. `action: "wallet"` links to Hamyon. */
export type AcceptBlock = { reasonKey: string; params?: Record<string, string | number>; action?: "wallet" };

/** A passenger (or cargo) request in the feed. No passenger identity until accepted. */
export type RideRequest = OrderExtras<OfferPlace> & {
  id: string;
  directionId: string;
  pickup: OfferPlace;
  dropoff: OfferPlace;
  when: TripWhen;
  kind: OrderKind;
  /** Seats the request takes (whole car = all seats). 0 for cargo. */
  seats: number;
  wholeCar: boolean;
  cargo?: Cargo;
  /** What the passenger pays, as the adapter prices it. */
  price: number;
  /** What the driver keeps after commission. */
  earnings: { net: number; commissionPct: number };
  payment: PaymentType;
  pickupDistanceKm: number;
  distanceKm: number;
  durationMin: number;
  postedAt: number;
  /** "taken": another driver got it — shown briefly, then the adapter drops it. */
  status: "open" | "taken";
  acceptBlock: AcceptBlock | null;
};

export type FeedDate = "today" | "tomorrow" | string;
export type FeedType = "all" | "passengers" | "delivery";
export type FeedQuery = { direction: string; date: FeedDate; type: FeedType };
export type SeatSummary = { free: number; total: number; direction: Direction | null; when: { date: string; dayOffset: number; dayStart: number } };
export type FeedPage = {
  items: RideRequest[];
  seats: SeatSummary;
  directions: Direction[];
  /** Dates offered under "Sana". */
  dates: { date: string; dayOffset: number; dayStart: number }[];
};

/** An accepted request: passenger details, its own trip steps. */
export type Booking = OrderExtras<TripPlace> & {
  id: string;
  directionId: string;
  stage: TripStage;
  steps: TripStep[];
  nextAction: TripAction | null;
  pendingReviewId: string | null;
  passenger: PassengerInfo;
  pickup: TripPlace;
  dropoff: TripPlace;
  when: TripWhen;
  kind: OrderKind;
  seats: number;
  wholeCar: boolean;
  cargo?: Cargo;
  price: number;
  earnings: { net: number; commissionPct: number };
  payment: PaymentType;
  acceptedAt: number;
};
export type BookingTrip = { direction: Direction; seats: { used: number; total: number }; bookings: Booking[] };
export type BookingDay = { date: string; dayOffset: number; dayStart: number; trips: BookingTrip[] };
export type AcceptedPage = { days: BookingDay[]; count: number };

/** In-app banner / system notification for a new request. Minimal on purpose: no names or phones. */
export type RequestAlert = { id: string; requestId: string; from: string; to: string; kind: OrderKind; seats: number; wholeCar: boolean; price: number; dayOffset: number; date: string };

export type DriverRoute = { id: string; a: CityRef; b: CityRef; bothWays: boolean };
export type RoutesPage = { routes: DriverRoute[]; cities: CityRef[] };

/** Mock chat with the passenger (text-only orders). Passenger lines and
 * quick replies arrive as translation keys; the driver's own text as text. */
export type ChatMessage = { id: string; from: "driver" | "passenger"; at: number; textKey?: string; text?: string };
export type TripChat = {
  tripId: string;
  peerName: string;
  /** True when the passenger asked for text only (shows the "don't call" note). */
  textOnly: boolean;
  messages: ChatMessage[];
  /** Translation keys, already picked for the current trip stage. */
  quickReplies: string[];
  maxLength: number;
};
export type ChatSend = { replyKey: string } | { text: string };

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

export type LedgerType = "trip" | "commission" | "tip" | "topup" | "bonus" | "payout";
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

export type BonusLevel = {
  key: "bronze" | "silver" | "gold";
  tripsRequired: number;
  commissionPct: number;
  /** 0..1 position of this milestone on the weekly progress bar. */
  position: number;
  reached: boolean;
};
export type BonusRule = { key: string; progress: number; target: number; done: boolean; ratio: number };
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
export type NotificationPrefs = {
  master: boolean;
  newOrders: boolean;
  payments: boolean;
  news: boolean;
  bonus: boolean;
  /** The system-notification explanation was shown once (accepted or dismissed). */
  systemAsked?: boolean;
};

export type HelpTopic = "order" | "payment" | "app" | "docs";
export type HelpRequest = { id: string; topic: HelpTopic; message?: string; createdAt: number; status: "in_review" | "resolved" };

/** "routes": verified, but the driver still has to pick Yo'nalishlarim before requests arrive. */
export type SessionStage = "signed_out" | "personal" | "car" | "documents" | "review" | "routes" | "active";
export type Session = { stage: SessionStage; phone?: string; documentsReviewId?: string };

export type RegistrationOptions = {
  cities: CityRef[];
  carModels: string[];
  carColors: { key: string; hex: string }[];
  years: number[];
  platePattern: string;
};

export type CancelReason = { key: string };

/** Which kind of request a test-panel event produces (sample-data mode). */
export type TestOrderVariant = "random" | "full" | "cargo";

export type TestPreset = "new" | "active" | "near_debt" | "debt" | "bonus";
