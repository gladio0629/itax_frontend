import type {
  City,
  CreateOrderInput,
  NotificationItem,
  OrderWithDetails,
  OtpRequestResult,
  Profile,
  Quote,
  QuoteInput,
  ReviewRequest,
  RouteSuggestion,
  SavedCard,
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
  getQuote(input: QuoteInput): Promise<Quote>;

  requestOtp(phone: string): Promise<OtpRequestResult>;
  verifyOtp(requestId: string, code: string): Promise<ReviewRequest>;
  getReviewStatus(reviewId: string): Promise<ReviewRequest>;

  createOrder(input: CreateOrderInput): Promise<OrderWithDetails>;
  getOrder(orderId: string): Promise<OrderWithDetails>;
  cancelOrder(orderId: string, reason: string): Promise<OrderWithDetails>;
  rateOrder(orderId: string, rating: number): Promise<OrderWithDetails>;
  getOrderHistory(): Promise<OrderWithDetails[]>;

  getSavedCards(): Promise<SavedCard[]>;
  linkCard(payload: { label: string; last4: string; brand: SavedCard["brand"] }): Promise<ReviewRequest>;

  getNotifications(): Promise<NotificationItem[]>;
  markNotificationRead(id: string): Promise<void>;

  getProfile(): Promise<Profile>;

  applyPromoCode(code: string): Promise<{ valid: boolean; discountPct: number; message: string }>;
  getReferralCode(): Promise<{ code: string; invitedCount: number; bonusSom: number }>;

  submitSupportTicket(message: string): Promise<ReviewRequest>;
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method}: httpAdapter is not implemented yet. Wire it to the real IZGO backend.`);
  }
}
