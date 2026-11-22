import { ApiError, withLatency } from "@/mockDb/latency";
import { roadDistanceKm, computePrice, type Order, type Tariff, type Driver, type Passenger, type Complaint, type ComplaintType } from "@/seed/generate";
import {
  db,
  ROLE_SECTIONS,
  ROLE_ACTIONS,
  CREATABLE_ROLES,
  ROLE_LANDING,
  canCreateRole,
  getStaff as readStaff,
  getStaffMember,
  findStaffByEmailOrPhone,
  upsertStaffMember,
  addAuditEntry,
  getAuditLog as readAuditLog,
  getReviewRequest,
  saveReviewRequest,
  getTariffProposals as readTariffProposals,
  saveTariffProposal,
  getAdjustmentProposals as readAdjustmentProposals,
  saveAdjustmentProposal,
  getSession,
  setSession,
  getQueue as readQueue,
  saveQueue,
  getHistory as readHistory,
  saveHistory,
  type AdminUser,
  type AdminRole,
  type ReviewRequest,
  type TariffProposal,
  type AdjustmentProposal,
  type QueueItem,
  type HistoryEntry,
} from "@/mockDb/db";
import { formatDayShort, formatPhone } from "@/lib/format";
import type { ApiAdapter } from "../adapterTypes";
import type {
  MarketingStats,
  OrderWithNames,
  WalletLedgerRow,
  Me,
  LoginStartResult,
  LoginStepResult,
  LoginStep,
  QueueListItem,
  ActiveTask,
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
  OperatorApprovedQuery,
  SectionBadges,
  OperatorCounts,
  ArchivableStatusFilter,
  AdapterCapabilities,
  GlobalSearchHit,
  Dashboard,
  AttentionItem,
  ListCounts,
  ListPeriod,
  DashboardPeriod,
  OrderDetail,
  OrderTimelineStep,
  OrderPriceLine,
  DriverProfile,
  DriverTrips,
  DriverTripRow,
  DriverLevel,
  Section,
} from "../types";

const FRAUD_TYPES: ComplaintType[] = ["suspicious_gps", "repeated_pair", "otp_abuse", "referral_abuse"];

function matchesSearch(haystack: string, search?: string): boolean {
  if (!search || !search.trim()) return true;
  return haystack.toLowerCase().includes(search.trim().toLowerCase());
}

/** Shared "status + archived" filter used by Staff, Drivers and Passengers:
 * no value or "all" means every non-archived row, "archived" means only
 * archived ones, anything else is that exact status among non-archived
 * rows. Business-rule filtering lives here, not in a screen's .filter(). */
function filterByArchivableStatus<S extends string, T extends { archived: boolean; status: S }>(
  rows: T[],
  status: ArchivableStatusFilter<S> | undefined
): T[] {
  if (!status || status === "all") return rows.filter((r) => !r.archived);
  if (status === "archived") return rows.filter((r) => r.archived);
  return rows.filter((r) => !r.archived && r.status === status);
}

function dayStartMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getTime();
}
function dayEndMs(dateStr: string): number {
  return new Date(`${dateStr}T23:59:59.999`).getTime();
}

function requireSession() {
  const s = getSession();
  if (!s) throw new ApiError("UNAUTHORIZED", "Avtorizatsiyadan o'tilmagan.");
  return s;
}

function currentAdmin(): AdminUser {
  const s = requireSession();
  const u = getStaffMember(s.adminId);
  if (!u) throw new ApiError("NOT_FOUND", "Admin topilmadi");
  return u;
}

function assertCanActOnRole(actor: AdminUser, role: AdminRole) {
  if (!canCreateRole(actor.role, role)) throw new ApiError("FORBIDDEN", "Bu rol uchun ruxsatingiz yo'q.");
}

// Phone is how every staff member is created and how operators log in, so
// it's always required. Email is required for everyone except operators,
// who authenticate with a phone SMS code only.
function assertContactInfo(role: AdminRole, phone: string, email: string) {
  if (!phone.trim()) throw new ApiError("VALIDATION", "Telefon raqami talab qilinadi.");
  if (role !== "operator" && !email.trim()) throw new ApiError("VALIDATION", "Email talab qilinadi.");
}

function requireAction(actor: AdminUser, action: "export" | "operatorWork" | "operatorSupervise") {
  if (!ROLE_ACTIONS[actor.role].includes(action)) throw new ApiError("FORBIDDEN", "Bu amal uchun ruxsatingiz yo'q.");
}

