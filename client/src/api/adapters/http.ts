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
  getSavedAddresses: notImplemented("getSavedAddresses"),
  reverseGeocode: notImplemented("reverseGeocode"),
  getPickupEta: notImplemented("getPickupEta"),
  getSeatMap: notImplemented("getSeatMap"),
  getQuote: notImplemented("getQuote"),
  getDeliveryVehicles: notImplemented("getDeliveryVehicles"),
  requestOtp: notImplemented("requestOtp"),
  verifyOtp: notImplemented("verifyOtp"),
  getReviewStatus: notImplemented("getReviewStatus"),
  createOrder: notImplemented("createOrder"),
  getOrder: notImplemented("getOrder"),
  updateOrder: notImplemented("updateOrder"),
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
  getBonusSummary: notImplemented("getBonusSummary"),
  getBonusSources: notImplemented("getBonusSources"),
  getBonusHistory: notImplemented("getBonusHistory"),
  requestBonusWithdraw: notImplemented("requestBonusWithdraw"),
  getNotificationPrefs: notImplemented("getNotificationPrefs"),
  setNotificationPrefs: notImplemented("setNotificationPrefs"),
  getAccounts: notImplemented("getAccounts"),
  switchAccount: notImplemented("switchAccount"),
  addAccount: notImplemented("addAccount"),
  deleteAccount: notImplemented("deleteAccount"),
  requestAccountDeletion: notImplemented("requestAccountDeletion"),
  requestPhoneChange: notImplemented("requestPhoneChange"),
  confirmPhoneChange: notImplemented("confirmPhoneChange"),
  updateProfileName: notImplemented("updateProfileName"),
  submitHelpRequest: notImplemented("submitHelpRequest"),
  getHelpRequests: notImplemented("getHelpRequests"),
  submitSupportTicket: notImplemented("submitSupportTicket"),
};
