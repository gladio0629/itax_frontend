import type {
  ManagerRequest,
  ManagerRequestCounts,
  ManagerRequestInput,
  ManagerRequestPreview,
  ManagerRequestQuery,
  OpCancelReason,
  OpOrderDetail,
  OpTasksSummary,
  RequestForm,
  RequestSubjectKind,
} from "./types";

/**
 * Operator order page, "Menejerga so'rov" and the manager's "So'rovlar"
 * (2026-11-24). Part of ApiAdapter; kept in its own file so other terminals'
 * adapter changes don't collide. Expected endpoints: docs/backend-gaps.md,
 * "## admin (operator, 2026-11-24)".
 */
export interface OpsAdapter {
  // --- operator order page (sections orders_view or orders) ---
  getOpOrder(id: string): Promise<OpOrderDetail>;
  /** "Qidiruvni qayta boshlash"; only when allowedActions has restart_search. */
  restartOrderSearch(id: string): Promise<OpOrderDetail>;
  /** Operator cancel; the reason is required. */
  opCancelOrder(id: string, reason: OpCancelReason, comment?: string): Promise<OpOrderDetail>;

  // --- operator: requests to a manager (action operatorWork) ---
  getRequestForm(kind: RequestSubjectKind, id: string): Promise<RequestForm>;
  createManagerRequest(input: ManagerRequestInput): Promise<ManagerRequest>;
  /** The signed-in operator's own requests. */
  getMyRequests(query: ManagerRequestQuery): Promise<ManagerRequest[]>;
  getMyTasksSummary(): Promise<OpTasksSummary>;

  // --- manager "So'rovlar" (section requests) ---
  getManagerRequests(query: ManagerRequestQuery): Promise<ManagerRequest[]>;
  /** Chip counts for the same filters minus status. */
  getManagerRequestCounts(query: Omit<ManagerRequestQuery, "status">): Promise<ManagerRequestCounts>;
  getManagerRequestPreview(id: string): Promise<ManagerRequestPreview>;
  /** The server applies the change and writes the audit entry. */
  approveManagerRequest(id: string): Promise<ManagerRequest>;
  rejectManagerRequest(id: string, reason: string): Promise<ManagerRequest>;
}
