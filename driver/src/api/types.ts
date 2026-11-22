// Wire types between screens and the adapter. Everything a screen shows —
// money, statuses, limits, progress ratios, labels-as-keys — is computed by
// the adapter. Screens only render and send requests.

export type CityRef = { id: string; name: string };
/** `lat`/`lng`: where the place is on the map, when the adapter knows
 * (sample data: mock coordinates around the city's centre). */
export type Place = { city: CityRef; address: string; lat?: number; lng?: number };
export type PaymentType = "cash" | "card";
export type OrderKind = "passengers" | "delivery";
export type Cargo = { labelKey: string; weightKg: number };

/** Class the order was placed in (matches the driver's car class). */
export type CarClass = "economy" | "comfort" | "business" | "minivan";
/** Seat positions in a passenger car (Offer/Order.seat_ids). */
export type SeatPosition = "front" | "back-left" | "back-mid" | "back-right";

/** Podyezd / qavat / kvartira, as the passenger typed them. */
export type AddressDetails = { entrance?: string; floor?: string; apartment?: string };
/** Before acceptance the intercom code is withheld; `intercomOnAccept` says one exists. */
export type OfferPlace = Place & { details?: AddressDetails & { intercomOnAccept?: boolean } };
/** After acceptance the adapter adds the intercom code. */
export type TripPlace = Place & { details?: AddressDetails & { intercom?: string } };

// Wishes / options (child seat, pet, AC, wheelchair, text only) were removed
// everywhere (decision 2026-11-22). Luggage count and the comment stay.

/** Which client tab the delivery order came from. */
export type DeliveryTab = "dostavka" | "kargo";
/** Cargo body size, S–3XL (same scale as the client's vehicle picker). Dimensions in cm. */
export type CargoBody = { sizeLabel: string; dimensionsCm: { width: number; depth: number; height: number }; maxWeightKg: number };
/** `callNumber`: dialable (server, after acceptance); without it no call button. */
export type Contact = { name: string; phoneMasked: string; callNumber?: string };
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
  /** The cargo is insured (server). */
  insured?: boolean;
};

/** Order details shared by the incoming offer and the active trip. */
export type OrderExtras<P extends Place> = {
  /** Absent when the server didn't send one (per-seat orders). */
  carClass?: CarClass;
  /** Intermediate stops, in driving order (pickup and final dropoff excluded). */
  stops: P[];
  comment: string | null;
  luggageCount: number;
  /** Set when the client ordered the ride for someone else. */
  forOther: { name: string } | null;
  /** Set on cargo orders only. */
  freight: Freight | null;
  /** Which seats the passenger booked, when the server says (real backend). */
  seatIds?: SeatPosition[];
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
  /** Real backend only: the payment provider page to open (top-up, card link). */
  redirectUrl?: string;
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
  // Optional: the real backend's profile doesn't carry these (see docs/backend-gaps).
  ratingCount?: number;
  totalTrips?: number;
  city?: CityRef;
  /** Absent until registration step 2 is saved. */
  car?: Car;
  documents: DriverDocument[];
  memberSinceYear?: number;
  /** Share of offered requests the driver accepted, 0–100 (server). */
  acceptancePct?: number;
};

/**
 * "Imkoniyatlarim" (decision 2026-11-22): only the cargo body sizes the car
 * takes (S–3XL, several allowed) and whether the driver helps load. The size
 * list comes from the server.
 */
export type DriverCapabilities = {
  bodySizes: string[];
  /** Every size the driver can pick from, in display order (S … 3XL). */
  availableBodySizes: string[];
  loaderHelp: boolean;
  /** From the driver's car; absent when the server has none. */
  carModel?: string;
  carClass?: CarClass;
};
export type CapabilitiesInput = Pick<DriverCapabilities, "bodySizes" | "loaderHelp">;

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
  /** How much more can be spent before the limit ("134 500 zaxira"), when the server says. */
  headroom?: number;
  /** Blocked: the smallest top-up that lets requests in again (server). */
  minToUnblock?: number;
  /** The top-up the server suggests. */
  recommendedTopup?: number;
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
  /** A trip was accepted and isn't finished yet (drives GPS reporting). */
  tripActive?: boolean;
  /** Minutes worked today (server). */
  todayWorkMin?: number;
  /** Earnings of the last 7 days, oldest first (the mini chart). */
  week?: { date: string; amount: number }[];
};