function genCode(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

// ---------------------------------------------------------------------
// Login: identifier -> steps (decided by role) -> OTP per step -> review.
// Attempt state is in-memory only (never persisted) — it's throwaway state
// for one login flow, not mock-server data.
// ---------------------------------------------------------------------
type LoginAttemptState = {
  adminId: string;
  steps: LoginStep[];
  stepIndex: number;
  code: string;
  attemptsLeft: number;
};
const loginAttempts = new Map<string, LoginAttemptState>();

function resolveReview(req: ReviewRequest): ReviewRequest {
  if (req.status === "pending" && Date.now() >= req.resolvesAt) {
    req.status = "approved";
    saveReviewRequest(req);
  }
  return req;
}

function applyTariffProposal(p: TariffProposal) {
  if (p.type === "create") {
    const tariff: Tariff = {
      id: `tar_${Date.now().toString(36)}`,
      archived: false,
      ...(p.patch as Omit<Tariff, "id" | "archived">),
    };
    db.addTariff(tariff);
  } else if (p.type === "edit" && p.tariffId) {
    db.updateTariff(p.tariffId, p.patch);
  } else if (p.type === "archive" && p.tariffId) {
    db.updateTariff(p.tariffId, { archived: true });
  }
}

function applyAdjustment(p: AdjustmentProposal) {
  const driver = db.getDriver(p.driverId);
  if (!driver) return;
  const newBalance = driver.walletBalance + p.amount;
  db.addWalletEntry({
    id: `wal_adj_${Date.now().toString(36)}`,
    driverId: p.driverId,
    type: "adjustment",
    amount: p.amount,
    reason: p.reason,
    createdByAdminId: p.proposedById,
    createdByAdminName: p.proposedByName,
    createdAt: Date.now(),
    balanceAfter: newBalance,
  });
  db.updateDriver(p.driverId, { walletBalance: newBalance });
}

function decorateOrder(o: Order): OrderWithNames {
  const passengers = db.passengers();
  const drivers = db.drivers();
  const cities = db.cities();
  return {
    ...o,
    passengerName: passengers.find((p) => p.id === o.passengerId)?.name ?? "—",
    passengerPhone: passengers.find((p) => p.id === o.passengerId)?.phone ?? null,
    driverName: o.driverId ? drivers.find((d) => d.id === o.driverId)?.name ?? "—" : null,
    fromCityName: cities.find((c) => c.id === o.fromCityId)?.name ?? o.fromCityId,
    toCityName: cities.find((c) => c.id === o.toCityId)?.name ?? o.toCityId,
    canCancel: !["completed", "cancelled", "no_driver"].includes(o.status),
  };
}

// ---------------------------------------------------------------------
// v2 group 3 helpers. The mock is the "server": it decides periods,
// counts, levels, timelines and price lines.
// ---------------------------------------------------------------------
const DAY_MS = 86_400_000;
/** The mock's "today": the day the sample data was generated. */
function mockToday(): number {
  const d = new Date(db.generatedAt());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function periodBounds(p: ListPeriod | DashboardPeriod | undefined): [number, number] | null {
  if (!p || p === "all") return null;
  const t = mockToday();
  if (p === "today") return [t, Infinity];
  if (p === "yesterday") return [t - DAY_MS, t];
  if (p === "7d") return [t - 6 * DAY_MS, Infinity];
  return [t - 29 * DAY_MS, Infinity];
}
const inBounds = (ts: number, b: [number, number] | null) => !b || (ts >= b[0] && ts < b[1]);

function requireSection(actor: AdminUser, section: Section) {
  if (!ROLE_SECTIONS[actor.role].includes(section)) throw new ApiError("FORBIDDEN", "Bu bo'lim uchun ruxsatingiz yo'q.");
}

function countBy<T, K extends string>(rows: T[], key: (r: T) => K | null): ListCounts<K> {
  const out: ListCounts<K> = { all: rows.length } as ListCounts<K>;
  for (const r of rows) {
    const k = key(r);
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function ordersMatching(query: Omit<OrderQuery, "status">): Order[] {
  const bounds = periodBounds(query.period);
  const passengers = db.passengers();
  const drivers = db.drivers();
  return db
    .orders()
    .filter((o) => (!query.kind || query.kind === "all" || o.kind === query.kind) && inBounds(o.createdAt, bounds))
    .filter((o) => !query.passengerId || o.passengerId === query.passengerId)
    .filter((o) => {
      if (!query.search) return true;
      const p = passengers.find((x) => x.id === o.passengerId);
      const d = o.driverId ? drivers.find((x) => x.id === o.driverId) : undefined;
      return matchesSearch(`${o.id} ${p?.name ?? ""} ${p?.phone ?? ""} ${d?.name ?? ""} ${o.fromCityId} ${o.toCityId}`, query.search);
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function driversMatching(query: Omit<DriverQuery, "status">) {
  return db
    .drivers()
    .filter((d) => !query.search || matchesSearch(`${d.name} ${d.plate} ${d.carModel} ${d.phone}`, query.search))
    .filter((d) => !query.route || query.route === "all" || d.route === query.route)
    .filter((d) => !query.level || query.level === "all" || d.level === query.level);
}

function passengersMatching(query: Omit<PassengerQuery, "status">) {
  const bounds = periodBounds(query.joined);
  return db
    .passengers()
    .filter((p) => !query.search || matchesSearch(`${p.name} ${p.phone}`, query.search))
    .filter((p) => inBounds(p.joinedAt, bounds));
}

const LEVEL_LABEL: Record<DriverLevel, string> = { bronze: "Bronza", silver: "Kumush", gold: "Oltin" };
const shortName = (name: string) => {
  const [first, last] = name.split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
};

function tripSubject(o: Order): string {
  const p = db.getPassenger(o.passengerId);
  const who = p ? shortName(p.name) : "—";
  if (o.kind === "delivery") return `${who} · Kuzov ${o.bodySize ?? "—"}`;
  return o.mode === "car" ? `${who} · butun mashina` : `${who} · ${o.seatIds.length} kishi`;
}

function tripRow(o: Order): DriverTripRow {
  const cities = db.cities();
  return {
    orderId: o.id,
    kind: o.kind,
    at: o.createdAt,
    fromName: cities.find((c) => c.id === o.fromCityId)?.name ?? o.fromCityId,
    toName: cities.find((c) => c.id === o.toCityId)?.name ?? o.toCityId,
    subject: tripSubject(o),
    price: o.price,
    paymentMethod: o.paymentMethod,
    commission: o.commission,
    payout: o.driverPayout,
    status: o.status,
    cancelledBy: o.cancelledBy,
  };
}

const monthKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function orderSteps(o: Order, driverName: string | null): OrderTimelineStep[] {
  const t0 = o.createdAt;
  const steps: OrderTimelineStep[] = [
    { title: "Buyurtma yaratildi", detail: o.createdByAdminId ? "Admin panelidan" : "Yo'lovchi ilovasidan", at: t0, state: "done" },
  ];
  const tripMs = (o.durationMin ?? 120) * 60_000;
  if (o.status === "searching") {
    steps.push({ title: "Haydovchi qidirilmoqda", detail: null, at: null, state: "current" });
    steps.push({ title: "Haydovchi qabul qiladi", detail: null, at: null, state: "pending" });
    return steps;
  }
  if (o.status === "no_driver") {
    steps.push({ title: "Haydovchi topilmadi", detail: "Hech kim qabul qilmadi", at: t0 + 5 * 60_000, state: "done" });
    return steps;
  }
  if (o.driverId) steps.push({ title: "Haydovchi qabul qildi", detail: driverName, at: t0 + 60_000, state: "done" });
  if (o.status === "cancelled") {
    const by = o.cancelledBy === "driver" ? "Haydovchi" : o.cancelledBy === "admin" ? "Admin" : "Yo'lovchi";
    steps.push({ title: "Bekor qilindi", detail: `${by} bekor qildi`, at: t0 + 12 * 60_000, state: "done" });
    return steps;
  }
  const picked = t0 + 40 * 60_000;
  const end = picked + tripMs;
  if (o.status === "accepted") {
    steps.push({ title: "Haydovchi yo'lda", detail: "Olish nuqtasiga kelmoqda", at: null, state: "current" });
    steps.push({ title: "Yo'lovchi olinadi", detail: null, at: picked, estimated: true, state: "pending" });
    steps.push({ title: "Tugaydi", detail: null, at: end, estimated: true, state: "pending" });
    return steps;
  }
  steps.push({ title: o.kind === "delivery" ? "Yuk olindi" : "Yo'lovchi olindi", detail: "Kutish 3 daqiqa, bepul", at: picked, state: "done" });
  if (o.status === "in_progress") {
    steps.push({ title: "Safarda", detail: null, at: null, state: "current" });
    steps.push({ title: "Tugadi", detail: "Komissiya avtomatik yechiladi", at: end, estimated: true, state: "pending" });
  } else {
    steps.push({ title: "Tugadi", detail: "Komissiya yechildi", at: end, state: "done" });
  }
  return steps;
}

function orderPriceLines(o: Order, driver: Driver | undefined): OrderPriceLine[] {
  const lines: OrderPriceLine[] = [];
  const main =
    o.kind === "delivery" ? `Dostavka, kuzov ${o.bodySize ?? "—"}` : o.mode === "car" ? "Butun mashina" : `Safar, ${o.seatIds.length} o'rin`;
  lines.push({ label: main, amount: o.price, kind: "line" });
  if (o.commission !== null && driver) {
    const lvl = driver.level ? `${LEVEL_LABEL[driver.level]}, ` : "";
    lines.push({ label: `Komissiya (${lvl}${driver.commissionPct ?? 0}%)`, amount: o.commission, kind: "commission" });
  }
  if (o.driverPayout !== null) lines.push({ label: "Haydovchiga", amount: o.driverPayout, kind: "payout" });
  return lines;
}

function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function toQueueListItem(q: QueueItem): QueueListItem {
  return { ...q };
}

const MOCK_CAPABILITIES: AdapterCapabilities = {
  staffSearch: true,
  staffStatusFilter: true,
  staffEmailEdit: true,
  staffLastLogin: true,
  restoreStaff: true,
  driverReviewFilter: true,
  driverOnline: true,
  driverDebtLimit: true,
  driverCarEdit: true,
  passengerCity: true,
  orderSearch: true,
  orderCreate: true,
  orderEdit: true,
  orderPassenger: true,
  walletLedgerFilters: true,
  walletDriverName: true,
  adjustmentProposalsList: true,
  tariffSearch: true,
  tariffProposalValues: true,
  queueFilters: true,
  historyFilters: true,
  historyEdit: true,
  operatorCounts: true,
  sectionBadges: true,
  tariffFields: ["baseFare", "perKmCar", "perKmSeat", "frontSeatSurcharge", "fuelAdjustmentPct", "commissionPct"],
  tariffCarClass: false,
  orderStatuses: ["completed", "cancelled", "in_progress", "accepted", "searching", "no_driver"],
  orderEditFields: ["seats", "timeWindow", "note"],
  orderNoteMaxLength: null,
  orderCancelReasons: false,
  adjustmentReasonMinLength: 1,
  complaintSearch: true,
  complaintCategoryFilter: true,
  complaintSubjectFilter: false,
  complaintAssigneeFilter: false,
  complaintNotesInList: true,
  complaintResolution: false,
  auditSearch: true,
  auditApiFilters: false,
  globalSearch: true,
  orderCounts: true,
  orderKindFilter: true,
  orderDateFilter: true,
  orderToOperator: true,
  driverCounts: true,
  driverRouteFilter: true,
  driverLevelFilter: true,
  driverTrips: true,
  passengerCounts: true,
  passengerJoinedFilter: true,
};

export const mockAdapter: ApiAdapter = {
  capabilities: MOCK_CAPABILITIES,
  // The mock session never expires on its own (idle logout is UI-side).
  onSessionEnd: () => () => {},

  requestLogin: (identifier) =>
    withLatency<LoginStartResult>(() => {
      const value = identifier.trim();
      const byEmail = value.includes("@");
      const user = findStaffByEmailOrPhone(value);
      if (!user) throw new ApiError("NOT_FOUND", "Bunday xodim topilmadi.");
      if (user.archived) throw new ApiError("ARCHIVED", "Hisob arxivlangan.");
      if (user.status === "blocked") throw new ApiError("BLOCKED", "Hisob bloklangan.");
      // Doc 2.5: operators sign in with phone + SMS only; everyone else with
      // email code + SMS code. The phone-only path is not open to them.
      if (!byEmail && user.role !== "operator")
        throw new ApiError("EMAIL_REQUIRED", "Bu hisob email va SMS kod bilan kiradi. Email orqali kiring.");
      const steps: LoginStep[] = user.role === "operator" ? ["phone_code"] : ["email_code", "phone_code"];
      const requestId = `li_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const code = genCode();
      loginAttempts.set(requestId, { adminId: user.id, steps, stepIndex: 0, code, attemptsLeft: 3 });
      addAuditEntry({
        actorId: user.id,
        actorName: user.name,
        action: "login_requested",
        targetType: "session",
        targetId: user.id,
        detail: `Kirish so'rovi yuborildi (${steps[0]})`,
      });
      return {
        requestId,
        steps,
        testCode: code,
        resendSeconds: 60,
        attemptsLeft: 3,
        // Like the real API: the email code goes together with the phone.
        needsPhone: steps[0] === "email_code",
        codeLength: 6,
      };
    }),

  resendLoginCode: (requestId) =>
    withLatency(() => {
      const st = loginAttempts.get(requestId);
      if (!st) throw new ApiError("NOT_FOUND", "So'rov topilmadi yoki eskirgan.");
      st.code = genCode();
      return { testCode: st.code, resendSeconds: 60, codeLength: 6 };
    }),

  verifyLoginStep: (requestId, code, extra) =>
    withLatency<LoginStepResult>(() => {
      const st = loginAttempts.get(requestId);
      if (!st) throw new ApiError("NOT_FOUND", "So'rov topilmadi yoki eskirgan.");
      if (code !== st.code) {
        st.attemptsLeft -= 1;
        if (st.attemptsLeft <= 0) {
          loginAttempts.delete(requestId);
          throw new ApiError("AUTH_OTP_EXPIRED", "Urinishlar soni tugadi. Qaytadan kiring.");
        }
        throw new ApiError("AUTH_OTP_INVALID", `Kod noto'g'ri. ${st.attemptsLeft} urinish qoldi.`);
      }
      const user = getStaffMember(st.adminId)!;
      const step = st.steps[st.stepIndex];
      if (step === "email_code") {
        const digits = (v: string) => v.replace(/\D/g, "");
        if (!extra?.phone || digits(extra.phone) !== digits(user.phone))
          throw new ApiError("PHONE_MISMATCH", "Bu telefon raqami xodim hisobidagi raqamga mos emas.");
      }
      st.stepIndex += 1;
      if (st.stepIndex >= st.steps.length) {
        loginAttempts.delete(requestId);
        setSession({ adminId: user.id });
        upsertStaffMember({ ...user, lastLoginAt: Date.now() });
        addAuditEntry({
          actorId: user.id,
          actorName: user.name,
          action: "login_verified",
          targetType: "session",
          targetId: user.id,
          detail: st.steps.length > 1 ? "Kirdi: email + SMS" : "Kirdi: SMS",
        });
        return { done: true };
      }
      st.code = genCode();
      st.attemptsLeft = 3;
      return {
        done: false,
        requestId,
        step: st.steps[st.stepIndex],
        testCode: st.code,
        resendSeconds: 60,
        attemptsLeft: 3,
        codeLength: 6,
      };
    }),

  getReviewStatus: (id) =>
    withLatency<ReviewRequest>(() => {
      const existing = getReviewRequest(id);
      if (!existing) throw new ApiError("NOT_FOUND", "Tekshiruv so'rovi topilmadi");
      const req = resolveReview(existing);
      if (req.status === "approved" && !req.payload?.applied) {
        if (req.kind === "tariff_second_approve") {
          const proposalId = req.payload?.proposalId as string | undefined;
          const proposal = proposalId ? readTariffProposals().find((p) => p.id === proposalId) : undefined;
          if (proposal) {
            applyTariffProposal(proposal);
            saveTariffProposal({ ...proposal, status: "approved", resolvedAt: Date.now() });
            addAuditEntry({
              actorId: proposal.proposedById,
              actorName: proposal.proposedByName,
              action: "tariff_second_approve",
              targetType: "tariff",
              targetId: proposal.tariffId ?? "new",
              detail: `Tarif o'zgarishi ikkinchi admin tomonidan tasdiqlandi (so'rov: ${proposal.id})`,
            });
          }
        }
        if (req.kind === "wallet_adjust_second_approve") {
          const proposalId = req.payload?.proposalId as string | undefined;
          const proposal = proposalId ? readAdjustmentProposals().find((p) => p.id === proposalId) : undefined;
          if (proposal) {
            applyAdjustment(proposal);
            saveAdjustmentProposal({ ...proposal, status: "approved", resolvedAt: Date.now() });
            addAuditEntry({
              actorId: proposal.proposedById,
              actorName: proposal.proposedByName,
              action: "wallet_adjust_approve",
              targetType: "driver",
              targetId: proposal.driverId,
              detail: `Hamyon tuzatishi tasdiqlandi (so'rov: ${proposal.id})`,
            });
          }
        }
        req.payload = { ...req.payload, applied: true };
        saveReviewRequest(req);
      }
      return req;
    }),

  logout: () =>
    withLatency<void>(() => {
      const s = getSession();
      if (s) {
        const u = getStaffMember(s.adminId);
        addAuditEntry({
          actorId: s.adminId,
          actorName: u?.name ?? "Admin",
          action: "logout",
          targetType: "session",
          targetId: s.adminId,
          detail: "Chiqish amalga oshirildi",
        });
      }
      setSession(null);
    }),

  getMe: () =>
    withLatency<Me>(() => {
      const u = currentAdmin();
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        avatarSeed: u.avatarSeed,
        sections: ROLE_SECTIONS[u.role],
        actions: ROLE_ACTIONS[u.role],
        creatableRoles: CREATABLE_ROLES[u.role],
        landingPath: ROLE_LANDING[u.role],
      };
    }),

  isAuthenticated: () => !!getSession(),

  loginAsRole: (role) =>
    withLatency<void>(() => {
      const user = readStaff().find((u) => u.role === role && !u.archived && u.status === "active");
      if (!user) throw new ApiError("NOT_FOUND", "Bu rol uchun faol xodim topilmadi.");
      setSession({ adminId: user.id });
      upsertStaffMember({ ...user, lastLoginAt: Date.now() });
      addAuditEntry({
        actorId: user.id,
        actorName: user.name,
        action: "login_verified",
        targetType: "session",
        targetId: user.id,
        detail: "Sinov: rol sifatida kirish",
      });
    }),

  getDashboard: (period) =>
    withLatency<Dashboard>(() => {
      const actor = currentAdmin();
      requireSection(actor, "stats");
      const sections = ROLE_SECTIONS[actor.role];
      const t = mockToday();
      const span = period === "today" ? 1 : period === "7d" ? 7 : 30;
      const cur: [number, number] = [t - (span - 1) * DAY_MS, Infinity];
      const prev: [number, number] = [cur[0] - span * DAY_MS, cur[0]];
      const orders = db.orders();
      const drivers = db.drivers();
      const inR = (ts: number, r: [number, number]) => ts >= r[0] && ts < r[1];
      const ordersIn = (r: [number, number]) => orders.filter((o) => inR(o.createdAt, r));
      const activeIn = (r: [number, number]) => new Set(ordersIn(r).map((o) => o.driverId).filter(Boolean)).size;
      const newPaxIn = (r: [number, number]) => db.passengers().filter((p) => inR(p.joinedAt, r)).length;
      const commissionIn = (r: [number, number]) => ordersIn(r).reduce((s, o) => s + (o.commission ?? 0), 0);
      const days7 = Array.from({ length: 7 }, (_, i): [number, number] => [t - (6 - i) * DAY_MS, t - (5 - i) * DAY_MS]);
      days7[6] = [t, Infinity];
      const kpi = (f: (r: [number, number]) => number) => ({
        value: f(cur),
        deltaPct: pctDelta(f(cur), f(prev)),
        spark: days7.map(f),
      });
      const routeCount = new Map<string, { from: string; to: string; count: number }>();
      const cities = db.cities();
      for (const o of ordersIn(cur)) {
        const from = cities.find((c) => c.id === o.fromCityId)?.name ?? o.fromCityId;
        const to = cities.find((c) => c.id === o.toCityId)?.name ?? o.toCityId;
        const key = `${from}|${to}`;
        const r = routeCount.get(key) ?? { from, to, count: 0 };
        r.count += 1;
        routeCount.set(key, r);
      }
      const attention: AttentionItem[] = [];
      if (sections.includes("operators")) {
        const waiting = readQueue().filter((q) => q.status === "waiting");
        if (waiting.length) {
          const oldest = Math.min(...waiting.map((q) => q.waitingSinceAt));
          attention.push({
            id: "queue",
            tone: "warning",
            title: `Operator navbatida ${waiting.length} ta`,
            detail: `Eng eskisi ${Math.max(1, Math.round((Date.now() - oldest) / 60_000))} daqiqa oldin`,
            section: "operators",
          });
        }
      }
      const overLimit = drivers.filter((d) => !d.archived && d.atDebtLimit).length;
      if (overLimit && (sections.includes("wallet") || sections.includes("drivers"))) {
        attention.push({
          id: "debt",
          tone: "danger",
          title: `${overLimit} haydovchi qarz chegarasida`,
          detail: "Yangi so'rovlar ular uchun to'xtatilgan",
          section: sections.includes("wallet") ? "wallet" : "drivers",
        });
      }
      if (sections.includes("complaints")) {
        const open = db.complaints().filter((c) => c.status === "open").length;
        if (open) attention.push({ id: "complaints", tone: "info", title: `${open} ta ochiq shikoyat`, detail: "Ko'rib chiqilmagan", section: "complaints" });
      }
      return {
        period,
        orders: kpi((r) => ordersIn(r).length),
        activeDrivers: kpi(activeIn),
        newPassengers: kpi(newPaxIn),
        commission: kpi(commissionIn),
        ordersByDay: Array.from({ length: 14 }, (_, i) => {
          const start = t - (13 - i) * DAY_MS;
          const day = ordersIn([start, i === 13 ? Infinity : start + DAY_MS]);
          const passenger = day.filter((o) => o.kind === "passenger").length;
          return { date: start, total: day.length, passenger, delivery: day.length - passenger };
        }),
        topRoutes: [...routeCount.values()].sort((a, b) => b.count - a.count).slice(0, 5),
        recentOrders: sections.includes("orders") ? orders.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 4).map(decorateOrder) : null,
        attention,
      };
    }),

  getStats: (period) =>
    withLatency<MarketingStats>(() => {
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const dayMs = 86_400_000;
      const refNow = db.generatedAt();
      const since = refNow - days * dayMs;
      const drivers = db.drivers();
      const passengers = db.passengers();
      const orders = db.orders();
      const cities = db.cities();
      const tariff = db.tariffs().find((t) => !t.archived) ?? db.tariffs()[0];

      const periodOrders = orders.filter((o) => o.createdAt >= since);
      const completedPeriodOrders = periodOrders.filter((o) => o.status === "completed");

      const statusCounts = new Map<Order["status"], number>();
      for (const o of periodOrders) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
      const ordersByStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }));

      const routeCounts = new Map<string, number>();
      const routeIncome = new Map<string, number>();
      for (const o of periodOrders) {
        const key = `${o.fromCityId}__${o.toCityId}`;
        routeCounts.set(key, (routeCounts.get(key) ?? 0) + 1);
        if (o.status === "completed") routeIncome.set(key, (routeIncome.get(key) ?? 0) + o.price);
      }
      const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? id;
      const ordersByRoute = Array.from(routeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([key, count]) => {
          const [f, t] = key.split("__");
          return { from: cityName(f), to: cityName(t), count };
        });
      const incomeByRoute = Array.from(routeIncome.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([key, income]) => {
          const [f, t] = key.split("__");
          return { from: cityName(f), to: cityName(t), income };
        });

      const cityIncome = new Map<string, number>();
      for (const o of completedPeriodOrders) cityIncome.set(o.fromCityId, (cityIncome.get(o.fromCityId) ?? 0) + o.price);
      const incomeByCity = Array.from(cityIncome.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cityId, income]) => ({ city: cityName(cityId), income }));

      const bucketCount = Math.min(days, 14);
      const step = Math.max(1, Math.floor(days / bucketCount));
      const registrations = Array.from({ length: bucketCount }, (_, i) => {
        const dayStart = refNow - (bucketCount - 1 - i) * step * dayMs;
        const d = new Date(dayStart);
        const dayKey = d.toDateString();
        return {
          date: formatDayShort(d),
          passengers: passengers.filter((p) => new Date(p.joinedAt).toDateString() === dayKey).length,
          drivers: drivers.filter((x) => new Date(x.joinedAt).toDateString() === dayKey).length,
        };
      });
      const incomeOverTime = Array.from({ length: bucketCount }, (_, i) => {
        const dayStart = refNow - (bucketCount - 1 - i) * step * dayMs;
        const d = new Date(dayStart);
        const dayKey = d.toDateString();
        const income = orders
          .filter((o) => o.status === "completed" && new Date(o.createdAt).toDateString() === dayKey)
          .reduce((s, o) => s + o.price, 0);
        return { date: formatDayShort(d), income };
      });

      const totalIncome = completedPeriodOrders.reduce((s, o) => s + o.price, 0);
      const totalCommission = Math.round(totalIncome * (tariff.commissionPct / 100));
      const averageOrderValue = completedPeriodOrders.length ? Math.round(totalIncome / completedPeriodOrders.length) : 0;
      const walletTotalBalance = drivers.reduce((s, d) => s + d.walletBalance, 0);

      return {
        period,
        passengersTotal: passengers.length,
        passengersNew: passengers.filter((p) => p.joinedAt >= since).length,
        driversTotal: drivers.length,
        driversActive: drivers.filter((d) => d.status === "active" && !d.archived).length,
        driversBlocked: drivers.filter((d) => d.status === "blocked").length,
        driversNew: drivers.filter((d) => d.joinedAt >= since).length,
        ordersByStatus,
        ordersByRoute,
        registrations,
        totalIncome,
        totalCommission,
        averageOrderValue,
        walletTotalBalance,
        incomeOverTime,
        incomeByRoute,
        incomeByCity,
      };
    }),

  getCities: () => withLatency(() => db.cities()),

  globalSearch: (query) =>
    withLatency<GlobalSearchHit[]>(() => {
      const actor = currentAdmin();
      const q = query.trim();
      if (q.length < 2) return [];
      const sections = ROLE_SECTIONS[actor.role];
      const hits: GlobalSearchHit[] = [];
      if (sections.includes("orders")) {
        for (const o of db.orders().map(decorateOrder)) {
          if (matchesSearch(`${o.id} ${o.passengerName} ${o.driverName ?? ""}`, q))
            hits.push({ kind: "order", id: o.id, title: `#${o.id}`, subtitle: `${o.fromCityName} → ${o.toCityName} · ${o.passengerName}` });
        }
      }
      if (sections.includes("drivers")) {
        for (const d of db.drivers()) {
          if (matchesSearch(`${d.id} ${d.name} ${d.plate} ${d.phone}`, q))
            hits.push({ kind: "driver", id: d.id, title: d.name, subtitle: `${d.phone} · ${d.plate}` });
        }
      }
      if (sections.includes("passengers")) {
        for (const p of db.passengers()) {
          if (matchesSearch(`${p.id} ${p.name} ${p.phone}`, q)) hits.push({ kind: "passenger", id: p.id, title: p.name, subtitle: p.phone });
        }
      }
      if (sections.includes("staff")) {
        for (const u of readStaff()) {
          if (!u.archived && matchesSearch(`${u.name} ${u.email}`, q)) hits.push({ kind: "staff", id: u.id, title: u.name, subtitle: u.email || u.role });
        }
      }
      return hits.slice(0, 12);
    }),

  getSectionBadges: () =>
    withLatency<SectionBadges>(() => {
      const actor = currentAdmin();
      const badges: SectionBadges = {};
      if (ROLE_SECTIONS[actor.role].includes("complaints")) {
        const openCount = db.complaints().filter((c) => c.status === "open").length;
        if (openCount) badges.complaints = openCount;
      }
      if (ROLE_SECTIONS[actor.role].includes("operators")) {
        const waitingCount = readQueue().filter((q) => q.status === "waiting").length;
        if (waitingCount) badges.operators = waitingCount;
      }
      return badges;
    }),

  getStaff: (query: StaffQuery) =>
    withLatency<StaffRow[]>(() => {
      const actor = currentAdmin();
      let rows = filterByArchivableStatus(readStaff(), query.status);
      if (query.role && query.role !== "all") rows = rows.filter((u) => u.role === query.role);
      if (query.search) rows = rows.filter((u) => matchesSearch(`${u.name} ${u.email} ${u.phone}`, query.search));
      return rows.map((u) => ({ ...u, canEdit: u.id !== actor.id && canCreateRole(actor.role, u.role) }));
    }),

  createStaff: (input) =>
    withLatency<AdminUser>(() => {
      const actor = currentAdmin();
      assertCanActOnRole(actor, input.role);
      assertContactInfo(input.role, input.phone, input.email);
      const id = `adm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const user: AdminUser = {
        id,
        name: input.name,
        email: input.email.trim(),
        phone: input.phone,
        role: input.role,
        status: "active",
        archived: false,
        avatarSeed: id,
        createdByAdminId: actor.id,
        createdAt: Date.now(),
      };
      upsertStaffMember(user);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "staff_create",
        targetType: "staff",
        targetId: id,
        detail: `${user.name} (${user.role}) qo'shildi`,
      });
      return user;
    }),

  updateStaff: (id, patch) =>
    withLatency<AdminUser>(() => {
      const actor = currentAdmin();
      const target = getStaffMember(id);
      if (!target) throw new ApiError("NOT_FOUND", "Xodim topilmadi");
      if (id === actor.id && patch.role) throw new ApiError("FORBIDDEN", "O'z rolingizni o'zgartira olmaysiz.");
      assertCanActOnRole(actor, target.role);
      if (patch.role) assertCanActOnRole(actor, patch.role);
      const updated: AdminUser = { ...target, ...patch };
      assertContactInfo(updated.role, updated.phone, updated.email);
      upsertStaffMember(updated);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "staff_edit",
        targetType: "staff",
        targetId: id,
        detail: `${updated.name} tahrirlandi`,
      });
      return updated;
    }),

  setStaffStatus: (id, status) =>
    withLatency<AdminUser>(() => {
      const actor = currentAdmin();
      const target = getStaffMember(id);
      if (!target) throw new ApiError("NOT_FOUND", "Xodim topilmadi");
      if (id === actor.id) throw new ApiError("FORBIDDEN", "O'zingizni bloklay olmaysiz.");
      assertCanActOnRole(actor, target.role);
      const updated: AdminUser = { ...target, status };
      upsertStaffMember(updated);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: status === "blocked" ? "staff_block" : "staff_unblock",
        targetType: "staff",
        targetId: id,
        detail: `${target.name}: ${status === "blocked" ? "bloklandi" : "blokdan chiqarildi"}`,
      });
      return updated;
    }),

  archiveStaff: (id) =>
    withLatency<AdminUser>(() => {
      const actor = currentAdmin();
      const target = getStaffMember(id);
      if (!target) throw new ApiError("NOT_FOUND", "Xodim topilmadi");
      if (id === actor.id) throw new ApiError("FORBIDDEN", "O'zingizni arxivlay olmaysiz.");
      assertCanActOnRole(actor, target.role);
      const updated: AdminUser = { ...target, archived: true };
      upsertStaffMember(updated);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "staff_archive",
        targetType: "staff",
        targetId: id,
        detail: `${target.name} arxivlandi`,
      });
      return updated;
    }),

  restoreStaff: (id) =>
    withLatency<AdminUser>(() => {
      const actor = currentAdmin();
      const target = getStaffMember(id);
      if (!target) throw new ApiError("NOT_FOUND", "Xodim topilmadi");
      assertCanActOnRole(actor, target.role);
      const updated: AdminUser = { ...target, archived: false };
      upsertStaffMember(updated);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "staff_restore",
        targetType: "staff",
        targetId: id,
        detail: `${target.name} tiklandi`,
      });
      return updated;
    }),

  getDrivers: (query: DriverQuery) =>
    withLatency<Driver[]>(() => filterByArchivableStatus(driversMatching(query), query.status)),

  getDriverCounts: (query) =>
    withLatency(() => {
      const rows = driversMatching(query);
      const c = countBy(rows, (d) => (d.archived ? "archived" : d.status)) as ListCounts<Driver["status"] | "archived">;
      // "all" = every non-archived driver, like the list's "all" filter.
      return { ...c, all: rows.filter((d) => !d.archived).length };
    }),

  getDriverRoutes: () =>
    withLatency(() => [...new Set(db.drivers().map((d) => d.route).filter((r): r is string => !!r))].sort()),

  getDriver: (id) =>
    withLatency<DriverProfile>(() => {
      currentAdmin();
      const d = db.getDriver(id);
      if (!d) throw new ApiError("DRIVER_NOT_FOUND", "Haydovchi topilmadi.");
      const recent = db
        .orders()
        .filter((o) => o.driverId === id)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 3)
        .map(tripRow);
      return { ...d, recentTrips: recent };
    }),

  getDriverTrips: (driverId, query) =>
    withLatency<DriverTrips>(() => {
      currentAdmin();
      const all = db.orders().filter((o) => o.driverId === driverId);
      const months = [...new Set(all.map((o) => monthKey(o.createdAt)))].sort().reverse();
      const month = query.month && months.includes(query.month) ? query.month : (months[0] ?? monthKey(mockToday()));
      const inMonth = all.filter((o) => monthKey(o.createdAt) === month).sort((a, b) => b.createdAt - a.createdAt);
      const kind = query.kind ?? "all";
      const rows = inMonth.filter((o) => (kind === "all" ? true : kind === "cancelled" ? o.status === "cancelled" : o.kind === kind));
      const done = inMonth.filter((o) => o.commission !== null);
      const priceSum = done.reduce((s, o) => s + o.price, 0);
      const commission = done.reduce((s, o) => s + (o.commission ?? 0), 0);
      const cancelled = inMonth.filter((o) => o.status === "cancelled").length;
      return {
        month,
        months,
        summary: {
          trips: inMonth.length,
          tripsTotal: all.length,
          income: done.reduce((s, o) => s + (o.driverPayout ?? 0), 0),
          commission,
          commissionAvgPct: priceSum ? Math.round((commission / priceSum) * 1000) / 10 : null,
          cancelled,
          cancelledPct: inMonth.length ? Math.round((cancelled / inMonth.length) * 100) : null,
        },
        counts: {
          all: inMonth.length,
          passenger: inMonth.filter((o) => o.kind === "passenger").length,
          delivery: inMonth.filter((o) => o.kind === "delivery").length,
          cancelled,
        },
        rows: rows.map(tripRow),
      };
    }),

  updateDriverProfile: (id, patch) =>
    withLatency<Driver>(() => {
      const actor = currentAdmin();
      db.updateDriver(id, patch);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "driver_edit",
        targetType: "driver",
        targetId: id,
        detail: "Profil tahrirlandi",
      });
      const d = db.getDriver(id);
      if (!d) throw new ApiError("NOT_FOUND", "Haydovchi topilmadi");
      return d;
    }),

  setDriverStatus: (id, status) =>
    withLatency<Driver>(() => {
      const actor = currentAdmin();
      db.updateDriver(id, { status });
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: status === "blocked" ? "driver_block" : "driver_unblock",
        targetType: "driver",
        targetId: id,
        detail: status === "blocked" ? "Haydovchi bloklandi" : "Haydovchi blokdan chiqarildi",
      });
      const d = db.getDriver(id);
      if (!d) throw new ApiError("NOT_FOUND", "Haydovchi topilmadi");
      return d;
    }),

  archiveDriver: (id) =>
    withLatency<Driver>(() => {
      const actor = currentAdmin();
      db.updateDriver(id, { archived: true });
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "driver_archive", targetType: "driver", targetId: id, detail: "Arxivlandi" });
      const d = db.getDriver(id);
      if (!d) throw new ApiError("NOT_FOUND", "Haydovchi topilmadi");
      return d;
    }),

  restoreDriver: (id) =>
    withLatency<Driver>(() => {
      const actor = currentAdmin();
      db.updateDriver(id, { archived: false });
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "driver_restore", targetType: "driver", targetId: id, detail: "Tiklandi" });
      const d = db.getDriver(id);
      if (!d) throw new ApiError("NOT_FOUND", "Haydovchi topilmadi");
      return d;
    }),

  getPassengers: (query: PassengerQuery) =>
    withLatency<Passenger[]>(() => filterByArchivableStatus(passengersMatching(query), query.status)),

  getPassengerCounts: (query) =>
    withLatency(() => {
      const rows = passengersMatching(query);
      const c = countBy(rows, (p) => (p.archived ? "archived" : p.status)) as ListCounts<Passenger["status"] | "archived">;
      return { ...c, all: rows.filter((p) => !p.archived).length };
    }),

  createPassenger: (input) =>
    withLatency<Passenger>(() => {
      const actor = currentAdmin();
      const id = `pax_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const passenger: Passenger = {
        id,
        name: input.name,
        phone: formatPhone(input.phone),
        rating: 5.0,
        totalTrips: 0,
        avatarSeed: id,
        cityId: input.cityId,
        status: "active",
        archived: false,
        joinedAt: Date.now(),
        lastTripAt: null,
        lastPayment: null,
      };
      db.addPassenger(passenger);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "passenger_create",
        targetType: "passenger",
        targetId: id,
        detail: `${passenger.name} qo'shildi`,
      });
      return passenger;
    }),

  updatePassenger: (id, patch) =>
    withLatency<Passenger>(() => {
      const actor = currentAdmin();
      db.updatePassenger(id, patch);
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "passenger_edit", targetType: "passenger", targetId: id, detail: "Profil tahrirlandi" });
      const p = db.getPassenger(id);
      if (!p) throw new ApiError("NOT_FOUND", "Yo'lovchi topilmadi");
      return p;
    }),

  setPassengerStatus: (id, status) =>
    withLatency<Passenger>(() => {
      const actor = currentAdmin();
      db.updatePassenger(id, { status });
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: status === "blocked" ? "passenger_block" : "passenger_unblock",
        targetType: "passenger",
        targetId: id,
        detail: status === "blocked" ? "Bloklandi" : "Blokdan chiqarildi",
      });
      const p = db.getPassenger(id);
      if (!p) throw new ApiError("NOT_FOUND", "Yo'lovchi topilmadi");
      return p;
    }),

  archivePassenger: (id) =>
    withLatency<Passenger>(() => {
      const actor = currentAdmin();
      db.updatePassenger(id, { archived: true });
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "passenger_archive", targetType: "passenger", targetId: id, detail: "Arxivlandi" });
      const p = db.getPassenger(id);
      if (!p) throw new ApiError("NOT_FOUND", "Yo'lovchi topilmadi");
      return p;
    }),

  restorePassenger: (id) =>
    withLatency<Passenger>(() => {
      const actor = currentAdmin();
      db.updatePassenger(id, { archived: false });
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "passenger_restore", targetType: "passenger", targetId: id, detail: "Tiklandi" });
      const p = db.getPassenger(id);
      if (!p) throw new ApiError("NOT_FOUND", "Yo'lovchi topilmadi");
      return p;
    }),

  getOrders: (query: OrderQuery) =>
    withLatency<OrderWithNames[]>(() => {
      let rows = ordersMatching(query);
      if (query.status && query.status !== "all") rows = rows.filter((o) => o.status === query.status);
      return rows.map(decorateOrder);
    }),

  getOrderCounts: (query) => withLatency(() => countBy(ordersMatching(query), (o) => o.status)),

  getOrder: (id) =>
    withLatency<OrderDetail>(() => {
      const actor = currentAdmin();
      requireSection(actor, "orders");
      const o = db.getOrder(id);
      if (!o) throw new ApiError("ORDER_NOT_FOUND", "Buyurtma topilmadi.");
      const decorated = decorateOrder(o);
      const driver = o.driverId ? db.getDriver(o.driverId) : undefined;
      const passenger = db.getPassenger(o.passengerId);
      return {
        ...decorated,
        passengerRating: passenger?.rating ?? null,
        driverRating: driver?.rating ?? null,
        driverCar: driver ? `${driver.carModel} · ${driver.plate}` : null,
        carClassLabel: o.kind === "passenger" ? "Standart" : null,
        steps: orderSteps(o, decorated.driverName),
        priceLines: orderPriceLines(o, driver),
        canEdit: o.status === "searching" || o.status === "accepted",
      };
    }),

  sendOrderToOperator: (id, note) =>
    withLatency<void>(() => {
      const actor = currentAdmin();
      requireSection(actor, "orders");
      const o = db.getOrder(id);
      if (!o) throw new ApiError("ORDER_NOT_FOUND", "Buyurtma topilmadi.");
      const passenger = db.getPassenger(o.passengerId);
      const item: QueueItem = {
        id: `q_${Date.now().toString(36)}`,
        phone: passenger?.phone ?? "—",
        reason: "info_needed",
        waitingSinceAt: Date.now(),
        status: "waiting",
      };
      saveQueue([...readQueue(), item]);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "order_to_operator",
        targetType: "order",
        targetId: id,
        detail: note.trim() ? `Operatorga yuborildi: ${note.trim()}` : "Operatorga yuborildi",
      });
    }),

  createOrderForPassenger: (input) =>
    withLatency<OrderWithNames>(() => {
      const actor = currentAdmin();
      const distanceKm = roadDistanceKm(input.fromCityId, input.toCityId);
      const tariff = db.tariffs().find((t) => !t.archived) ?? db.tariffs()[0];
      const price = computePrice(distanceKm, input.mode, input.seatIds, tariff);
      const onlineDrivers = db.drivers().filter((d) => d.online && d.status === "active" && !d.archived);
      const driver = onlineDrivers.length ? onlineDrivers[Math.floor(Math.random() * onlineDrivers.length)] : null;
      const order: Order = {
        id: `ord_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        passengerId: input.passengerId,
        driverId: driver?.id ?? null,
        fromCityId: input.fromCityId,
        toCityId: input.toCityId,
        distanceKm,
        mode: input.mode,
        seatIds: input.seatIds,
        price,
        paymentMethod: input.paymentMethod,
        status: driver ? "accepted" : "searching",
        createdAt: Date.now(),
        timeWindow: input.timeWindow,
        createdByAdminId: actor.id,
        kind: "passenger",
        bodySize: null,
        luggageCount: 0,
        pickupAddress: db.cities().find((c) => c.id === input.fromCityId)?.name ?? null,
        dropoffAddress: db.cities().find((c) => c.id === input.toCityId)?.name ?? null,
        durationMin: Math.round((distanceKm / 75) * 60),
        commission: null,
        driverPayout: null,
        cancelledBy: null,
      };
      db.addOrder(order);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "order_create",
        targetType: "order",
        targetId: order.id,
        detail: "Yo'lovchi nomidan buyurtma yaratildi",
      });
      return decorateOrder(order);
    }),

  updateOrderFields: (id, patch) =>
    withLatency<OrderWithNames>(() => {
      const actor = currentAdmin();
      // The sample orders only know seats, note and the HH:MM window.
      const { timeWindow, seatIds, note } = patch;
      const rest = { ...(seatIds !== undefined ? { seatIds } : {}), ...(note !== undefined ? { note } : {}) };
      db.updateOrder(id, { ...rest, timeWindow: timeWindow === null ? undefined : timeWindow });
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "order_edit", targetType: "order", targetId: id, detail: "Buyurtma tahrirlandi" });
      const o = db.getOrder(id);
      if (!o) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      return decorateOrder(o);
    }),

  cancelOrder: (id, reason) =>
    withLatency<OrderWithNames>(() => {
      const actor = currentAdmin();
      db.updateOrder(id, { status: "cancelled", cancelReason: reason, cancelledBy: "admin", commission: null, driverPayout: null });
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "order_cancel", targetType: "order", targetId: id, detail: `Bekor qilindi: ${reason}` });
      const o = db.getOrder(id);
      if (!o) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      return decorateOrder(o);
    }),

  getWalletLedger: (query: WalletQuery) =>
    withLatency<WalletLedgerRow[]>(() => {
      const drivers = db.drivers();
      let rows = [...db.walletEntries()].sort((a, b) => b.createdAt - a.createdAt);
      if (query.type && query.type !== "all") rows = rows.filter((e) => e.type === query.type);
      const decorated = rows.map((e) => ({ ...e, driverName: drivers.find((d) => d.id === e.driverId)?.name ?? "—" }));
      if (!query.search) return decorated;
      return decorated.filter((e) => matchesSearch(e.driverName, query.search));
    }),

  getDriverWalletInfo: (driverId) =>
    withLatency(() => {
      const d = db.getDriver(driverId);
      if (!d) throw new ApiError("NOT_FOUND", "Haydovchi topilmadi");
      return { balance: d.walletBalance, debtLimit: d.debtLimit };
    }),

  proposeWalletAdjustment: (driverId, amount, reason) =>
    withLatency<AdjustmentProposal>(() => {
      const actor = currentAdmin();
      const proposal: AdjustmentProposal = {
        id: `adj_${Date.now().toString(36)}`,
        driverId,
        amount,
        reason,
        proposedById: actor.id,
        proposedByName: actor.name,
        status: "pending_second",
        createdAt: Date.now(),
      };
      saveAdjustmentProposal(proposal);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "wallet_adjust_propose",
        targetType: "driver",
        targetId: driverId,
        detail: `Tuzatish taklif qilindi: ${amount} (${reason})`,
      });
      return proposal;
    }),

  getAdjustmentProposals: (query: AdjustmentProposalQuery) =>
    withLatency(() => {
      const rows = readAdjustmentProposals();
      if (!query.status || query.status === "all") return rows;
      return rows.filter((p) => p.status === query.status);
    }),

  approveAdjustment: (proposalId) =>
    withLatency<ReviewRequest>(() => {
      const proposal = readAdjustmentProposals().find((p) => p.id === proposalId);
      if (!proposal) throw new ApiError("NOT_FOUND", "So'rov topilmadi");
      const now = Date.now();
      const delay = 2000 + Math.random() * 2000;
      const req: ReviewRequest = {
        id: `rev_${now}_${Math.random().toString(36).slice(2, 7)}`,
        kind: "wallet_adjust_second_approve",
        status: "pending",
        createdAt: now,
        resolvesAt: now + delay,
        payload: { proposalId },
      };
      saveReviewRequest(req);
      saveAdjustmentProposal({ ...proposal, reviewRequestId: req.id });
      return req;
    }),

  rejectAdjustment: (proposalId) =>
    withLatency<AdjustmentProposal>(() => {
      const actor = currentAdmin();
      const proposal = readAdjustmentProposals().find((p) => p.id === proposalId);
      if (!proposal) throw new ApiError("NOT_FOUND", "So'rov topilmadi");
      const updated: AdjustmentProposal = { ...proposal, status: "rejected", resolvedAt: Date.now() };
      saveAdjustmentProposal(updated);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "wallet_adjust_reject",
        targetType: "wallet_adjustment",
        targetId: proposalId,
        detail: "Tuzatish rad etildi",
      });
      return updated;
    }),

  getTariffs: (query: TariffQuery) =>
    withLatency<Tariff[]>(() => {
      let rows = db.tariffs();
      if (query.status === "active") rows = rows.filter((t) => !t.archived);
      if (query.status === "archived") rows = rows.filter((t) => t.archived);
      if (query.search) rows = rows.filter((t) => matchesSearch(t.name, query.search));
      return rows;
    }),
  getTariffProposals: (query: TariffProposalQuery) =>
    withLatency(() => {
      const rows = readTariffProposals();
      if (!query.status || query.status === "all") return rows;
      return rows.filter((p) => p.status === query.status);
    }),

  proposeTariffCreate: (input) =>
    withLatency<TariffProposal>(() => {
      const actor = currentAdmin();
      const proposal: TariffProposal = {
        id: `tpf_${Date.now().toString(36)}`,
        type: "create",
        patch: input,
        proposedById: actor.id,
        proposedByName: actor.name,
        status: "pending_second",
        createdAt: Date.now(),
      };
      saveTariffProposal(proposal);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "tariff_propose",
        targetType: "tariff",
        targetId: "new",
        detail: `Yangi tarif taklif qilindi: ${input.name}`,
      });
      return proposal;
    }),

  proposeTariffEdit: (tariffId, patch) =>
    withLatency<TariffProposal>(() => {
      const actor = currentAdmin();
      const proposal: TariffProposal = {
        id: `tpf_${Date.now().toString(36)}`,
        type: "edit",
        tariffId,
        patch,
        proposedById: actor.id,
        proposedByName: actor.name,
        status: "pending_second",
        createdAt: Date.now(),
      };
      saveTariffProposal(proposal);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "tariff_propose",
        targetType: "tariff",
        targetId: tariffId,
        detail: "Tarif o'zgarishi taklif qilindi",
      });
      return proposal;
    }),

  proposeTariffArchive: (tariffId) =>
    withLatency<TariffProposal>(() => {
      const actor = currentAdmin();
      const proposal: TariffProposal = {
        id: `tpf_${Date.now().toString(36)}`,
        type: "archive",
        tariffId,
        patch: {},
        proposedById: actor.id,
        proposedByName: actor.name,
        status: "pending_second",
        createdAt: Date.now(),
      };
      saveTariffProposal(proposal);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "tariff_propose",
        targetType: "tariff",
        targetId: tariffId,
        detail: "Tarifni arxivlash taklif qilindi",
      });
      return proposal;
    }),

  approveTariffProposal: (proposalId) =>
    withLatency<ReviewRequest>(() => {
      const proposal = readTariffProposals().find((p) => p.id === proposalId);
      if (!proposal) throw new ApiError("NOT_FOUND", "So'rov topilmadi");
      const now = Date.now();
      const delay = 2000 + Math.random() * 2000;
      const req: ReviewRequest = {
        id: `rev_${now}_${Math.random().toString(36).slice(2, 7)}`,
        kind: "tariff_second_approve",
        status: "pending",
        createdAt: now,
        resolvesAt: now + delay,
        payload: { proposalId },
      };
      saveReviewRequest(req);
      saveTariffProposal({ ...proposal, reviewRequestId: req.id });
      return req;
    }),

  rejectTariffProposal: (proposalId) =>
    withLatency<TariffProposal>(() => {
      const actor = currentAdmin();
      const proposal = readTariffProposals().find((p) => p.id === proposalId);
      if (!proposal) throw new ApiError("NOT_FOUND", "So'rov topilmadi");
      const updated: TariffProposal = { ...proposal, status: "rejected", resolvedAt: Date.now() };
      saveTariffProposal(updated);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "tariff_reject",
        targetType: "tariff_proposal",
        targetId: proposalId,
        detail: "Tarif o'zgarishi rad etildi",
      });
      return updated;
    }),

  getComplaints: (query: ComplaintQuery) =>
    withLatency<Complaint[]>(() => {
      let rows = db.complaints();
      if (query.status && query.status !== "all") rows = rows.filter((c) => c.status === query.status);
      if (query.category === "fraud") rows = rows.filter((c) => FRAUD_TYPES.includes(c.type));
      if (query.category === "service") rows = rows.filter((c) => !FRAUD_TYPES.includes(c.type));
      if (query.search) rows = rows.filter((c) => matchesSearch(c.description, query.search));
      return rows;
    }),

  getComplaint: (id) =>
    withLatency<Complaint>(() => {
      const c = db.complaints().find((x) => x.id === id);
      if (!c) throw new ApiError("NOT_FOUND", "Topilmadi");
      return c;
    }),

  assignComplaint: (id, toId) =>
    withLatency<Complaint>(() => {
      const actor = currentAdmin();
      const assignee = getStaffMember(toId);
      db.updateComplaint(id, { assignedToId: toId, assignedToName: assignee?.name ?? "—", status: "reviewing" });
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "complaint_assign",
        targetType: "complaint",
        targetId: id,
        detail: `${assignee?.name ?? toId}ga biriktirildi`,
      });
      const c = db.complaints().find((x) => x.id === id);
      if (!c) throw new ApiError("NOT_FOUND", "Topilmadi");
      return c;
    }),

  setComplaintStatus: (id, status) =>
    withLatency<Complaint>(() => {
      const actor = currentAdmin();
      db.updateComplaint(id, { status });
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: status === "resolved" || status === "dismissed" ? "complaint_close" : "complaint_status",
        targetType: "complaint",
        targetId: id,
        detail: `Holat: ${status}`,
      });
      const c = db.complaints().find((x) => x.id === id);
      if (!c) throw new ApiError("NOT_FOUND", "Topilmadi");
      return c;
    }),

  addComplaintNote: (id, text) =>
    withLatency<Complaint>(() => {
      const actor = currentAdmin();
      db.addComplaintNote(id, { id: `cn_${Date.now().toString(36)}`, text, authorId: actor.id, authorName: actor.name, createdAt: Date.now() });
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "complaint_note", targetType: "complaint", targetId: id, detail: "Izoh qo'shildi" });
      const c = db.complaints().find((x) => x.id === id);
      if (!c) throw new ApiError("NOT_FOUND", "Topilmadi");
      return c;
    }),

  getAuditLog: (query: AuditQuery) =>
    withLatency(() => {
      let rows = readAuditLog();
      if (query.action && query.action !== "all") rows = rows.filter((e) => e.action === query.action);
      if (query.dateFrom) rows = rows.filter((e) => e.createdAt >= dayStartMs(query.dateFrom!));
      if (query.dateTo) rows = rows.filter((e) => e.createdAt <= dayEndMs(query.dateTo!));
      if (query.search) rows = rows.filter((e) => matchesSearch(`${e.actorName} ${e.detail} ${e.targetType} ${e.targetId}`, query.search));
      return rows;
    }),


  getQueue: (query: OperatorQueueQuery) =>
    withLatency(() => {
      let rows = readQueue().filter((q) => q.status === "waiting");
      if (query.reason && query.reason !== "all") rows = rows.filter((q) => q.reason === query.reason);
      if (query.search) rows = rows.filter((q) => matchesSearch(q.phone, query.search));
      return rows.map(toQueueListItem);
    }),

  getActiveTask: () =>
    withLatency<ActiveTask | null>(() => {
      const actor = currentAdmin();
      return readQueue().find((q) => q.assignedOperatorId === actor.id && q.status === "in_progress") ?? null;
    }),

  startTask: (queueId) =>
    withLatency<ActiveTask>(() => {
      const actor = currentAdmin();
      requireAction(actor, "operatorWork");
      const list = readQueue();
      const alreadyActive = list.find((q) => q.assignedOperatorId === actor.id && q.status === "in_progress");
      if (alreadyActive) throw new ApiError("ACTIVE_TASK_EXISTS", "Sizda allaqachon faol vazifa bor.");
      const item = list.find((q) => q.id === queueId);
      if (!item || item.status !== "waiting") throw new ApiError("NOT_FOUND", "Vazifa topilmadi yoki band.");
      item.status = "in_progress";
      item.assignedOperatorId = actor.id;
      item.assignedOperatorName = actor.name;
      item.startedAt = Date.now();
      saveQueue(list);
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "operator_task_start", targetType: "queue", targetId: queueId, detail: "Vazifa boshlandi" });
      return item;
    }),

  rejectQueueItem: (queueId, reason) =>
    withLatency<QueueListItem>(() => {
      const actor = currentAdmin();
      requireAction(actor, "operatorWork");
      const list = readQueue();
      const item = list.find((q) => q.id === queueId);
      if (!item) throw new ApiError("NOT_FOUND", "Topilmadi");
      item.status = "rejected";
      saveQueue(list);
      const entry: HistoryEntry = {
        id: `h_${Date.now().toString(36)}`,
        queueItemId: item.id,
        operatorId: actor.id,
        operatorName: actor.name,
        phone: item.phone,
        reason: item.reason,
        result: "rejected",
        note: reason,
        rejectReason: reason,
        createdAt: item.waitingSinceAt,
        resolvedAt: Date.now(),
        edited: false,
      };
      const hist = readHistory();
      hist.unshift(entry);
      saveHistory(hist);
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "operator_task_result", targetType: "queue", targetId: queueId, detail: `Rad etildi: ${reason}` });
      return toQueueListItem(item);
    }),

  finishTask: (queueId, result, note, rejectReason) =>
    withLatency<HistoryEntry>(() => {
      const actor = currentAdmin();
      requireAction(actor, "operatorWork");
      if (result === "rejected" && !rejectReason) throw new ApiError("VALIDATION", "Rad etish sababini kiriting.");
      const list = readQueue();
      const item = list.find((q) => q.id === queueId);
      if (!item) throw new ApiError("NOT_FOUND", "Topilmadi");
      if (result === "callback") {
        item.status = "waiting";
        item.assignedOperatorId = undefined;
        item.assignedOperatorName = undefined;
        item.startedAt = undefined;
      } else {
        item.status = result === "rejected" ? "rejected" : "done";
      }
      saveQueue(list);
      const entry: HistoryEntry = {
        id: `h_${Date.now().toString(36)}`,
        queueItemId: item.id,
        operatorId: actor.id,
        operatorName: actor.name,
        phone: item.phone,
        reason: item.reason,
        result,
        note,
        rejectReason,
        createdAt: item.waitingSinceAt,
        resolvedAt: Date.now(),
        edited: false,
      };
      const hist = readHistory();
      hist.unshift(entry);
      saveHistory(hist);
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "operator_task_result", targetType: "queue", targetId: queueId, detail: `Natija: ${result}` });
      return entry;
    }),

  getOperatorsInProgress: (query: OperatorInProgressQuery) =>
    withLatency<QueueListItem[]>(() => {
      const actor = currentAdmin();
      requireAction(actor, "operatorSupervise");
      let rows = readQueue().filter((q) => q.status === "in_progress");
      if (query.search) rows = rows.filter((q) => matchesSearch(`${q.assignedOperatorName ?? ""} ${q.phone}`, query.search));
      return rows.map(toQueueListItem);
    }),

  getHistory: (query: OperatorApprovedQuery) =>
    withLatency<HistoryEntry[]>(() => {
      const actor = currentAdmin();
      let rows = readHistory();
      if (actor.role === "operator") {
        rows = rows.filter((h) => h.operatorId === actor.id);
      } else {
        requireAction(actor, "operatorSupervise");
        if (query.operatorId && query.operatorId !== "all") rows = rows.filter((h) => h.operatorId === query.operatorId);
      }
      if (query.result && query.result !== "all") rows = rows.filter((h) => h.result === query.result);
      if (query.dateFrom) rows = rows.filter((h) => h.resolvedAt >= dayStartMs(query.dateFrom!));
      if (query.dateTo) rows = rows.filter((h) => h.resolvedAt <= dayEndMs(query.dateTo!));
      if (query.search) rows = rows.filter((h) => matchesSearch(`${h.phone} ${h.note} ${h.operatorName}`, query.search));
      return rows;
    }),

  editHistoryEntry: (id, patch) =>
    withLatency<HistoryEntry>(() => {
      const actor = currentAdmin();
      requireAction(actor, "operatorWork");
      const all = readHistory();
      const entry = all.find((h) => h.id === id);
      if (!entry) throw new ApiError("NOT_FOUND", "Topilmadi");
      if (entry.operatorId !== actor.id) throw new ApiError("FORBIDDEN", "Faqat o'z tarixingizni tahrirlay olasiz.");
      Object.assign(entry, patch, { edited: true });
      saveHistory(all);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "operator_history_edit",
        targetType: "operator_history",
        targetId: id,
        detail: "Tarix yozuvi tahrirlandi",
      });
      return entry;
    }),

  getOperatorCounts: () =>
    withLatency<OperatorCounts>(() => {
      const all = readQueue();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const history = readHistory();
      return {
        queue: all.filter((q) => q.status === "waiting").length,
        inProgress: all.filter((q) => q.status === "in_progress").length,
        approvedToday: history.filter((h) => h.resolvedAt >= todayStart.getTime() && h.result === "resolved").length,
      };
    }),

  getOperatorsList: () =>
    withLatency(() => readStaff().filter((u) => u.role === "operator" && !u.archived).map((u) => ({ id: u.id, name: u.name }))),

  recordExport: (section) =>
    withLatency<void>(() => {
      const actor = currentAdmin();
      requireAction(actor, "export");
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "export", targetType: "section", targetId: section, detail: `${section} eksport qilindi` });
    }),
};

/** Picked by the `@active-adapter` alias when VITE_DEMO_MODE=true. */
export const adapter = mockAdapter;
