import type {
  City,
  DriverProfile,
  EarningsStats,
  NotificationItem,
  OrderWithDetails,
  OtpRequestResult,
  RegistrationInput,
  ReviewRequest,
  WalletSummary,
} from "./types";

/**
 * Every screen talks to the app exclusively through this interface.
 * `mockAdapter` implements it fully against the local mock DB.
 * `httpAdapter` is the integration point for a real backend later —
 * it currently throws NotImplemented for every method.
 */
export interface ApiAdapter {
  getProfile(): Promise<DriverProfile>;
  setOnline(online: boolean): Promise<DriverProfile>;

  getOffers(): Promise<OrderWithDetails[]>;
  acceptOffer(orderId: string): Promise<OrderWithDetails>;
  declineOffer(orderId: string): Promise<void>;

  getActiveTrip(): Promise<OrderWithDetails | null>;
  startTrip(orderId: string): Promise<OrderWithDetails>;
  completeTrip(orderId: string): Promise<OrderWithDetails>;
  cancelTrip(orderId: string, reason: string): Promise<OrderWithDetails>;

  getOrderHistory(): Promise<OrderWithDetails[]>;

  getWallet(): Promise<WalletSummary>;
  requestWalletTopup(amount: number): Promise<ReviewRequest>;
  getReviewStatus(reviewId: string): Promise<ReviewRequest>;

  getEarningsStats(range: "week" | "month"): Promise<EarningsStats>;

  getNotifications(): Promise<NotificationItem[]>;
  markNotificationRead(id: string): Promise<void>;

  getCities(): Promise<City[]>;

  getRegistrationStatus(): Promise<{ documentsStatus: DriverProfile["documentsStatus"] }>;
  requestOtp(phone: string): Promise<OtpRequestResult>;
  verifyOtp(requestId: string, code: string): Promise<ReviewRequest>;
  submitRegistration(input: RegistrationInput): Promise<ReviewRequest>;
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method}: httpAdapter is not implemented yet. Wire it to the real IZGO backend.`);
  }
}
