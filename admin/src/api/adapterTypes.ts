import type {
  City,
  Driver,
  DriverStatus,
  Passenger,
  PassengerStatus,
  Complaint,
  ComplaintStatus,
  Tariff,
  AdminUser,
  AdminRole,
  StaffStatus,
  AuditEntry,
  TariffProposal,
  AdjustmentProposal,
  ReviewRequest,
  OrderWithNames,
  DashboardStats,
  MarketingStats,
  StatsPeriod,
  LoginStartResult,
  LoginStepResult,
  WalletLedgerRow,
  Me,
  QueueListItem,
  ActiveTask,
  HistoryEntry,
  QueueReason,
  HistoryResult,
  OrderMode,
  PaymentMethod,
} from "./types";

/**
 * Every admin screen talks to the app exclusively through this interface.
 * `mockAdapter` implements it fully against the local mock DB and plays the
 * role of the server: it decides prices, statuses, permissions and
 * statistics. `httpAdapter` is the integration point for a real backend
 * later — it currently throws NotImplemented for every method.
 */
export interface ApiAdapter {
  // --- auth / session ---
  requestLogin(identifier: string): Promise<LoginStartResult>;
  verifyLoginStep(requestId: string, code: string): Promise<LoginStepResult>;
  resendLoginCode(requestId: string): Promise<{ demoCode: string; resendSeconds: number }>;
  getReviewStatus(reviewId: string): Promise<ReviewRequest>;
  logout(): Promise<void>;
  getMe(): Promise<Me>;
  isAuthenticated(): boolean;
  loginAsRole(role: AdminRole): Promise<void>;

  // --- stats ---
  getDashboardStats(): Promise<DashboardStats>;
  getMarketingStats(period: StatsPeriod): Promise<MarketingStats>;

  getCities(): Promise<City[]>;

  // --- staff ("Xodimlar") ---
  getStaff(): Promise<AdminUser[]>;
  createStaff(input: { name: string; email: string; phone: string; role: AdminRole }): Promise<AdminUser>;
  updateStaff(id: string, patch: { name?: string; email?: string; phone?: string; role?: AdminRole }): Promise<AdminUser>;
  setStaffStatus(id: string, status: StaffStatus): Promise<AdminUser>;
  archiveStaff(id: string): Promise<AdminUser>;
  restoreStaff(id: string): Promise<AdminUser>;

  // --- drivers ---
  getDrivers(): Promise<Driver[]>;
  updateDriverProfile(id: string, patch: { name?: string; carModel?: string; carColor?: string; plate?: string }): Promise<Driver>;
  setDriverStatus(id: string, status: Exclude<DriverStatus, "auto_review">): Promise<Driver>;
  archiveDriver(id: string): Promise<Driver>;
  restoreDriver(id: string): Promise<Driver>;

  // --- passengers ---
  getPassengers(): Promise<Passenger[]>;
  createPassenger(input: { name: string; phone: string; cityId: string }): Promise<Passenger>;
  updatePassenger(id: string, patch: { name?: string; cityId?: string }): Promise<Passenger>;
  setPassengerStatus(id: string, status: PassengerStatus): Promise<Passenger>;
  archivePassenger(id: string): Promise<Passenger>;
  restorePassenger(id: string): Promise<Passenger>;

  // --- orders ---
  getOrders(): Promise<OrderWithNames[]>;
  createOrderForPassenger(input: {
    passengerId: string;
    fromCityId: string;
    toCityId: string;
    mode: OrderMode;
    seatIds: string[];
    paymentMethod: PaymentMethod;
  }): Promise<OrderWithNames>;
  updateOrderFields(id: string, patch: { seatIds?: string[]; note?: string }): Promise<OrderWithNames>;
  cancelOrder(id: string, reason: string): Promise<OrderWithNames>;

  // --- wallet ---
  getWalletLedger(): Promise<WalletLedgerRow[]>;
  proposeWalletAdjustment(driverId: string, amount: number, reason: string): Promise<AdjustmentProposal>;
  getAdjustmentProposals(): Promise<AdjustmentProposal[]>;
  approveAdjustment(proposalId: string): Promise<ReviewRequest>;
  rejectAdjustment(proposalId: string): Promise<AdjustmentProposal>;

  // --- tariffs ---
  getTariffs(): Promise<Tariff[]>;
  getTariffProposals(): Promise<TariffProposal[]>;
  proposeTariffCreate(input: Omit<Tariff, "id" | "archived">): Promise<TariffProposal>;
  proposeTariffEdit(tariffId: string, patch: Partial<Tariff>): Promise<TariffProposal>;
  proposeTariffArchive(tariffId: string): Promise<TariffProposal>;
  approveTariffProposal(proposalId: string): Promise<ReviewRequest>;
  rejectTariffProposal(proposalId: string): Promise<TariffProposal>;

  // --- complaints ("Shikoyatlar") ---
  getComplaints(): Promise<Complaint[]>;
  assignComplaint(id: string, toId: string): Promise<Complaint>;
  setComplaintStatus(id: string, status: ComplaintStatus): Promise<Complaint>;
  addComplaintNote(id: string, text: string): Promise<Complaint>;

  // --- audit ---
  getAuditLog(): Promise<AuditEntry[]>;

  revealPhone(entityType: "driver" | "passenger", entityId: string): Promise<{ phone: string }>;

  // --- operator windows ---
  getQueue(): Promise<QueueListItem[]>;
  getActiveTask(): Promise<ActiveTask | null>;
  startTask(queueId: string): Promise<ActiveTask>;
  rejectQueueItem(queueId: string, reason: string): Promise<QueueListItem>;
  finishTask(queueId: string, result: HistoryResult, note: string, rejectReason?: string): Promise<HistoryEntry>;
  getHistory(): Promise<HistoryEntry[]>;
  editHistoryEntry(id: string, patch: { result?: HistoryResult; note?: string }): Promise<HistoryEntry>;

  /** Permission check + audit entry for a CSV export. The CSV itself is
   * built client-side from rows the admin already fetched and is allowed to
   * see — this just gates the "export" action and records who did it. */
  recordExport(section: string): Promise<void>;
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method}: httpAdapter is not implemented yet. Wire it to the real IZGO backend.`);
  }
}

export type { QueueReason };
