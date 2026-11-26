import type {
  AcceptedPage, CancelReason, CapabilitiesInput, ChatSend, DriverCapabilities,
  DriverProfile, FeedPage, FeedQuery, HelpRequest, HelpTopic, HistoryFilter, HistoryPage, HomeSummary, LedgerPage, LedgerQuery,
  NotificationItem, NotificationPrefs, PayProvider, RegistrationOptions, RequestAlert, ReviewRequest, RoutesPage, Session,
  TopupOptions, TripChat, TripDetail, TripSummary, WalletSummary, Car, DocSlot, Booking, RideRequest,
  CarInput, LicenseInput, PersonalInput, RegistrationReview, SelfieInput,
} from "./types";

/**
 * What the active backend supports. The sample-data adapter has everything;
 * the real-backend adapter turns off what api/openapi.yml has no endpoint
 * for, and screens hide those features instead of showing broken states.
 */
export type ApiCapabilities = {
  routes: boolean;
  rejectRequest: boolean;
  /** Direction / date / type filters on the request feed. */
  feedFilters: boolean;
  /** "Bo'sh joylar" summary above the feed. */
  seatSummary: boolean;
  /** "Yetib keldim" trip step. */
  arrivedStep: boolean;
  cancelBooking: boolean;
  tripChat: boolean;
  tripSummary: boolean;
  history: boolean;
  /** Range / min-earnings / city filters and the total count on the history list. */
  historyFilters: boolean;
  /** Requests are matched against Yo'nalishlarim / Imkoniyatlarim (the screens may
   * promise it). The real backend stores both but doesn't match on them yet. */
  profileMatching: boolean;
  help: boolean;
  /** "Imkoniyatlarim". */
  driverCapabilities: boolean;
  /** Phone / car changes from "Shaxsiy ma'lumotlar". */
  profileChangePhone: boolean;
  profileChangeCar: boolean;
  /** In-app banner for new requests. */
  requestAlerts: boolean;
  /** Type / period filters and the total count on the wallet ledger. */
  ledgerFilters: boolean;
  /** Per-category notification switches (new orders, payments, bonus). */
  notificationCategories: boolean;
  /** GPS reporting while the feed is open or a trip is active. */
  locationReporting: boolean;
  /** The driver rates the passenger after the trip. */
  ratePassenger: boolean;
  /** SOS signal to IZGO from a trip. */
  sos: boolean;
  /** Delete the account from the app (otherwise the public site's page). */
  deleteAccount: boolean;
  /** Registration extras the server doesn't store yet: the referral code,
   * licence number / dates / categories and the service types. Off: those
   * inputs are hidden (the licence photos stay, they go with step 3). */
  registrationDetails: boolean;
};

/** Server-pushed events (WebSocket), already reduced to what screens refresh on.
 * `noticeKey`: a translation key the shell shows as a toast (e.g. a trip was cancelled by an operator). */
export type ServerEvent = { type: "feed" | "trips" | "wallet" | "session"; noticeKey?: string };

/**
 * Every screen talks to the app only through this interface.
 * `mockAdapter` implements it against local state; `httpAdapter` talks to
 * the real backend (api/openapi.yml).
 */
export interface ApiAdapter {
  readonly capabilities: ApiCapabilities;
  /** How many digits an SMS code can have when requestOtp doesn't say (the contract allows 4–6). */
  readonly otpLength: { min: number; max: number };
  /** Server events; the sample-data adapter never emits any. */
  subscribe(listener: (event: ServerEvent) => void): () => void;
  /** The session ended outside the app's control (expired / revoked). */
  onSessionEnd(listener: () => void): () => void;

  // Session & registration
  getSession(): Promise<Session>;
  getRegistrationOptions(): Promise<RegistrationOptions>;
  /** `testCode` is set only by the sample-data adapter (the screen autofills it). */
  /** `codeLength`: digits in the code just sent, when the server says (overrides otpLength). */
  requestOtp(phone: string): Promise<{ requestId: string; testCode?: string; resendInSec: number; codeLength?: number }>;
  verifyOtp(requestId: string, code: string): Promise<ReviewRequest>;
  /** Registration step 1 → stage "license". */
  savePersonal(input: PersonalInput): Promise<Session>;
  /** Step 2 → stage "car". */
  saveLicense(input: LicenseInput): Promise<Session>;
  /** Step 3 → stage "selfie". */
  saveCar(input: CarInput): Promise<Session>;
  /** Uploads one document photo; `file` is null for the sample-data adapter's simulated picker.
   * Returns the reference to pass to the step and a name to show. */
  uploadDocument(slot: DocSlot, file: File | null): Promise<{ ref: string; name: string }>;
  /** Step 4: selfie + terms → automatic check (stage "review"). */
  submitRegistration(input: SelfieInput): Promise<ReviewRequest>;
  /** Per-section progress while under review; null when the server doesn't report it. */
  getRegistrationReview(): Promise<RegistrationReview | null>;
  logout(): Promise<Session>;
  /** Deletes the driver's account (irreversible); ends the session. */
  deleteAccount(): Promise<Session>;
  /** GPS fix while the feed is open or a trip is active (the caller throttles to ≥10 s). */
  reportLocation(lat: number, lng: number): Promise<void>;
  /** The driver's position when the adapter has one without GPS (sample data: mock coordinates
   * that follow the active trip's stage). null: the map reads the device's GPS. */
  simulatedPosition(): { lat: number; lng: number } | null;

