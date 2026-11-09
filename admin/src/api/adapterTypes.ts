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
  MarketingStats,
  StatsPeriod,
  LoginStartResult,
  LoginStepResult,
  WalletLedgerRow,
  Me,
  QueueListItem,
  ActiveTask,
  HistoryEntry,
  HistoryResult,
  OrderMode,
  PaymentMethod,
  StaffRow,
  StaffQuery,
  DriverQuery,
  PassengerQuery,
  OrderQuery,
  WalletQuery,
  TariffQuery,
  TariffProposalQuery,
  AdjustmentProposalQuery,
  ComplaintQuery,
  AuditQuery,
  OperatorQueueQuery,
  OperatorInProgressQuery,
  OperatorHistoryQuery,
  OperatorApprovedQuery,
  SectionBadges,
  OperatorCounts,
} from "./types";

/**
 * Every admin screen talks to the app exclusively through this interface.
 * `mockAdapter` implements it fully against the local mock DB and plays the
 * role of the server: it decides prices, statuses, permissions, search/
 * filter results and statistics. `httpAdapter` is the integration point for
 * a real backend later — it currently throws NotImplemented for every
 * method.
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
  getStats(period: StatsPeriod): Promise<MarketingStats>;

  getCities(): Promise<City[]>;

  /** Sidebar notification counts, computed entirely server-side. */
  getSectionBadges(): Promise<SectionBadges>;

  // --- staff ("Xodimlar") ---
  getStaff(query: StaffQuery): Promise<StaffRow[]>;
  createStaff(input: { name: string; email: string; phone: string; role: AdminRole }): Promise<AdminUser>;
  updateStaff(id: string, patch: { name?: string; email?: string; phone?: string; role?: AdminRole }): Promise<AdminUser>;
  setStaffStatus(id: string, status: StaffStatus): Promise<AdminUser>;
  archiveStaff(id: string): Promise<AdminUser>;
  restoreStaff(id: string): Promise<AdminUser>;

  // --- drivers ---
  getDrivers(query: DriverQuery): Promise<Driver[]>;
  updateDriverProfile(id: string, patch: { name?: string; carModel?: string; carColor?: string; plate?: string }): Promise<Driver>;
  setDriverStatus(id: string, status: Exclude<DriverStatus, "auto_review">): Promise<Driver>;
  archiveDriver(id: string): Promise<Driver>;
  restoreDriver(id: string): Promise<Driver>;

  // --- passengers ---
  getPassengers(query: PassengerQuery): Promise<Passenger[]>;
  createPassenger(input: { name: string; phone: string; cityId: string }): Promise<Passenger>;
  updatePassenger(id: string, patch: { name?: string; cityId?: string }): Promise<Passenger>;
  setPassengerStatus(id: string, status: PassengerStatus): Promise<Passenger>;
  archivePassenger(id: string): Promise<Passenger>;
  restorePassenger(id: string): Promise<Passenger>;

  // --- orders ---
  getOrders(query: OrderQuery): Promise<OrderWithNames[]>;
  createOrderForPassenger(input: {
    passengerId: string;
    fromCityId: string;
    toCityId: string;
    mode: OrderMode;
    seatIds: string[];
    paymentMethod: PaymentMethod;
    timeWindow?: { from: string; to: string };
  }): Promise<OrderWithNames>;
  updateOrderFields(id: string, patch: { seatIds?: string[]; note?: string; timeWindow?: { from: string; to: string } | null }): Promise<OrderWithNames>;
  cancelOrder(id: string, reason: string): Promise<OrderWithNames>;

  // --- wallet ---
  getWalletLedger(query: WalletQuery): Promise<WalletLedgerRow[]>;
  getDriverWalletInfo(driverId: string): Promise<{ balance: number; debtLimit: number }>;
  proposeWalletAdjustment(driverId: string, amount: number, reason: string): Promise<AdjustmentProposal>;
  getAdjustmentProposals(query: AdjustmentProposalQuery): Promise<AdjustmentProposal[]>;
  approveAdjustment(proposalId: string): Promise<ReviewRequest>;
  rejectAdjustment(proposalId: string): Promise<AdjustmentProposal>;

  // --- tariffs ---
  getTariffs(query: TariffQuery): Promise<Tariff[]>;
  getTariffProposals(query: TariffProposalQuery): Promise<TariffProposal[]>;
  proposeTariffCreate(input: Omit<Tariff, "id" | "archived">): Promise<TariffProposal>;
  proposeTariffEdit(tariffId: string, patch: Partial<Tariff>): Promise<TariffProposal>;
  proposeTariffArchive(tariffId: string): Promise<TariffProposal>;
  approveTariffProposal(proposalId: string): Promise<ReviewRequest>;
  rejectTariffProposal(proposalId: string): Promise<TariffProposal>;

  // --- complaints ("Shikoyatlar") ---
  getComplaints(query: ComplaintQuery): Promise<Complaint[]>;
  assignComplaint(id: string, toId: string): Promise<Complaint>;
  setComplaintStatus(id: string, status: ComplaintStatus): Promise<Complaint>;
  addComplaintNote(id: string, text: string): Promise<Complaint>;

  // --- audit ---
  getAuditLog(query: AuditQuery): Promise<AuditEntry[]>;

  revealPhone(entityType: "driver" | "passenger", entityId: string): Promise<{ phone: string }>;

  // --- operator windows: one "operators" section, two capabilities ---
  // Navbat (all waiting tasks) is the same data for the operator working it
  // and for a supervisor only watching it; the mutations below check the
  // "operatorWork" action themselves, not just the role.
  getQueue(query: OperatorQueueQuery): Promise<QueueListItem[]>;
  getActiveTask(): Promise<ActiveTask | null>;
  startTask(queueId: string): Promise<ActiveTask>;
  rejectQueueItem(queueId: string, reason: string): Promise<QueueListItem>;
  finishTask(queueId: string, result: HistoryResult, note: string, rejectReason?: string): Promise<HistoryEntry>;
  // Jarayonda — supervisor-only ("operatorSupervise"); includes startedAt
  // and the operator's name for every task currently being worked.
  getOperatorsInProgress(query: OperatorInProgressQuery): Promise<QueueListItem[]>;
  // Tarix / Bugungi tasdiqlanganlar — an operator gets only their own
  // entries (the adapter forces this regardless of what's asked); a
  // supervisor gets everyone's, filterable by operatorId.
  getHistory(query: OperatorApprovedQuery): Promise<HistoryEntry[]>;
  editHistoryEntry(id: string, patch: { result?: HistoryResult; note?: string }): Promise<HistoryEntry>;
  getOperatorCounts(): Promise<OperatorCounts>;
  getOperatorsList(): Promise<{ id: string; name: string }[]>;

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
