// Real-backend adapter for IZGO Admin (api/openapi.yml). Same interface as
// the mock; field conversion lives in ../httpMapper.ts. Methods the contract
// has no endpoint for reject with ApiError("NOT_SUPPORTED") and
// `capabilities` tells the screens to hide them (docs/backend-gaps/admin.md).
// Nothing here logs: no tokens, phones, emails or codes reach the console.
import { API_PATHS } from "@shared/api/openapi";
import type * as Api from "@shared/api/openapi";
import { ApiError, type ErrorParams } from "@shared/http/errors";
import { uuidV4 } from "@shared/http/uuid";
import type { QueryValue } from "@shared/http/client";
import type { ApiAdapter } from "../adapterTypes";
import { adminErrorMessage } from "../httpErrors";
import { session } from "../httpSession";
import * as map from "../httpMapper";
import type {
  AdapterCapabilities,
  Complaint,
  GlobalSearchHit,
  OrderWithNames,
  LoginStartResult,
  LoginStepResult,
  Me,
  OrderCancelReasonCode,
  ReviewKind,
  ReviewRequest,
  StaffRow,
  Tariff,
} from "../types";

const http = session.http;

const CAPABILITIES: AdapterCapabilities = {
  staffSearch: false,
  staffStatusFilter: false,
  staffEmailEdit: false,
  staffLastLogin: false,
  restoreStaff: false,
  driverReviewFilter: false,
  driverOnline: false,
  driverDebtLimit: false,
  driverCarEdit: false,
  passengerCity: false,
  orderSearch: false,
  orderCreate: false,
  orderEdit: true,
  orderPassenger: false,
  walletLedgerFilters: false,
  walletDriverName: false,
  adjustmentProposalsList: true,
  tariffSearch: false,
  tariffProposalValues: false,
  queueFilters: false,
  historyFilters: false,
  historyEdit: false,
  operatorCounts: false,
  sectionBadges: false,
  tariffFields: ["baseFare", "perKmCar", "perMin", "minFare", "commissionPct"],
  tariffCarClass: true,
  orderStatuses: ["searching", "accepted", "arrived", "in_progress", "completed", "cancelled", "expired"],
  orderEditFields: ["note", "paymentMethod", "schedule"],
  orderNoteMaxLength: 200,
  orderCancelReasons: true,
  adjustmentReasonMinLength: 5,
  complaintSearch: false,
  complaintCategoryFilter: false,
  complaintSubjectFilter: true,
  complaintAssigneeFilter: true,
  complaintNotesInList: false,
  complaintResolution: true,
  auditSearch: false,
  auditApiFilters: true,
  // GET /admin/v1/search is not in the contract yet (docs/backend-gaps/admin.md).
  globalSearch: false,
  // v2 group 3. Expected endpoints are in docs/backend-gaps/admin.md.
  orderCounts: false,
  orderKindFilter: false,
  orderDateFilter: true, // from_date / to_date on the orders list
  orderToOperator: false,
  driverCounts: false,
  driverRouteFilter: false,
  driverLevelFilter: false,
  driverTrips: false,
  passengerCounts: false,
  passengerJoinedFilter: false,
};

const CANCEL_REASONS: readonly OrderCancelReasonCode[] = ["admin_decision", "passenger_request", "driver_request", "duplicate", "fraud", "other"];
const LOGOUT_TIMEOUT_MS = 5_000;
const ADMIN_SEARCH_PATH = "/admin/v1/search";
// Expected (not in openapi.yml yet), see docs/backend-gaps/admin.md:
const orderOperatorTaskPath = (id: string) => `${API_PATHS.adminOrder(id)}/operator-task`;
const driverTripsPath = (id: string) => `${API_PATHS.adminDriver(id)}/trips`;

function fail(code: string, params: ErrorParams = {}): never {
  throw new ApiError(code, adminErrorMessage(code, params), { params });
}
const notSupported = (): Promise<never> => Promise.reject(new ApiError("NOT_SUPPORTED", adminErrorMessage("NOT_SUPPORTED", {})));
const invalid = (message: string): never => {
  throw new ApiError("VALIDATION_ERROR", message, { status: 422 });
};

/** Follows `cursor` with the largest page size, at most 5 pages (500 rows).
 * The screens take whole arrays; larger sets need a paged table (gap). */