export type TripStage = "to_pickup" | "waiting" | "in_progress" | "completed";
export type TripStep = { stage: TripStage; state: "done" | "active" | "upcoming" };
export type TripAction = "arrived" | "start" | "finish";

/** `callNumber`: a dialable number from the server (e.g. a masked-call proxy); without it there is no call button. */
export type PassengerInfo = { name: string; rating: number; phoneMasked: string; avatarSeed: string; callNumber?: string };

/** One line of the price breakdown, as the server computed it. Label: `price.<key>` (unknown keys show the amount only). */
export type PriceLine = { key: string; amount: number; pct?: number };

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
  /** Absent when the server doesn't say when (the real API's offers carry no time). */
  when?: TripWhen;
  kind: OrderKind;
  /** Seats the request takes (whole car = all seats). 0 for cargo. */
  seats: number;
  wholeCar: boolean;
  cargo?: Cargo;
  /** What the passenger pays, as the adapter prices it. */
  price: number;
  /** What the driver keeps after commission, when the server gives the commission (pct only when it says). */
  earnings?: { net: number; commissionPct?: number };
  payment?: PaymentType;
  pickupDistanceKm?: number;
  /** Minutes to the pickup, when the server gives an ETA instead of a distance. */
  pickupEtaMin?: number;
  distanceKm: number;
  durationMin: number;
  postedAt?: number;
  /** "taken": another driver got it — shown briefly, then the adapter drops it. */
  status: "open" | "taken";
  acceptBlock: AcceptBlock | null;
  /** When the offer window closes (server); the Request screen counts down to it. Absent: no countdown. */
  expiresAt?: number;
  /** Who is asking, when the server shares it before acceptance. */
  requester?: { name: string; tripsCount?: number; rating?: number };
  /** Seats in the driver's car, for the seat picture (server). */
  carSeats?: number;
  /** The server's price breakdown (trip, loaders, commission…). */
  priceLines?: PriceLine[];
};

export type FeedDate = "today" | "tomorrow" | string;
export type FeedType = "all" | "passengers" | "delivery";
export type FeedQuery = { direction: string; date: FeedDate; type: FeedType };
export type SeatSummary = { free: number; total: number; direction: Direction | null; when: { date: string; dayOffset: number; dayStart: number } };
export type FeedPage = {
  items: RideRequest[];
  /** null when the server has no seat summary. */
  seats: SeatSummary | null;
  /** The directions the driver serves; null = unknown right now (the routes could not be read). */
  directions: Direction[] | null;
  /** Dates offered under "Sana". */
  dates: { date: string; dayOffset: number; dayStart: number }[];
};

