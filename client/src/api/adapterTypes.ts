import type { DeliveryVehicleSpec,
  SchedulingRules,
  AccountSummary,
  Address,
  BonusHistoryPage,
  BonusSource,
  BonusSummary,
  City,
  CreateOrderInput,
  HelpRequest,
  HelpTopic,
  NotificationItem,
  NotificationPrefs,
  OrderHistoryPage,
  OrderStatus,
  OrderWithDetails,
  OtpRequestResult,
  Profile,
  Quote,
  QuoteInput,
  ReviewRequest,
  RouteSuggestion,
  SavedAddressInfo,
  SavedCard,
  Seat,
  UpdateOrderInput,
  WalletSummary,
} from "./types";

/**
 * Every screen talks to the app exclusively through this interface.
 * `mockAdapter` implements it fully against the local mock DB.
 * `httpAdapter` is the integration point for a real backend later —
 * it currently throws NotImplemented for every method.
 */
export interface ApiAdapter {
  getCities(): Promise<City[]>;
  getPopularRoutes(): Promise<RouteSuggestion[]>;
  getRecentRoutes(): Promise<RouteSuggestion[]>;
  getAddressSuggestions(query: string, excludeCityId?: string): Promise<Address[]>;
  getRecentAddresses(): Promise<Address[]>;
  getSavedAddresses(fromAddressId: string): Promise<SavedAddressInfo[]>;
  reverseGeocode(x: number, y: number, excludeCityId?: string): Promise<Address>;
  getPickupEta(): Promise<{ minutes: number }>;
  getSeatMap(input: { fromAddressId: string; toAddressId: string }): Promise<Seat[]>;
  getQuote(input: QuoteInput): Promise<Quote>;
  getDeliveryVehicles(): Promise<DeliveryVehicleSpec[]>;
  getSchedulingRules(): Promise<SchedulingRules>;

  requestOtp(phone: string): Promise<OtpRequestResult>;
  verifyOtp(requestId: string, code: string): Promise<ReviewRequest>;
  getReviewStatus(reviewId: string): Promise<ReviewRequest>;

  createOrder(input: CreateOrderInput): Promise<OrderWithDetails>;
  getOrder(orderId: string): Promise<OrderWithDetails>;
  updateOrder(orderId: string, patch: UpdateOrderInput): Promise<OrderWithDetails>;
  cancelOrder(orderId: string, reason: string): Promise<OrderWithDetails>;
  rateOrder(orderId: string, rating: number, reasons?: string[], note?: string): Promise<OrderWithDetails>;
  getOrderHistory(params?: { status?: OrderStatus; cursor?: number }): Promise<OrderHistoryPage>;

  getSavedCards(): Promise<SavedCard[]>;
  linkCard(payload: { label: string }): Promise<ReviewRequest>;

  getNotifications(): Promise<NotificationItem[]>;
  markNotificationRead(id: string): Promise<void>;

  getProfile(): Promise<Profile>;

  getWallet(): Promise<WalletSummary>;

  applyPromoCode(code: string): Promise<{ valid: boolean; discountPct: number; message: string }>;

  getBonusSummary(): Promise<BonusSummary>;
  getBonusSources(): Promise<BonusSource[]>;
  getBonusHistory(params?: { type?: "earn" | "withdraw"; cursor?: number }): Promise<BonusHistoryPage>;
  requestBonusWithdraw(amount: number): Promise<ReviewRequest>;

  getNotificationPrefs(): Promise<NotificationPrefs>;
  setNotificationPrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs>;

  getAccounts(): Promise<AccountSummary[]>;
  switchAccount(id: string): Promise<AccountSummary[]>;
  addAccount(payload: { name: string; phone: string }): Promise<ReviewRequest>;
  deleteAccount(id: string): Promise<ReviewRequest>;
  requestAccountDeletion(): Promise<ReviewRequest>;

  requestPhoneChange(newPhone: string): Promise<OtpRequestResult>;
  confirmPhoneChange(requestId: string, code: string, newPhone: string): Promise<ReviewRequest>;
  updateProfileName(firstName: string, lastName: string): Promise<Profile>;

  submitHelpRequest(topic: HelpTopic, message?: string): Promise<ReviewRequest>;
  getHelpRequests(): Promise<HelpRequest[]>;

  submitSupportTicket(message: string): Promise<ReviewRequest>;
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method}: httpAdapter is not implemented yet. Wire it to the real IZGO backend.`);
  }
}