async function fetchAll<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page++) {
    const res: Api.CursorPage<T> = await http.get<Api.CursorPage<T>>(path, { ...query, limit: 100, cursor: cursor ?? undefined });
    out.push(...res.data);
    cursor = res.cursor;
    if (!cursor) break;
  }
  return out;
}

// ------------------------------------------------------------- session
let meCache: Me | null = null;
async function currentMe(): Promise<Me> {
  if (!meCache) meCache = map.meFromApi(await http.get<Api.AdminMe>(API_PATHS.adminMe));
  return meCache;
}

/** Staff names for the bare ids on complaints and audit entries: the
 * current admin, plus the staff list when this role may read it (loaded
 * once per session; without the section ids stay "#1a2b3c4d"). */
let staffNamesLoaded: Promise<void> | null = null;
async function staffNameOf(): Promise<map.StaffNameOf> {
  const me = await currentMe().catch(() => null);
  if (me?.sections.includes("staff") && !staffNamesLoaded) {
    staffNamesLoaded = fetchAll<Api.Staff>(API_PATHS.adminStaff)
      .then((rows) => void remember(rawStaff, rows))
      .catch(() => {
        staffNamesLoaded = null;
      });
  }
  await staffNamesLoaded;
  return (id) => (me && id === me.id ? me.name : rawStaff.get(id)?.full_name);
}

/** Results of actions that are already final on the server, shown through
 * the shared ReviewStatus component (settled immediately — no timers). */
const reviews = new Map<string, ReviewRequest>();
function settledReview(kind: ReviewKind, status: "approved" | "rejected" = "approved"): ReviewRequest {
  const now = Date.now();
  const r: ReviewRequest = { id: uuidV4(), kind, status, createdAt: now, resolvesAt: now };
  reviews.set(r.id, r);
  return r;
}

// Three-step login state, keyed by our own requestId (codes are never kept).
type LoginFlow =
  | { step: "email_code"; email: string; challengeId: string }
  | { step: "phone_code"; challengeId: string; resend: () => Promise<Api.AdminLoginChallenge> };
const logins = new Map<string, LoginFlow>();
// The admin contract has no resend_after; this is only the UI cooldown (429 still applies).
const RESEND_SECONDS = 60;
/** The challenge's own code length, when the server says (4–6). */
const codeLength = (ch: Api.AdminLoginChallenge) =>
  typeof ch.code_length === "number" && ch.code_length >= 4 && ch.code_length <= 6 ? ch.code_length : undefined;

function requirePhone(raw: string | undefined): string {
  const phone = normalizePhoneOrNull(raw);
  if (!phone) invalid("Telefon raqamini to'liq kiriting, masalan: +998 90 123 45 67.");
  return phone as string;
}
const normalizePhoneOrNull = (raw: string | undefined) => (raw ? map.normalizePhone(raw) : null);

function requireFlow(requestId: string): LoginFlow {
  const flow = logins.get(requestId);
  if (!flow) fail("AUTH_OTP_EXPIRED");
  return flow as LoginFlow;
}

function clearCaches() {
  meCache = null;
  rawDrivers.clear();
  rawPassengers.clear();
  rawStaff.clear();
  rawTariffs.clear();
  walletIds.clear();
  staffNamesLoaded = null;
  activeTask = null;
  logins.clear();
  reviews.clear();
}
session.onEnd(clearCaches);

// ------------------------------------------------------------- caches
// Last rows the server sent, so actions that need the full object (tariff
// PUT, archive results) don't refetch. Never persisted.
const rawDrivers = new Map<string, Api.AdminDriver>();
const rawPassengers = new Map<string, Api.AdminPassenger>();
const rawStaff = new Map<string, Api.Staff>();
const rawTariffs = new Map<string, Api.Tariff>();
/** driverId → wallet_id, learned from the ledger (AdminDriver has no wallet_id). */
const walletIds = new Map<string, string>();
const driverOfWallet = (walletId: string) => {
  for (const [driverId, w] of walletIds) if (w === walletId) return driverId;
  return "";
};
let activeTask: Api.QueueItem | null = null;

function remember<T extends { id: string }>(cache: Map<string, T>, rows: T[]): T[] {
  for (const r of rows) cache.set(r.id, r);
  return rows;
}