/** An accepted request: passenger details, its own trip steps. */
export type Booking = OrderExtras<TripPlace> & {
  id: string;
  directionId: string;
  stage: TripStage;
  steps: TripStep[];
  /** The step button: the server's next step (real backend: Trip.next_actions). */
  nextAction: TripAction | null;
  /** Server verdict that the trip can still be cancelled. Undefined = allowed (sample data). */
  canCancel?: boolean;
  pendingReviewId: string | null;
  /** Absent when the server doesn't share the passenger (real API: no field yet). */
  passenger?: PassengerInfo;
  pickup: TripPlace;
  dropoff: TripPlace;
  when?: TripWhen;
  kind: OrderKind;
  seats: number;
  wholeCar: boolean;
  cargo?: Cargo;
  price: number;
  /** Absent when the server hasn't given the commission yet (real backend before completion). */
  earnings?: { net: number; commissionPct?: number };
  payment?: PaymentType;
  acceptedAt: number;
  /** To the pickup (to_pickup) or the next stop (in_progress), when the server says. */
  eta?: { minutes: number; distanceKm?: number };
  /** Waiting at the pickup: free minutes, then a per-minute price — all from the server. */
  waiting?: { arrivedAt: number; freeMinutes: number; pricePerMinute: number; charge?: number; passengerNotified?: boolean };
  /** On the way: next stop, arrival time and distance left (server). `ratio`: 0..1 of the route driven. */
  progress?: { startedAt?: number; nextStop?: TripPlace; arriveAt?: number; remainingKm?: number; ratio?: number };
};
/** seats.total 0 = unknown (not shown). */
export type BookingTrip = { direction: Direction; seats: { used: number; total: number }; bookings: Booking[] };
/** `undated`: the server gave no trip date; the day heading is hidden. */
export type BookingDay = { date: string; dayOffset: number; dayStart: number; trips: BookingTrip[]; undated?: boolean };
/** `activeBookingId`: the booking the driver handles next (server order). */
export type AcceptedPage = { days: BookingDay[]; count: number; activeBookingId?: string };

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
  /** Absent when the server doesn't label the payment (e.g. wallet). */
  payment?: PaymentType;
  /** Cash the driver collects from the passenger (server). */
  cashToCollect?: number;
  passengerName?: string;
  /** Destination city name, for "Safar tugadi · Samarqand". */
  destination?: string;
  /** The driver already rated this passenger. */
  passengerRating?: number | null;
};

export type HistoryRange = "all" | "today" | "week" | "month";
/** `page`: 1-based "load more" page (cursor pages behind it in http mode). */
/** `kind`: passengers / delivery only (absent: both). */
export type HistoryFilter = { range: HistoryRange; minEarnings: number; city: string; kind?: OrderKind; page?: number };
export type HistoryItem = {
  id: string;
  createdAt: number;
  from: CityRef;
  to: CityRef;
  /** Empty when the server doesn't share the passenger. */
  passengerName: string;
  earnings: number;
  /** Absent for payment methods without a label (e.g. wallet). */
  payment?: PaymentType;
  ratingReceived: number | null;
  status: "completed" | "cancelled";
  kind: OrderKind;
};
/** The period the list covers, as the server sums it (Tarix top: total, trips, bars per day). */
export type HistorySummary = { from: number; to: number; total: number; trips: number; days?: { date: string; amount: number }[] };
export type HistoryPage = {
  items: HistoryItem[];
  summary?: HistorySummary;
  /** Absent when the server doesn't count (cursor pages). */
  total?: number;
  filterOptions: { minEarnings: number[]; ranges: HistoryRange[] };
  /** Another page can be loaded. */
  hasMore?: boolean;
};

export type TimelineEvent = { stage: "accepted" | "arrived" | "started" | "completed" | "cancelled"; at: number };
export type TripDetail = HistoryItem & {
  pickup: Place;
  dropoff: Place;
  distanceKm: number;
  /** 0 = unknown (not shown). */
  durationMin: number;
  /** Absent when the server doesn't share the passenger. */
  passenger?: PassengerInfo;
  passengers?: number;
  cargo?: Cargo;
  timeline: TimelineEvent[];
  /** commissionPct absent when the server gives only the amount. */
  breakdown: { base: number; commission: number; commissionPct?: number; bonusDiscount: number; net: number };
  cancelReasonKey?: string;
};

export type LedgerType = "trip" | "commission" | "tip" | "topup" | "bonus" | "payout" | "correction";
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
/** `total` only when the server reports it (cursor pages don't). */
export type LedgerPage = { items: LedgerEntry[]; page: number; pageCount: number; total?: number };

export type LinkedCard = { id: string; brand: "uzcard" | "humo"; last4: string; provider: PayProvider };
export type PayProvider = "payme" | "click";

