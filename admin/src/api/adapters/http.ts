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
  requestLogin: notImplemented("requestLogin"),
  verifyLoginStep: notImplemented("verifyLoginStep"),
  resendLoginCode: notImplemented("resendLoginCode"),
  getReviewStatus: notImplemented("getReviewStatus"),
  logout: notImplemented("logout"),
  getMe: notImplemented("getMe"),
  isAuthenticated: () => false,
  loginAsRole: notImplemented("loginAsRole"),

  getStats: notImplemented("getStats"),

  getCities: notImplemented("getCities"),
  getSectionBadges: notImplemented("getSectionBadges"),

  getStaff: notImplemented("getStaff"),
  createStaff: notImplemented("createStaff"),
  updateStaff: notImplemented("updateStaff"),
  setStaffStatus: notImplemented("setStaffStatus"),
  archiveStaff: notImplemented("archiveStaff"),
  restoreStaff: notImplemented("restoreStaff"),

  getDrivers: notImplemented("getDrivers"),
  updateDriverProfile: notImplemented("updateDriverProfile"),
  setDriverStatus: notImplemented("setDriverStatus"),
  archiveDriver: notImplemented("archiveDriver"),
  restoreDriver: notImplemented("restoreDriver"),

  getPassengers: notImplemented("getPassengers"),
  createPassenger: notImplemented("createPassenger"),
  updatePassenger: notImplemented("updatePassenger"),
  setPassengerStatus: notImplemented("setPassengerStatus"),
  archivePassenger: notImplemented("archivePassenger"),
  restorePassenger: notImplemented("restorePassenger"),

  getOrders: notImplemented("getOrders"),
  createOrderForPassenger: notImplemented("createOrderForPassenger"),
  updateOrderFields: notImplemented("updateOrderFields"),
  cancelOrder: notImplemented("cancelOrder"),

  getWalletLedger: notImplemented("getWalletLedger"),
  getDriverWalletInfo: notImplemented("getDriverWalletInfo"),
  proposeWalletAdjustment: notImplemented("proposeWalletAdjustment"),
  getAdjustmentProposals: notImplemented("getAdjustmentProposals"),
  approveAdjustment: notImplemented("approveAdjustment"),
  rejectAdjustment: notImplemented("rejectAdjustment"),

  getTariffs: notImplemented("getTariffs"),
  getTariffProposals: notImplemented("getTariffProposals"),
  proposeTariffCreate: notImplemented("proposeTariffCreate"),
  proposeTariffEdit: notImplemented("proposeTariffEdit"),
  proposeTariffArchive: notImplemented("proposeTariffArchive"),
  approveTariffProposal: notImplemented("approveTariffProposal"),
  rejectTariffProposal: notImplemented("rejectTariffProposal"),

  getComplaints: notImplemented("getComplaints"),
  assignComplaint: notImplemented("assignComplaint"),
  setComplaintStatus: notImplemented("setComplaintStatus"),
  addComplaintNote: notImplemented("addComplaintNote"),

  getAuditLog: notImplemented("getAuditLog"),

  revealPhone: notImplemented("revealPhone"),

  getQueue: notImplemented("getQueue"),
  getActiveTask: notImplemented("getActiveTask"),
  startTask: notImplemented("startTask"),
  rejectQueueItem: notImplemented("rejectQueueItem"),
  finishTask: notImplemented("finishTask"),
  getOperatorsInProgress: notImplemented("getOperatorsInProgress"),
  getHistory: notImplemented("getHistory"),
  editHistoryEntry: notImplemented("editHistoryEntry"),
  getOperatorCounts: notImplemented("getOperatorCounts"),
  getOperatorsList: notImplemented("getOperatorsList"),

  recordExport: notImplemented("recordExport"),
};

/** Picked by the `@active-adapter` alias unless VITE_DEMO_MODE=true. */
export const adapter = httpAdapter;
