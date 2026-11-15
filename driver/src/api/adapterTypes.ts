import type {
  AcceptedPage, BonusInfo, CancelReason, CapabilitiesInput, ChatSend, DriverCapabilities,
  DriverProfile, FeedPage, FeedQuery, HelpRequest, HelpTopic, HistoryFilter, HistoryPage, HomeSummary, LedgerPage, LedgerQuery,
  NotificationItem, NotificationPrefs, PayProvider, RegistrationOptions, RequestAlert, ReviewRequest, RoutesPage, Session,
  TopupOptions, TripChat, TripDetail, TripSummary, WalletSummary, Car,
} from "./types";

/**
 * Every screen talks to the app only through this interface.
 * `mockAdapter` implements it against local state; `httpAdapter` is the
 * integration point for the real backend.
 */
export interface ApiAdapter {
  // Session & registration
  getSession(): Promise<Session>;
  getRegistrationOptions(): Promise<RegistrationOptions>;
  /** `testCode` is set only by the sample-data adapter (the screen autofills it). */
  requestOtp(phone: string): Promise<{ requestId: string; testCode?: string; resendInSec: number }>;
  verifyOtp(requestId: string, code: string): Promise<ReviewRequest>;
  savePersonal(input: { name: string; cityId: string }): Promise<Session>;
  saveCar(input: { model: string; colorKey: string; plate: string; year: number }): Promise<Session>;
  submitDocuments(input: { licenseFile: string; registrationFile: string }): Promise<ReviewRequest>;
  logout(): Promise<Session>;

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