export type WalletSummary = {
  balance: number;
  debt: DebtState;
  // Optional: the real backend has no today stats, commission info or card list yet.
  today?: { earnings: number; trips: number; avgPerTrip: number };
  commission?: { pct: number; bonusPct: number; bonusActive: boolean; levelKey?: "bronze" | "silver" | "gold" };
  cards?: LinkedCard[];
  /** This week's earnings and the change against last week, in percent (server). */
  week?: { earnings: number; changePct?: number };
};

/** From the server; `presets` may be empty and `min` / `max` absent (the server still validates the amount). */
export type TopupOptions = { presets: number[]; min?: number; max?: number; providers: PayProvider[]; savedCards?: LinkedCard[] };

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

/** Registration stages, in the order of the screens: personal → license → car → selfie → review.
 * "routes": verified, but the driver still has to pick Yo'nalishlarim before requests arrive.
 * "blocked": the account is blocked; only logout is possible. */
export type SessionStage = "signed_out" | "personal" | "license" | "car" | "selfie" | "review" | "routes" | "active" | "blocked";
/** `notice: "rejected"`: the application came back rejected — registration is open again. */
export type Session = { stage: SessionStage; phone?: string; documentsReviewId?: string; notice?: "rejected" };

/** What the driver can serve (registration "Xizmat turi"). */
export type ServiceType = "passengers" | "delivery";

/** Form choices for registration, from the server (the real backend has no endpoint yet: static lists). */
export type RegistrationOptions = {
  cities: CityRef[];
  carBrands: { brand: string; models: string[] }[];
  carColors: { key: string; hex: string }[];
  years: number[];
  seatCounts: number[];
  carClasses: CarClass[];
  serviceTypes: ServiceType[];
  /** Driving-licence categories offered under "Toifa". */
  licenseCategories: string[];
  platePattern: string;
  /** Real photo files (file picker / camera). false: the sample-data adapter simulates the picker. */
  realDocuments?: boolean;
};

/** Step 1. `referralCode` is optional. Dates are YYYY-MM-DD. */
export type PersonalInput = { firstName: string; lastName: string; birthDate: string; cityId: string; referralCode?: string };
/** Step 2: driving licence. `frontRef` / `backRef` come from uploadDocument. */
export type LicenseInput = { number: string; issuedAt: string; expiresAt: string; categories: string[]; frontRef: string; backRef: string };
/** Step 3: car. Plate as typed ("01 A 123 BC"). */
export type CarInput = {
  brand: string;
  model: string;
  plate: string;
  year: number;
  seats: number;
  colorKey: string;
  carClass: CarClass;
  serviceTypes: ServiceType[];
  techPassportFrontRef: string;
  techPassportBackRef: string;
  carPhotoRef: string;
};
/** Step 4: selfie and the terms checkbox (must be true). */
export type SelfieInput = { selfieRef: string; acceptTerms: boolean };

/** Per-section progress of the automatic check (RegReview). */
export type RegistrationSectionKey = "personal" | "license" | "car" | "selfie";
export type RegistrationSectionStatus = "approved" | "checking" | "queued" | "rejected";
export type RegistrationReview = {
  sections: { key: RegistrationSectionKey; status: RegistrationSectionStatus }[];
  /** "Odatda N daqiqagacha", when the server says. */
  etaMinutes?: number;
};

/** Driver terms and privacy policy pages, when the server gives them. */
export type LegalLinks = { termsUrl?: string; privacyUrl?: string };

/** Document photo slots in registration. */
export type DocSlot = "license_front" | "license_back" | "tech_passport_front" | "tech_passport_back" | "car_photo" | "selfie";

export type CancelReason = { key: string };

/** Which kind of request a test-panel event produces (sample-data mode). */
export type TestOrderVariant = "random" | "full" | "cargo";

export type TestPreset = "new" | "active" | "near_debt" | "debt" | "bonus";
