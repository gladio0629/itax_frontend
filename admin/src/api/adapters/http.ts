import type { ApiAdapter } from "../adapterTypes";
import { NotImplementedError } from "../adapterTypes";

/**
 * Real-backend adapter — intentionally empty. To connect IZGO Admin to a
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
  login: notImplemented("login"),
  requestTwoFactor: notImplemented("requestTwoFactor"),
  verifyTwoFactor: notImplemented("verifyTwoFactor"),
  getReviewStatus: notImplemented("getReviewStatus"),
  logout: notImplemented("logout"),
  getCurrentAdmin: notImplemented("getCurrentAdmin"),
  isAuthenticated: () => false,

  getDashboardStats: notImplemented("getDashboardStats"),

  getCities: notImplemented("getCities"),

  getPendingDrivers: notImplemented("getPendingDrivers"),
  getDrivers: notImplemented("getDrivers"),
  approveDriver: notImplemented("approveDriver"),
  rejectDriver: notImplemented("rejectDriver"),

  getPassengers: notImplemented("getPassengers"),

  getOrders: notImplemented("getOrders"),

  getWalletLedger: notImplemented("getWalletLedger"),

  getTariffs: notImplemented("getTariffs"),
  getTariffProposals: notImplemented("getTariffProposals"),
  proposeTariffChange: notImplemented("proposeTariffChange"),
  approveTariffChange: notImplemented("approveTariffChange"),
  rejectTariffChange: notImplemented("rejectTariffChange"),

  getSupportTickets: notImplemented("getSupportTickets"),
  getRiskItems: notImplemented("getRiskItems"),
  resolveComplaint: notImplemented("resolveComplaint"),

  getAdminUsers: notImplemented("getAdminUsers"),
  updateAdminRole: notImplemented("updateAdminRole"),

  getAuditLog: notImplemented("getAuditLog"),

  revealPhone: notImplemented("revealPhone"),
};