let tariffsInFlight: Promise<Api.Tariff[]> | null = null;
function loadTariffs(): Promise<Api.Tariff[]> {
  // The screen asks for active + archived + proposals in the same tick:
  // those share one request; anything after it settles fetches fresh data.
  if (!tariffsInFlight) {
    tariffsInFlight = fetchAll<Api.Tariff>(API_PATHS.adminTariffs)
      .then((rows) => remember(rawTariffs, rows))
      .finally(() => {
        tariffsInFlight = null;
      });
  }
  return tariffsInFlight;
}

async function walletIdFor(driverId: string): Promise<string> {
  const known = walletIds.get(driverId);
  if (known) return known;
  // AdminDriver has no wallet_id (gap): read it off the driver's ledger.
  const page = await http.get<Api.LedgerPage>(API_PATHS.adminWalletLedger, { driver_id: driverId, limit: 1 });
  const walletId = page.data[0]?.wallet_id;
  if (!walletId) throw new ApiError("WALLET_NOT_FOUND", "Bu haydovchining hamyonida hali yozuv yo'q, shuning uchun tuzatish yuborib bo'lmaydi.");
  walletIds.set(driverId, walletId);
  return walletId;
}

function personName(full: string | undefined) {
  if (full === undefined) return {};
  const name = map.splitName(full);
  if (!name) invalid("Ism va familiyani kiriting.");
  return name as { first_name: string; last_name: string };
}

function blockBody(status: "active" | "blocked", reason?: string): Api.AdminPersonUpdate {
  if (status === "blocked") {
    const r = reason?.trim();
    if (!r) invalid("Bloklash sababini kiriting.");
    return { state: "blocked", state_reason: r };
  }
  return { state: "active" };
}

const rejectReason = (reason?: string) => {
  const r = reason?.trim() ?? "";
  if (r.length < 3) invalid("Rad etish sababini kiriting (kamida 3 ta belgi).");
  return r;
};

async function complaintDetail(id: string): Promise<Complaint> {
  const c = await http.get<Api.ComplaintDetail>(API_PATHS.adminComplaint(id));
  return map.complaintFromApi(c, await staffNameOf());
}

