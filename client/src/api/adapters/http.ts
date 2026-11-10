import type { ApiAdapter } from "../adapterTypes";
import { NotImplementedError } from "../adapterTypes";

/**
 * Real-backend adapter — intentionally empty. To connect IZGO Client to a
 * real API: implement each method with calls to your backend HTTP client
 * of choice (this file never ships in demo mode), then flip
 * VITE_DEMO_MODE=false. No component or screen needs to change.
 */
function notImplemented<T extends keyof ApiAdapter>(name: T): ApiAdapter[T] {
  return (() => {
    throw new NotImplementedError(name);
  }) as ApiAdapter[T];
}

export const httpAdapter: ApiAdapter = {
  getCities: notImplemented("getCities"),
  getPopularRoutes: notImplemented("getPopularRoutes"),
  getRecentRoutes: notImplemented("getRecentRoutes"),
  getAddressSuggestions: notImplemented("getAddressSuggestions"),
  getRecentAddresses: notImplemented("getRecentAddresses"),
  reverseGeocode: notImplemented("reverseGeocode"),
  getPickupEta: notImplemented("getPickupEta"),
  getSeatMap: notImplemented("getSeatMap"),
  getQuote: notImplemented("getQuote"),
  requestOtp: notImplemented("requestOtp"),
  verifyOtp: notImplemented("verifyOtp"),
  getReviewStatus: notImplemented("getReviewStatus"),
  createOrder: notImplemented("createOrder"),
  getOrder: notImplemented("getOrder"),
  cancelOrder: notImplemented("cancelOrder"),
  rateOrder: notImplemented("rateOrder"),
  getOrderHistory: notImplemented("getOrderHistory"),
  getSavedCards: notImplemented("getSavedCards"),
  linkCard: notImplemented("linkCard"),
  getNotifications: notImplemented("getNotifications"),
  markNotificationRead: notImplemented("markNotificationRead"),
  getProfile: notImplemented("getProfile"),
  getWallet: notImplemented("getWallet"),
  applyPromoCode: notImplemented("applyPromoCode"),
  getReferralCode: notImplemented("getReferralCode"),
  submitSupportTicket: notImplemented("submitSupportTicket"),
};
