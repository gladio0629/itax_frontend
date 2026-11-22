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
  OrderFieldsPatch,
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
  AdapterCapabilities,
  GlobalSearchHit,
} from "./types";

/**
 * Every admin screen talks to the app exclusively through this interface.
 * `mockAdapter` implements it fully against the local mock DB and plays the
 * role of the server: it decides prices, statuses, permissions, search/
 * filter results and statistics. `httpAdapter` talks to the real backend
 * (api/openapi.yml) and rejects with ApiError("NOT_SUPPORTED") where the
 * contract has no endpoint; `capabilities` tells screens what to hide.
 */
export interface ApiAdapter {
  /** What this adapter can do; screens hide whatever is false. */
  readonly capabilities: AdapterCapabilities;
  /** Called when the server ends the session (token expired/rejected) so
   * the app returns to login. Returns an unsubscribe function. */
  onSessionEnd(listener: () => void): () => void;

  // --- auth / session ---
  requestLogin(identifier: string): Promise<LoginStartResult>;
  /** `extra.phone` is sent when the step asked for it (`needsPhone`). */
  verifyLoginStep(requestId: string, code: string, extra?: { phone?: string }): Promise<LoginStepResult>;
  resendLoginCode(requestId: string): Promise<{ testCode?: string; resendSeconds: number; codeLength?: number }>;
  getReviewStatus(reviewId: string): Promise<ReviewRequest>;
  logout(): Promise<void>;
  getMe(): Promise<Me>;
  isAuthenticated(): boolean;
  loginAsRole(role: AdminRole): Promise<void>;

  // --- stats ---
  getStats(period: StatsPeriod): Promise<MarketingStats>;

  getCities(): Promise<City[]>;

  /** Header search ("ID, telefon, ism"); `capabilities.globalSearch`. */
  globalSearch(query: string): Promise<GlobalSearchHit[]>;

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
  /** `reason` is required by the server when blocking. */
  setDriverStatus(id: string, status: "active" | "blocked", reason?: string): Promise<Driver>;
  archiveDriver(id: string): Promise<Driver>;
  restoreDriver(id: string): Promise<Driver>;

  // --- passengers ---
  getPassengers(query: PassengerQuery): Promise<Passenger[]>;
  createPassenger(input: { name: string; phone: string; cityId: string }): Promise<Passenger>;
  updatePassenger(id: string, patch: { name?: string; cityId?: string }): Promise<Passenger>;
  setPassengerStatus(id: string, status: PassengerStatus, reason?: string): Promise<Passenger>;
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
    paymentMethod: Extract<PaymentMethod, "cash" | "card">;
    timeWindow?: { from: string; to: string };
  }): Promise<OrderWithNames>;
  /** Only the fields in `capabilities.orderEditFields` are sent. */
  updateOrderFields(id: string, patch: OrderFieldsPatch): Promise<OrderWithNames>;
  /** `reason`: free text, or an OrderCancelReasonCode when
   * `capabilities.orderCancelReasons` (then `comment` is the free text). */
  cancelOrder(id: string, reason: string, comment?: string): Promise<OrderWithNames>;

  // --- wallet ---
  getWalletLedger(query: WalletQuery): Promise<WalletLedgerRow[]>;
  /** `debtLimit: null` = the backend doesn't report it. */
  getDriverWalletInfo(driverId: string): Promise<{ balance: number; debtLimit: number | null }>;
  proposeWalletAdjustment(driverId: string, amount: number, reason: string): Promise<AdjustmentProposal>;
  getAdjustmentProposals(query: AdjustmentProposalQuery): Promise<AdjustmentProposal[]>;
  approveAdjustment(proposalId: string): Promise<ReviewRequest>;
  rejectAdjustment(proposalId: string, reason?: string): Promise<AdjustmentProposal>;

  // --- tariffs ---
  getTariffs(query: TariffQuery): Promise<Tariff[]>;
  getTariffProposals(query: TariffProposalQuery): Promise<TariffProposal[]>;
  proposeTariffCreate(input: Omit<Tariff, "id" | "archived">): Promise<TariffProposal>;
  proposeTariffEdit(tariffId: string, patch: Partial<Tariff>): Promise<TariffProposal>;
  proposeTariffArchive(tariffId: string): Promise<TariffProposal>;
  approveTariffProposal(proposalId: string): Promise<ReviewRequest>;
  rejectTariffProposal(proposalId: string, reason?: string): Promise<TariffProposal>;

  // --- complaints ("Shikoyatlar") ---
  getComplaints(query: ComplaintQuery): Promise<Complaint[]>;
  /** One complaint with its notes (lists may come without them:
   * `capabilities.complaintNotesInList`). */
  getComplaint(id: string): Promise<Complaint>;
  /** These three return the complaint with its notes. */
  assignComplaint(id: string, toId: string): Promise<Complaint>;
  /** `resolution` is required by the server for resolved/dismissed when
   * `capabilities.complaintResolution`. */
  setComplaintStatus(id: string, status: ComplaintStatus, resolution?: string): Promise<Complaint>;
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
