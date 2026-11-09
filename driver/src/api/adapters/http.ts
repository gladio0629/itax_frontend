import type { ApiAdapter } from "../adapterTypes";
import { NotImplementedError } from "../adapterTypes";

/**
 * Real-backend adapter — intentionally empty. To connect IZGO Driver to a
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
  getProfile: notImplemented("getProfile"),
  setOnline: notImplemented("setOnline"),
  getOffers: notImplemented("getOffers"),
  acceptOffer: notImplemented("acceptOffer"),
  declineOffer: notImplemented("declineOffer"),
  getActiveTrip: notImplemented("getActiveTrip"),
  startTrip: notImplemented("startTrip"),
  completeTrip: notImplemented("completeTrip"),
  cancelTrip: notImplemented("cancelTrip"),
  getOrderHistory: notImplemented("getOrderHistory"),
  getWallet: notImplemented("getWallet"),
  requestWalletTopup: notImplemented("requestWalletTopup"),
  getReviewStatus: notImplemented("getReviewStatus"),
  getEarningsStats: notImplemented("getEarningsStats"),
  getNotifications: notImplemented("getNotifications"),
  markNotificationRead: notImplemented("markNotificationRead"),
  getCities: notImplemented("getCities"),
  getRegistrationStatus: notImplemented("getRegistrationStatus"),
  requestOtp: notImplemented("requestOtp"),
  verifyOtp: notImplemented("verifyOtp"),
  submitRegistration: notImplemented("submitRegistration"),
};
