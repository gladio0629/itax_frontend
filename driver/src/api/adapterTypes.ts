import type {
  AcceptedPage, BonusInfo, CancelReason, CapabilitiesInput, ChatSend, DriverCapabilities,
  DriverProfile, FeedPage, FeedQuery, HelpRequest, HelpTopic, HistoryFilter, HistoryPage, HomeSummary, LedgerPage, LedgerQuery,
  NotificationItem, NotificationPrefs, PayProvider, RegistrationOptions, RequestAlert, ReviewRequest, RoutesPage, Session,
  TopupOptions, TripChat, TripDetail, TripSummary, WalletSummary, Car, CarClass, DocSlot,
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
  bonus: boolean;
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
  savePersonal(input: { name: string; cityId: string; birthDate?: string }): Promise<Session>;
  saveCar(input: { model: string; colorKey: string; plate: string; year: number; carClass?: CarClass; seats?: number }): Promise<Session>;
  /** Uploads one document photo; `file` is null for the sample-data adapter's simulated picker.
   * Returns the reference to pass to submitDocuments and a name to show. */
  uploadDocument(slot: DocSlot, file: File | null): Promise<{ ref: string; name: string }>;
  submitDocuments(input: { licenseFile: string; registrationFile: string; selfieFile?: string; acceptTerms?: boolean }): Promise<ReviewRequest>;
  logout(): Promise<Session>;
  /** GPS fix while the feed is open or a trip is active (the caller throttles to ≥10 s). */
  reportLocation(lat: number, lng: number): Promise<void>;

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
  requestTopup(amount: number, provider: PayProvider): Promise<ReviewRequest>;
  linkCard(provider: PayProvider): Promise<ReviewRequest>;

  // Profile
  getBonus(): Promise<BonusInfo>;
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