  // Yo'nalishlarim (city pairs the driver serves; at least one)
  getRoutes(): Promise<RoutesPage>;
  addRoute(aCityId: string, bCityId: string): Promise<RoutesPage>;
  setRouteBothWays(routeId: string, bothWays: boolean): Promise<RoutesPage>;
  removeRoute(routeId: string): Promise<RoutesPage>;
  /** Finishes the first-run routes step (stage "routes" → "active"). */
  completeRoutesSetup(): Promise<Session>;

  // Home: request feed
  getProfile(): Promise<DriverProfile>;
  getHomeSummary(): Promise<HomeSummary>;
  getFeed(query: FeedQuery): Promise<FeedPage>;
  /** The driver has seen the feed: clears the Asosiy badge. */
  markFeedSeen(): Promise<void>;
  getRejectReasons(): Promise<CancelReason[]>;
  /** Hides the request for this driver only. */
  rejectRequest(requestId: string, reasonKey?: string): Promise<void>;
  /** Goes through review; first accept wins (rejected with resultKey when someone else took it). */
  acceptRequest(requestId: string): Promise<ReviewRequest>;
  /** New-request alerts not yet shown (banner / system notification). Empty when muted. */
  takeRequestAlerts(): Promise<RequestAlert[]>;

  // Accepted requests (bookings) and their trip steps
  getAccepted(): Promise<AcceptedPage>;
  /** One request (Request / OrderDetail screens). Rejects with REQUEST_NOT_FOUND when it is gone. */
  getRequest(requestId: string): Promise<RideRequest>;
  /** One accepted booking (trip screens). Rejects with TRIP_NOT_FOUND when it is no longer active. */
  getBooking(bookingId: string): Promise<Booking>;
  /** After the trip: the driver's 1–5 rating of the passenger. */
  ratePassenger(bookingId: string, stars: number): Promise<void>;
  /** SOS from a trip: IZGO operators are alerted. */
  sendSos(bookingId: string): Promise<void>;
  advanceBooking(bookingId: string): Promise<ReviewRequest>;
  getCancelReasons(): Promise<CancelReason[]>;
  cancelBooking(bookingId: string, reasonKey: string): Promise<void>;
  getTripSummary(bookingId: string): Promise<TripSummary>;
  getTripChat(bookingId: string): Promise<TripChat | null>;
  sendTripMessage(bookingId: string, message: ChatSend): Promise<TripChat>;

  // Orders history
  getHistory(filter: HistoryFilter): Promise<HistoryPage>;
  getTripDetail(id: string): Promise<TripDetail>;

  // Wallet
  getWallet(): Promise<WalletSummary>;
  getLedger(query: LedgerQuery): Promise<LedgerPage>;
  getTopupOptions(): Promise<TopupOptions>;
  /** `cardId`: pay with a saved card instead of the provider's page. */
  requestTopup(amount: number, provider: PayProvider, cardId?: string): Promise<ReviewRequest>;
  linkCard(provider: PayProvider): Promise<ReviewRequest>;

  // Profile
  requestProfileChange(field: "name" | "phone" | "car", value: string): Promise<ReviewRequest>;
  getNotifications(): Promise<NotificationItem[]>;
  markAllNotificationsRead(): Promise<void>;
  getNotificationPrefs(): Promise<NotificationPrefs>;
  setNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>;
  getHelpRequests(): Promise<HelpRequest[]>;
  submitHelpRequest(topic: HelpTopic, message?: string): Promise<ReviewRequest>;
  getAppInfo(): Promise<{ version: string; build: string }>;
  /** "Imkoniyatlarim". The adapter normalises the input (age groups ↔ child-seat switch). */
  getCapabilities(): Promise<DriverCapabilities>;
  setCapabilities(input: CapabilitiesInput): Promise<DriverCapabilities>;

  // Shared review mechanism
  getReviewStatus(reviewId: string): Promise<ReviewRequest>;
  // Test-panel controls are not part of this interface: they live in
  // adapters/mock.ts (`testControls`) and exist only in sample-data mode.
}

export type { Car };

export class NotImplementedError extends Error {
  code = "NOT_IMPLEMENTED";
  constructor(method: string) {
    super(`${method}: httpAdapter is not implemented yet.`);
  }
}
