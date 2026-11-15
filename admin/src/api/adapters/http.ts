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
  AdjustmentProposal,
  LoginStartResult,
  LoginStepResult,
  Me,
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
  orderEdit: false,
  orderPassenger: false,
  walletLedgerFilters: false,
  walletDriverName: false,
  adjustmentProposalsList: false,
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
};

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
  createdCorrections.length = 0;
  activeTask = null;
  logins.clear();
  reviews.clear();
}
session.onEnd(clearCaches);

// ------------------------------------------------------------- caches
// Last rows the server sent, so actions that need the full object (tariff
// PUT, phone reveal, archive results) don't refetch. Never persisted.
const rawDrivers = new Map<string, Api.AdminDriver>();
const rawPassengers = new Map<string, Api.AdminPassenger>();
const rawStaff = new Map<string, Api.Staff>();
const rawTariffs = new Map<string, Api.Tariff>();
const walletIds = new Map<string, string>();
/** Corrections created in this tab: there is no endpoint listing pending
 * corrections (gap), so this is all the UI can show. */
const createdCorrections: AdjustmentProposal[] = [];
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
        maskedDestination: map.maskEmail(email),
        resendSeconds: RESEND_SECONDS,
        attemptsLeft: 0,
        needsPhone: true,
        codeMinLength: 6,
      };
    }
    // Staff without an email (operators): phone + SMS only.
    const phone = requirePhone(value);
    const send = () => http.post<Api.AdminLoginChallenge>(API_PATHS.adminLoginSms, { phone } satisfies Api.AdminLoginSms, { auth: false });
    const ch = await send();
    logins.set(requestId, { step: "phone_code", challengeId: ch.challenge_id, resend: send });
    return { requestId, steps: ["phone_code"], maskedDestination: map.maskPhone(phone), resendSeconds: RESEND_SECONDS, attemptsLeft: 0, codeMinLength: 4 };
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
        maskedDestination: map.maskPhone(phone),
        resendSeconds: RESEND_SECONDS,
        attemptsLeft: 0,
        codeMinLength: 4,
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
    return { done: true, reviewId: settledReview("login_2fa").id };
  },

  async resendLoginCode(requestId) {
    const flow = requireFlow(requestId);
    if (flow.step === "email_code") {
      const ch = await http.post<Api.AdminLoginChallenge>(API_PATHS.adminLoginEmail, { email: flow.email }, { auth: false });
      flow.challengeId = ch.challenge_id;
    } else {
      const ch = await flow.resend();
      flow.challengeId = ch.challenge_id;
    }
    return { resendSeconds: RESEND_SECONDS };
  },

  async getReviewStatus(reviewId) {
    const r = reviews.get(reviewId);
    if (!r) fail("NOT_FOUND");
    return r as ReviewRequest;
  },

  // No admin logout endpoint in the contract (gap): clear this tab only.
  logout: () => session.logout(),
  getMe: () => currentMe(),
  isAuthenticated: () => session.hasSession(),
  loginAsRole: notSupported,

  // --- stats ------------------------------------------------------------
  async getStats(period) {
    const stats = await http.get<Api.Stats>(API_PATHS.adminStats, map.statsRange(period));
    return map.statsFromApi(stats, period);
  },

  getCities: notSupported,
  getSectionBadges: notSupported,

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

  // --- orders (read-only in the contract) ------------------------------
  async getOrders(query) {
    const status = query.status && query.status !== "all" && CAPABILITIES.orderStatuses.includes(query.status) ? query.status : undefined;
    const rows = await fetchAll<Api.Order>(API_PATHS.adminOrders, { status });
    return rows.map(map.orderFromApi);
  },
  createOrderForPassenger: notSupported,
  updateOrderFields: notSupported,
  cancelOrder: notSupported,

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
    const body: Api.CorrectionCreate = { wallet_id: await walletIdFor(driverId), amount: map.toTiyin(amount), reason: reason.trim() };
    const c = await session.idempotency.run("adminWalletCorrection", body, (key) =>
      http.post<Api.Correction>(API_PATHS.adminWalletCorrection, body, { idempotencyKey: key })
    );
    const proposal = map.correctionFromApi(c, driverId, await currentMe().catch(() => null));
    createdCorrections.unshift(proposal);
    return proposal;
  },
  async getAdjustmentProposals() {
    // No list endpoint (gap): only corrections created in this tab.
    return [...createdCorrections];
  },
  async approveAdjustment(proposalId) {
    const c = await http.post<Api.Correction>(API_PATHS.adminWalletCorrectionApprove(proposalId.trim()));
    const i = createdCorrections.findIndex((p) => p.id === c.id);
    if (i >= 0) createdCorrections.splice(i, 1);
    return settledReview("wallet_adjust_second_approve", c.approval_status === "rejected" ? "rejected" : "approved");
  },
  async rejectAdjustment(proposalId, reason) {
    const body: Api.ApprovalReject = { reason: rejectReason(reason) };
    const c = await http.post<Api.Correction>(API_PATHS.adminWalletCorrectionReject(proposalId.trim()), body);
    const i = createdCorrections.findIndex((p) => p.id === c.id);
    const driverId = i >= 0 ? createdCorrections[i].driverId : "";
    if (i >= 0) createdCorrections.splice(i, 1);
    return map.correctionFromApi(c, driverId, meCache);
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

  // --- complaints / audit: no endpoints --------------------------------
  getComplaints: notSupported,
  assignComplaint: notSupported,
  setComplaintStatus: notSupported,
  addComplaintNote: notSupported,
  getAuditLog: notSupported,

  async revealPhone(entityType, entityId) {
    // Lists already carry the full number (no masked list + audited reveal
    // endpoint in the contract — gap); show the value the server sent.
    const cached = entityType === "driver" ? rawDrivers.get(entityId) : rawPassengers.get(entityId);
    const row =
      cached ??
      (entityType === "driver"
        ? await http.get<Api.AdminDriver>(API_PATHS.adminDriver(entityId))
        : await http.get<Api.AdminPassenger>(API_PATHS.adminPassenger(entityId)));
    return { phone: map.formatPhone(row.phone) };
  },

  // --- operator queue ---------------------------------------------------
  async getQueue() {
    const rows = await fetchAll<Api.QueueItem>(API_PATHS.adminOperatorQueue);
    return rows.map((q) => {
      const { phoneFull: _full, ...item } = map.queueFromApi(q);
      return item;
    });
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
    const { phoneFull: _full, ...item } = map.queueFromApi(q);
    return item;
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