// --------------------------------------------------------------- adapter
export const httpAdapter: ApiAdapter = {
  capabilities: CAPABILITIES,
  onSessionEnd: (listener) =>
    session.onEnd((reason) => {
      if (reason !== "logout") listener();
    }),

  // --- auth -------------------------------------------------------------
  async requestLogin(identifier): Promise<LoginStartResult> {
    const value = identifier.trim();
    const requestId = uuidV4();
    if (value.includes("@")) {
      const email = value.toLowerCase();
      const ch = await http.post<Api.AdminLoginChallenge>(API_PATHS.adminLoginEmail, { email } satisfies Api.AdminLoginEmail, { auth: false });
      logins.set(requestId, { step: "email_code", email, challengeId: ch.challenge_id });
      return {
        requestId,
        steps: ["email_code", "phone_code"],
        resendSeconds: RESEND_SECONDS,
        attemptsLeft: 0,
        needsPhone: true,
        codeMinLength: codeLength(ch) ?? 6,
        codeLength: codeLength(ch),
      };
    }
    // Staff without an email (operators): phone + SMS only.
    const phone = requirePhone(value);
    const send = () => http.post<Api.AdminLoginChallenge>(API_PATHS.adminLoginSms, { phone } satisfies Api.AdminLoginSms, { auth: false });
    const ch = await send();
    logins.set(requestId, { step: "phone_code", challengeId: ch.challenge_id, resend: send });
    return {
      requestId,
      steps: ["phone_code"],
      resendSeconds: RESEND_SECONDS,
      attemptsLeft: 0,
      codeMinLength: codeLength(ch) ?? 4,
      codeLength: codeLength(ch),
    };
  },

  async verifyLoginStep(requestId, code, extra): Promise<LoginStepResult> {
    const flow = requireFlow(requestId);
    if (flow.step === "email_code") {
      const phone = requirePhone(extra?.phone);
      const body: Api.AdminLoginSms = { challenge_id: flow.challengeId, email_code: code, phone };
      const send = () => http.post<Api.AdminLoginChallenge>(API_PATHS.adminLoginSms, body, { auth: false });
      const ch = await send();
      logins.set(requestId, { step: "phone_code", challengeId: ch.challenge_id, resend: send });
      return {
        done: false,
        requestId,
        step: "phone_code",
          resendSeconds: RESEND_SECONDS,
        attemptsLeft: 0,
        codeMinLength: codeLength(ch) ?? 4,
        codeLength: codeLength(ch),
      };
    }
    const token = await http.post<Api.AdminToken>(
      API_PATHS.adminLoginVerify,
      { challenge_id: flow.challengeId, sms_code: code } satisfies Api.AdminLoginVerify,
      { auth: false }
    );
    logins.delete(requestId);
    meCache = null;
    session.signIn(token);
    return { done: true };
  },

  async resendLoginCode(requestId) {
    const flow = requireFlow(requestId);
    const ch =
      flow.step === "email_code"
        ? await http.post<Api.AdminLoginChallenge>(API_PATHS.adminLoginEmail, { email: flow.email }, { auth: false })
        : await flow.resend();
    flow.challengeId = ch.challenge_id;
    return { resendSeconds: RESEND_SECONDS, codeLength: codeLength(ch) };
  },

  async getReviewStatus(reviewId) {
    const r = reviews.get(reviewId);
    if (!r) fail("NOT_FOUND");
    return r as ReviewRequest;
  },

  // Revoke the token on the server first (same token gets 401 afterwards),
  // then clear memory. Offline/timeout/401 still signs out locally.
  async logout() {
    if (session.hasSession()) {
      await http.post(API_PATHS.adminLogout, undefined, { timeoutMs: LOGOUT_TIMEOUT_MS }).catch(() => undefined);
    }
    await session.logout();
  },
  getMe: () => currentMe(),
  isAuthenticated: () => session.hasSession(),
  loginAsRole: notSupported,

  // --- stats ------------------------------------------------------------
  async getDashboard(period) {
    const range = map.dashboardRange(period);
    const chartRange = map.last14Days();
    const [kpi, chart, me] = await Promise.all([
      http.get<Api.Stats>(API_PATHS.adminStats, range),
      http.get<Api.Stats>(API_PATHS.adminStats, chartRange),
      currentMe(),
    ]);
    let recent: OrderWithNames[] | null = null;
    if (me.sections.includes("orders")) {
      // Newest first; a failure here only hides the block.
      recent = await http
        .get<Api.OrderPage>(API_PATHS.adminOrders, { limit: 4 })
        .then((p) => p.data.map((o) => map.orderFromApi(o)))
        .catch(() => null);
    }
    return map.dashboardFromApi(period, kpi, chart, chartRange, recent, me.sections);
  },

  async getStats(period) {
    const range = map.statsRange(period);
    const stats = await http.get<Api.Stats>(API_PATHS.adminStats, range);
    return map.statsFromApi(stats, period, range);
  },

  getCities: notSupported,
  getSectionBadges: notSupported,

  // Expected endpoint (not in openapi.yml yet; hidden via capabilities until
  // the backend ships it): GET /admin/v1/search?q= → { items: GlobalSearchHit[] }.
  async globalSearch(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const res = await http.get<{ items: GlobalSearchHit[] }>(ADMIN_SEARCH_PATH, { q });
    return res.items;
  },

  // --- staff ------------------------------------------------------------
  async getStaff(query) {
    const role = query.role && query.role !== "all" ? map.roleToApi(query.role) : undefined;
    const rows = remember(rawStaff, await fetchAll<Api.Staff>(API_PATHS.adminStaff, { role }));
    return rows.map(map.staffFromApi);
  },
  async createStaff(input) {
    const body: Api.StaffCreate = {
      email: input.email.trim() || null,
      phone: requirePhone(input.phone),
      full_name: input.name.trim(),
      role: map.roleToApi(input.role),
    };
    const s = await http.post<Api.Staff>(API_PATHS.adminStaff, body);
    rawStaff.set(s.id, s);
    return map.staffFromApi(s);
  },
  async updateStaff(id, patch) {
    // StaffUpdate has no email (gap): the edit form keeps it read-only.
    const body: Api.StaffUpdate = {
      full_name: patch.name?.trim() || undefined,
      phone: patch.phone ? requirePhone(patch.phone) : undefined,
      role: patch.role ? map.roleToApi(patch.role) : undefined,
    };
    const s = await http.put<Api.Staff>(API_PATHS.adminStaffItem(id), body);
    rawStaff.set(s.id, s);
    return map.staffFromApi(s);
  },
  async setStaffStatus(id, status) {
    const s = await http.put<Api.Staff>(API_PATHS.adminStaffItem(id), { state: status } satisfies Api.StaffUpdate);
    rawStaff.set(s.id, s);
    return map.staffFromApi(s);
  },
  async archiveStaff(id) {
    await http.delete(API_PATHS.adminStaffItem(id));
    const known = rawStaff.get(id) ?? (await http.get<Api.Staff>(API_PATHS.adminStaffItem(id)));
    const archived = { ...known, state: "archived" as const };
    rawStaff.set(id, archived);
    return map.staffFromApi(archived) as StaffRow;
  },
  restoreStaff: notSupported,

  // --- drivers ----------------------------------------------------------
  async getDrivers(query) {
    const state = query.status === "active" || query.status === "blocked" || query.status === "archived" ? query.status : undefined;
    const rows = remember(rawDrivers, await fetchAll<Api.AdminDriver>(API_PATHS.adminDrivers, { q: query.search?.trim(), state }));
    return rows.map(map.driverFromApi);
  },
  getDriverCounts: notSupported,
  getDriverRoutes: notSupported,
  async getDriver(id) {
    const d = await http.get<Api.AdminDriver>(API_PATHS.adminDriver(id));
    rawDrivers.set(d.id, d);
    return { ...map.driverFromApi(d), recentTrips: null };
  },
  async getDriverTrips(driverId, query) {
    const t = await http.get<map.ApiDriverTrips>(driverTripsPath(driverId), {
      month: query.month || undefined,
      kind: query.kind && query.kind !== "all" ? query.kind : undefined,
    });
    return map.driverTripsFromApi(t);
  },
  async updateDriverProfile(id, patch) {
    // Car fields can't be changed through the API (capabilities.driverCarEdit).
    const d = await http.put<Api.AdminDriver>(API_PATHS.adminDriver(id), personName(patch.name) satisfies Api.AdminPersonUpdate);
    rawDrivers.set(d.id, d);
    return map.driverFromApi(d);
  },
  async setDriverStatus(id, status, reason) {
    const d = await http.put<Api.AdminDriver>(API_PATHS.adminDriver(id), blockBody(status, reason));
    rawDrivers.set(d.id, d);
    return map.driverFromApi(d);
  },
  async archiveDriver(id) {
    await http.delete(API_PATHS.adminDriver(id));
    const d = await http.get<Api.AdminDriver>(API_PATHS.adminDriver(id)).catch(() => {
      const known = rawDrivers.get(id);
      if (!known) throw new ApiError("DRIVER_NOT_FOUND", adminErrorMessage("DRIVER_NOT_FOUND", {}));
      return { ...known, state: "archived" as const };
    });
    rawDrivers.set(d.id, d);
    return map.driverFromApi(d);
  },
  async restoreDriver(id) {
    // Assumption: restoring is `state: active` (the contract only says
    // `state: archived` archives).
    const d = await http.put<Api.AdminDriver>(API_PATHS.adminDriver(id), { state: "active" } satisfies Api.AdminPersonUpdate);
    rawDrivers.set(d.id, d);
    return map.driverFromApi(d);
  },

  // --- passengers -------------------------------------------------------
  async getPassengers(query) {
    const state = query.status === "active" || query.status === "blocked" || query.status === "archived" ? query.status : undefined;
    const rows = remember(rawPassengers, await fetchAll<Api.AdminPassenger>(API_PATHS.adminPassengers, { q: query.search?.trim(), state }));
    return rows.map(map.passengerFromApi);
  },
  getPassengerCounts: notSupported,
  async createPassenger(input) {
    const body: Api.AdminPersonCreate = { phone: requirePhone(input.phone), ...(personName(input.name) as { first_name: string; last_name: string }) };
    const p = await http.post<Api.AdminPassenger>(API_PATHS.adminPassengers, body);
    rawPassengers.set(p.id, p);
    return map.passengerFromApi(p);
  },
  async updatePassenger(id, patch) {
    const p = await http.put<Api.AdminPassenger>(API_PATHS.adminPassenger(id), personName(patch.name) satisfies Api.AdminPersonUpdate);
    rawPassengers.set(p.id, p);
    return map.passengerFromApi(p);
  },
  async setPassengerStatus(id, status, reason) {
    const p = await http.put<Api.AdminPassenger>(API_PATHS.adminPassenger(id), blockBody(status, reason));
    rawPassengers.set(p.id, p);
    return map.passengerFromApi(p);
  },
  async archivePassenger(id) {
    await http.delete(API_PATHS.adminPassenger(id));
    const p = await http.get<Api.AdminPassenger>(API_PATHS.adminPassenger(id)).catch(() => {
      const known = rawPassengers.get(id);
      if (!known) throw new ApiError("PASSENGER_NOT_FOUND", adminErrorMessage("PASSENGER_NOT_FOUND", {}));
      return { ...known, state: "archived" as const };
    });
    rawPassengers.set(p.id, p);
    return map.passengerFromApi(p);
  },
  async restorePassenger(id) {
    const p = await http.put<Api.AdminPassenger>(API_PATHS.adminPassenger(id), { state: "active" } satisfies Api.AdminPersonUpdate);
    rawPassengers.set(p.id, p);
    return map.passengerFromApi(p);
  },

  // --- orders -----------------------------------------------------------
  async getOrders(query) {
    const status = query.status && query.status !== "all" && CAPABILITIES.orderStatuses.includes(query.status) ? query.status : undefined;
    const range = map.listPeriodRange(query.period);
    const rows = await fetchAll<Api.AdminOrder>(API_PATHS.adminOrders, { status, passenger_id: query.passengerId || undefined, ...range });
    return rows.map(map.orderFromApi);
  },
  getOrderCounts: notSupported,
  async getOrder(id) {
    return map.orderDetailFromApi(await http.get<Api.AdminOrder>(API_PATHS.adminOrder(id)));
  },
  async sendOrderToOperator(id, note) {
    await http.post(orderOperatorTaskPath(id), { note: note.trim() || undefined });
  },
  // No endpoint creates an order for a passenger (capabilities.orderCreate).
  createOrderForPassenger: notSupported,
  async updateOrderFields(id, patch) {
    // Comment, payment method and time only, while the order is searching;
    // otherwise the server answers 403 driver_assigned | trip_started | order_closed.
    const body = map.orderPatchToApi(patch);
    if (Object.keys(body).length === 0) invalid("Hech narsa o'zgarmadi.");
    if (body.comment !== undefined && body.comment.length > 200) invalid("Izoh 200 belgidan oshmasin.");
    const o = await http.patch<Api.AdminOrder>(API_PATHS.adminOrder(id), body);
    return map.orderFromApi(o);
  },
  async cancelOrder(id, reason, comment) {
    if (!CANCEL_REASONS.includes(reason as OrderCancelReasonCode)) invalid("Bekor qilish sababini tanlang.");
    const c = comment?.trim();
    if (c && c.length > 500) invalid("Izoh 500 belgidan oshmasin.");
    const body: Api.AdminOrderCancel = { reason: reason as OrderCancelReasonCode, ...(c ? { comment: c } : {}) };
    const o = await http.post<Api.AdminOrder>(API_PATHS.adminOrderCancel(id), body);
    return map.orderFromApi(o);
  },

  // --- wallet -----------------------------------------------------------
  async getWalletLedger() {
    const rows = await fetchAll<Api.LedgerEntry>(API_PATHS.adminWalletLedger);
    return rows.map(map.ledgerFromApi);
  },
  async getDriverWalletInfo(driverId) {
    const d = await http.get<Api.AdminDriver>(API_PATHS.adminDriver(driverId));
    rawDrivers.set(d.id, d);
    return { balance: map.toSom(d.wallet_balance), debtLimit: null };
  },
  async proposeWalletAdjustment(driverId, amount, reason) {
    const r = reason.trim();
    if (r.length < 5) invalid("Sababni kiriting (kamida 5 ta belgi).");
    const body: Api.CorrectionCreate = { wallet_id: await walletIdFor(driverId), amount: map.toTiyin(amount), reason: r };
    const c = await session.idempotency.run("adminWalletCorrection", body, (key) =>
      http.post<Api.Correction>(API_PATHS.adminWalletCorrection, body, { idempotencyKey: key })
    );
    return map.correctionFromApi(c, driverId, await currentMe().catch(() => null));
  },
  async getAdjustmentProposals(query) {
    const me = await currentMe().catch(() => null);
    const rows = await fetchAll<Api.CorrectionListItem>(API_PATHS.adminWalletCorrection, { approval_status: map.approvalToApi(query.status) });
    return rows.map((c) => map.correctionFromApi(c, driverOfWallet(c.wallet_id), me));
  },
  async approveAdjustment(proposalId) {
    // The creator can't approve their own correction (403 self_approval).
    const c = await http.post<Api.Correction>(API_PATHS.adminWalletCorrectionApprove(proposalId.trim()));
    return settledReview("wallet_adjust_second_approve", c.approval_status === "rejected" ? "rejected" : "approved");
  },
  async rejectAdjustment(proposalId, reason) {
    const body: Api.ApprovalReject = { reason: rejectReason(reason) };
    const c = await http.post<Api.Correction>(API_PATHS.adminWalletCorrectionReject(proposalId.trim()), body);
    return map.correctionFromApi(c, driverOfWallet(c.wallet_id), meCache);
  },

  // --- tariffs ----------------------------------------------------------
  async getTariffs(query) {
    const rows = await loadTariffs();
    const status = query.status ?? "all";
    return rows
      .filter((t) => status === "all" || (status === "active" ? t.active : !t.active && !map.isPendingCreate(t)))
      .map(map.tariffFromApi);
  },
  async getTariffProposals() {
    const me = await currentMe().catch(() => null);
    return (await loadTariffs()).map((t) => map.tariffProposalFromApi(t, me)).filter((p): p is NonNullable<typeof p> => p !== null);
  },
  async proposeTariffCreate(input) {
    if (!input.carClass) invalid("Mashina klassini tanlang.");
    const t = await http.post<Api.Tariff>(API_PATHS.adminTariffs, map.tariffToInput(input));
    rawTariffs.set(t.id, t);
    return map.tariffProposalFromApi(t, meCache) ?? fail("INTERNAL_ERROR");
  },
  async proposeTariffEdit(tariffId, patch) {
    // PUT takes the whole TariffInput: merge the change into the current values.
    const current = rawTariffs.get(tariffId) ?? (await http.get<Api.Tariff>(API_PATHS.adminTariff(tariffId)));
    const merged: Tariff = { ...map.tariffFromApi(current), ...patch };
    const t = await http.put<Api.Tariff>(API_PATHS.adminTariff(tariffId), map.tariffToInput(merged));
    rawTariffs.set(t.id, t);
    return map.tariffProposalFromApi(t, meCache) ?? fail("INTERNAL_ERROR");
  },
  async proposeTariffArchive(tariffId) {
    const t = await http.delete<Api.Tariff>(API_PATHS.adminTariff(tariffId));
    rawTariffs.set(t.id, t);
    return map.tariffProposalFromApi(t, meCache) ?? fail("INTERNAL_ERROR");
  },
  async approveTariffProposal(proposalId) {
    const t = await http.post<Api.Tariff>(API_PATHS.adminTariffApprove(proposalId));
    rawTariffs.set(t.id, t);
    return settledReview("tariff_second_approve");
  },
  async rejectTariffProposal(proposalId, reason) {
    const before = rawTariffs.get(proposalId);
    const t = await http.post<Api.Tariff>(API_PATHS.adminTariffReject(proposalId), { reason: rejectReason(reason) } satisfies Api.ApprovalReject);
    rawTariffs.set(t.id, t);
    const proposal = (before && map.tariffProposalFromApi(before, meCache)) ?? map.tariffProposalFromApi({ ...t, approval_status: "pending_approval", pending_change: { action: "update" } }, meCache);
    return { ...(proposal ?? fail("INTERNAL_ERROR")), status: "rejected", resolvedAt: Date.now() };
  },

  // --- complaints -------------------------------------------------------
  // The list has no notes; getComplaint() and every action return the
  // complaint with its notes (GET /complaints/{id}).
  async getComplaints(query) {
    const me = query.assignedToMe ? await currentMe() : null;
    const rows = await fetchAll<Api.Complaint>(API_PATHS.adminComplaints, {
      status: query.status && query.status !== "all" ? map.complaintStatusToApi(query.status) : undefined,
      subject_type: query.subjectType && query.subjectType !== "all" ? query.subjectType : undefined,
      assigned_to: me?.id,
    });
    const nameOf = await staffNameOf();
    return rows.map((c) => map.complaintFromApi(c, nameOf));
  },
  getComplaint: (id) => complaintDetail(id),
  async assignComplaint(id, toId) {
    await http.post<Api.Complaint>(API_PATHS.adminComplaintAssign(id), { staff_id: toId });
    return complaintDetail(id);
  },
  async setComplaintStatus(id, status, resolution) {
    // Transitions are the server's: open → in_progress | rejected,
    // in_progress → resolved | rejected; anything else is 403 invalid_transition.
    if (status === "open") invalid("Shikoyatni qayta ochib bo'lmaydi.");
    const apiStatus = map.complaintStatusToApi(status) as Api.ComplaintStatusChange["status"];
    const body: Api.ComplaintStatusChange = { status: apiStatus };
    if (apiStatus !== "in_progress") {
      const r = resolution?.trim() ?? "";
      if (r.length < 3) invalid("Yakuniy izohni kiriting (kamida 3 ta belgi).");
      if (r.length > 1000) invalid("Yakuniy izoh 1000 belgidan oshmasin.");
      body.resolution = r;
    }
    await http.post<Api.Complaint>(API_PATHS.adminComplaintStatus(id), body);
    return complaintDetail(id);
  },
  async addComplaintNote(id, text) {
    const t = text.trim();
    if (!t) invalid("Izoh matnini kiriting.");
    if (t.length > 1000) invalid("Izoh 1000 belgidan oshmasin.");
    await http.post<Api.ComplaintNote>(API_PATHS.adminComplaintNotes(id), { text: t });
    return complaintDetail(id);
  },

  // --- audit --------------------------------------------------------------
  async getAuditLog(query) {
    const rows = await fetchAll<Api.AuditEntry>(API_PATHS.adminAudit, {
      action: query.action && query.action !== "all" ? query.action : undefined,
      entity_type: query.entityType && query.entityType !== "all" ? query.entityType : undefined,
      from_date: query.dateFrom || undefined,
      to_date: query.dateTo || undefined,
    });
    const nameOf = await staffNameOf();
    return rows.map((e) => map.auditFromApi(e, nameOf));
  },

  // --- operator queue ---------------------------------------------------
  async getQueue() {
    const rows = await fetchAll<Api.QueueItem>(API_PATHS.adminOperatorQueue);
    return rows.map((q) => map.queueFromApi(q));
  },
  async getActiveTask() {
    const me = await currentMe();
    const rows = await fetchAll<Api.QueueItem>(API_PATHS.adminOperatorQueue);
    const mine = rows.find((q) => q.status === "in_progress" && q.assigned_to === me.id) ?? activeTask;
    return mine && mine.status === "in_progress" ? map.queueFromApi(mine) : null;
  },
  async startTask(queueId) {
    const q = await http.post<Api.QueueItem>(API_PATHS.adminOperatorStart(queueId));
    activeTask = q;
    return map.queueFromApi(q);
  },
  async rejectQueueItem(queueId, reason) {
    const q = await http.post<Api.QueueItem>(API_PATHS.adminOperatorReject(queueId), { reason: rejectReason(reason) } satisfies Api.QueueReject);
    return map.queueFromApi(q);
  },
  async finishTask(queueId, result, note, reason) {
    const q =
      result === "rejected"
        ? await http.post<Api.QueueItem>(API_PATHS.adminOperatorReject(queueId), { reason: rejectReason(reason) } satisfies Api.QueueReject)
        : await http.post<Api.QueueItem>(API_PATHS.adminOperatorComplete(queueId), {
            result: result === "resolved" ? "resolved" : "unresolved",
            comment: note.trim() || undefined,
          } satisfies Api.QueueComplete);
    if (activeTask?.id === q.id) activeTask = null;
    return map.historyFromApi(q, meCache);
  },
  getOperatorsInProgress: notSupported,
  async getHistory() {
    const me = await currentMe().catch(() => null);
    const rows = await fetchAll<Api.QueueItem>(API_PATHS.adminOperatorHistory);
    return rows.map((q) => map.historyFromApi(q, me));
  },
  editHistoryEntry: notSupported,
  getOperatorCounts: notSupported,
  getOperatorsList: notSupported,

  recordExport: notSupported,
};

/** Picked by the `@active-adapter` alias unless VITE_DEMO_MODE=true. */
export const adapter = httpAdapter;
