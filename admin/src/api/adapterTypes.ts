import type {
  City,
  Driver,
  Passenger,
  Complaint,
  Tariff,
  AdminUser,
  AdminRole,
  AuditEntry,
  TariffProposal,
  ReviewRequest,
  OrderWithNames,
  DashboardStats,
  OtpRequestResult,
  WalletLedgerRow,
} from "./types";

/**
 * Every admin screen talks to the app exclusively through this interface.
 * `mockAdapter` implements it fully against the local mock DB.
 * `httpAdapter` is the integration point for a real backend later —
 * it currently throws NotImplemented for every method.
 */
export interface ApiAdapter {
  login(email: string, password: string): Promise<void>;
  requestTwoFactor(): Promise<OtpRequestResult>;
  verifyTwoFactor(requestId: string, code: string): Promise<ReviewRequest>;
  getReviewStatus(reviewId: string): Promise<ReviewRequest>;
  logout(): Promise<void>;
  getCurrentAdmin(): Promise<AdminUser>;
  isAuthenticated(): boolean;

  getDashboardStats(): Promise<DashboardStats>;

  getCities(): Promise<City[]>;

  getPendingDrivers(): Promise<Driver[]>;
  getDrivers(): Promise<Driver[]>;
  approveDriver(driverId: string): Promise<Driver>;
  rejectDriver(driverId: string, reason: string): Promise<Driver>;

  getPassengers(): Promise<Passenger[]>;

  getOrders(): Promise<OrderWithNames[]>;

  getWalletLedger(): Promise<WalletLedgerRow[]>;

  getTariffs(): Promise<Tariff[]>;
  getTariffProposals(): Promise<TariffProposal[]>;
  proposeTariffChange(patch: Partial<Tariff>): Promise<TariffProposal>;
  approveTariffChange(proposalId: string): Promise<ReviewRequest>;
  rejectTariffChange(proposalId: string): Promise<TariffProposal>;

  getSupportTickets(): Promise<Complaint[]>;
  getRiskItems(): Promise<Complaint[]>;
  resolveComplaint(id: string, status: "resolved" | "dismissed"): Promise<Complaint>;

  getAdminUsers(): Promise<AdminUser[]>;
  updateAdminRole(id: string, role: AdminRole): Promise<AdminUser>;

  getAuditLog(): Promise<AuditEntry[]>;

  revealPhone(entityType: "driver" | "passenger", entityId: string): Promise<{ phone: string }>;
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method}: httpAdapter is not implemented yet. Wire it to the real IZGO backend.`);
  }
}
