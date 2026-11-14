import type {
  ActiveTrip, BonusInfo, CancelReason, DemoOrderVariant, DemoPreset, DriverProfile, HelpRequest, HelpTopic, HistoryFilter,
  HistoryPage, HomeSummary, LedgerPage, LedgerQuery, NotificationItem, NotificationPrefs, Offer, PayProvider,
  RegistrationOptions, ReviewRequest, Session, ChatSend, TripChat, CapabilitiesInput, DriverCapabilities, TopupOptions, TripDetail, TripStage, TripSummary, WalletSummary,
  Car,
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
  requestOtp(phone: string): Promise<{ requestId: string; demoCode: string; resendInSec: number }>;
  verifyOtp(requestId: string, code: string): Promise<ReviewRequest>;
  savePersonal(input: { name: string; cityId: string }): Promise<Session>;
  saveCar(input: { model: string; colorKey: string; plate: string; year: number }): Promise<Session>;
  submitDocuments(input: { licenseFile: string; registrationFile: string }): Promise<ReviewRequest>;
  logout(): Promise<Session>;

  // Home cockpit
  getProfile(): Promise<DriverProfile>;
  getHomeSummary(): Promise<HomeSummary>;
  setOnline(online: boolean): Promise<HomeSummary>;
  getCurrentOffer(): Promise<Offer | null>;
  acceptOffer(offerId: string): Promise<ActiveTrip>;
  declineOffer(offerId: string): Promise<void>;

  // Active trip
  getActiveTrip(): Promise<ActiveTrip | null>;
  advanceTrip(tripId: string): Promise<ReviewRequest>;
  getCancelReasons(): Promise<CancelReason[]>;
  cancelTrip(tripId: string, reasonKey: string): Promise<void>;
  getTripSummary(tripId: string): Promise<TripSummary>;
  /** Chat with the passenger of the active trip (null when there is none). */
  getTripChat(): Promise<TripChat | null>;
  sendTripMessage(tripId: string, message: ChatSend): Promise<TripChat>;

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

  // Demo controls (mock only — the http adapter rejects them)
  demoApplyPreset(preset: DemoPreset): Promise<void>;
  demoTriggerOffer(variant?: DemoOrderVariant): Promise<void>;
  demoTripAtStage(stage: Exclude<TripStage, "completed">, variant?: DemoOrderVariant): Promise<void>;
}

export type { Car };

export class NotImplementedError extends Error {
  code = "NOT_IMPLEMENTED";
  constructor(method: string) {
    super(`${method}: httpAdapter is not implemented yet.`);
  }
}
