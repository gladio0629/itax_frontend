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
  getSession,
  getTariffSettingsRecord,
  saveTariffSettingsRecord,
  setSession,
  getQueue as readQueue,
  saveQueue,
  getHistory as readHistory,
  saveHistory,
  type AdminUser,
  type AdminRole,
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
  FuelKind,
  TariffCarClass,
  TariffExtraKey,
  TariffMarkup,
  TariffSettings,
  TariffSettingsPatch,
  LedgerSummary,
  WalletCorrectionResult,
  AuditCategory,
  OperatorMyStats,
  Marketing,
  Driver as ApiDriver,
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
  if (p === "90d") return [t - 89 * DAY_MS, Infinity];
  return [t - 29 * DAY_MS, Infinity];
}
const inBounds = (ts: number, b: [number, number] | null) => !b || (ts >= b[0] && ts < b[1]);

function requireSection(actor: AdminUser, section: Section) {
  if (!ROLE_SECTIONS[actor.role].includes(section)) throw new ApiError("FORBIDDEN", "Bu bo'lim uchun ruxsatingiz yo'q.");
}
function requireAnySection(actor: AdminUser, sections: Section[]) {
  if (!sections.some((x) => ROLE_SECTIONS[actor.role].includes(x))) throw new ApiError("FORBIDDEN", "Bu bo'lim uchun ruxsatingiz yo'q.");
}
/** The operator's read-only drivers window never receives balances. */
function driversFor(actor: AdminUser, rows: Driver[]): ApiDriver[] {
  return ROLE_SECTIONS[actor.role].includes("drivers") ? rows : rows.map((d) => ({ ...d, walletBalance: null }));
}

const AUDIT_CATEGORY: Partial<Record<string, AuditCategory>> = {
  wallet_correction: "money",
  tariff_update: "tariff",
  driver_block: "block",
  driver_unblock: "block",
  passenger_block: "block",
  passenger_unblock: "block",
  staff_block: "block",
  staff_unblock: "block",
  login_requested: "login",
  login_verified: "login",
  logout: "login",
  staff_create: "staff",
  staff_edit: "staff",
  staff_archive: "staff",
  staff_restore: "staff",
  driver_edit: "personal",
  passenger_edit: "personal",
  passenger_create: "personal",
  export: "personal",
};
/** Sample client address per staff member, shown the way the server would. */
const sampleIp = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${[185, 84, 213, 95][h % 4]}.${(h >>> 3) % 250}.•.•`;
};

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

// ---------------------------------------------------------------------
// v2 group 4: tariff settings view (the mock plays the server and computes
// the example prices from the stored inputs).
// ---------------------------------------------------------------------
const EXAMPLE_KM = 40;
const FUEL_LABEL: Record<FuelKind, string> = { gas: "Gaz (metan)", petrol: "Benzin AI-92" };
const FUEL_SHORT: Record<FuelKind, string> = { gas: "Gaz", petrol: "Benzin" };
const CLASS_LABEL: Record<TariffCarClass, string> = { economy: "Standart", comfort: "Komfort", business: "Biznes", minivan: "Miniven" };
const CLASS_SEATS: Record<TariffCarClass, number> = { economy: 4, comfort: 4, business: 4, minivan: 6 };
const EXTRA_META: Record<TariffExtraKey, { label: string; unit: "min" | "som" }> = {
  free_wait_min: { label: "Bepul kutish", unit: "min" },
  wait_per_min: { label: "Kutish, har daqiqa", unit: "som" },
  stop: { label: "Oraliq to'xtash", unit: "som" },
  loader: { label: "Yukchi, 1 kishi", unit: "som" },
  cancel_fee: { label: "Bekor qilish jarimasi", unit: "som" },
};
const TARIFF_SECTION_LABEL: Record<TariffSettingsPatch["section"], string> = {
  fuel: "yoqilg'i narxi",
  classes: "yo'lovchi klasslari",
  bodies: "dostavka kuzovlari",
  extras: "qo'shimcha to'lovlar",
  levels: "daraja komissiyalari",
};

function tariffSettingsView(cityId: string | null): TariffSettings {
  const rec = getTariffSettingsRecord(cityId ?? "all");
  const fuelPrice = (k: FuelKind) => rec.fuel.find((f) => f.kind === k)?.pricePerLitre ?? 0;
  const priced = (m: TariffMarkup) => {
    const base = EXAMPLE_KM * fuelPrice(m.fuel);
    const markup = m.markupKind === "percent" ? Math.round((base * m.markupValue) / 100) : m.markupValue;
    return { base, markup, total: base + markup };
  };
  const std = rec.classes[0];
  const stdPrice = std ? priced(std) : null;
  return {
    cityId,
    fuel: rec.fuel.map((f) => ({ kind: f.kind, label: FUEL_LABEL[f.kind], pricePerLitre: f.pricePerLitre, updatedAt: f.updatedAt })),
    classes: rec.classes.map((c) => ({ ...c, label: CLASS_LABEL[c.key], seats: CLASS_SEATS[c.key], examplePrice: priced(c).total })),
    bodies: rec.bodies.map((b) => ({ ...b, exampleBase: priced(b).base, examplePrice: priced(b).total })),
    extras: rec.extras.map((e) => ({ ...e, ...EXTRA_META[e.key] })),
    levels: rec.levels.map((l) => ({ ...l })),
    exampleDistanceKm: EXAMPLE_KM,
    example:
      std && stdPrice
        ? {
            title: `${CLASS_LABEL[std.key]}, ${EXAMPLE_KM} km`,
            distanceKm: EXAMPLE_KM,
            fuelLabel: `${FUEL_SHORT[std.fuel]}, 1 litr`,
            fuelPrice: fuelPrice(std.fuel),
            base: stdPrice.base,
            markupLabel: std.markupKind === "percent" ? `Ustama (${std.markupValue}%)` : "Ustama (summa)",
            markup: stdPrice.markup,
            total: stdPrice.total,
          }
        : null,
  };
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
  queueFilters: true,
  historyFilters: true,
  historyEdit: true,
  operatorCounts: true,
  sectionBadges: true,
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
  walletKinds: ["topup", "commission", "tip", "adjustment", "penalty", "cash", "card"],
  ledgerSummary: true,
  correctionEntryRef: true,
  tariffSettings: true,
  tariffCities: true,
  queuePostpone: true,
  operatorMyStats: true,
  operatorResults: ["resolved", "no_answer", "callback", "escalated", "rejected"],
  staffCounts: true,
  auditCategories: true,
  marketing: true,
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

  getMarketing: (period) =>
    withLatency<Marketing>(() => {
      requireSection(currentAdmin(), "marketing");
      const months = period === "3m" ? 3 : period === "12m" ? 12 : 6;
      const ref = new Date(db.generatedAt());
      const orders = db.orders();
      const monthStart = (back: number) => new Date(ref.getFullYear(), ref.getMonth() - back, 1).getTime();
      const inMonth = (ts: number, back: number) => ts >= monthStart(back) && ts < monthStart(back - 1);
      const ordersIn = (back: number) => orders.filter((o) => inMonth(o.createdAt, back));
      const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
      const kpi = (f: (back: number) => number) => ({
        value: f(0),
        deltaPct: pctDelta(f(0), f(1)),
        spark: Array.from({ length: 6 }, (_, i) => f(5 - i)),
      });
      const cur = ordersIn(0);
      const completed = cur.filter((o) => o.status === "completed");
      const passenger = cur.filter((o) => o.kind === "passenger").length;
      // Sample funnel: the mock has no app-open events, so the first two steps are scaled samples.
      const ordered = cur.length;
      return {
        period,
        monthlyOrders: kpi((b) => ordersIn(b).length),
        activePassengers: kpi((b) => new Set(ordersIn(b).map((o) => o.passengerId)).size),
        activeDrivers: kpi((b) => new Set(ordersIn(b).map((o) => o.driverId).filter(Boolean)).size),
        averageCheck: kpi((b) => {
          const list = ordersIn(b).filter((o) => o.status === "completed");
          return list.length ? Math.round(list.reduce((s2, o) => s2 + o.price, 0) / list.length) : 0;
        }),
        commissionByMonth: Array.from({ length: months }, (_, i) => {
          const back = months - 1 - i;
          const d = new Date(ref.getFullYear(), ref.getMonth() - back, 1);
          return { month: MONTHS_SHORT[d.getMonth()], value: ordersIn(back).reduce((s2, o) => s2 + (o.commission ?? 0), 0) };
        }),
        funnel: ordered
          ? {
              title: `${["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"][ref.getMonth()]}, yo'lovchi ilovasi`,
              steps: [
                { label: "Ilovani ochdi", count: ordered * 9, pct: 100 },
                { label: "Narxni ko'rdi", count: ordered * 6, pct: 67 },
                { label: "Buyurtma berdi", count: ordered, pct: Math.round((ordered / (ordered * 9)) * 100) },
                { label: "Safar tugadi", count: completed.length, pct: Math.round((completed.length / (ordered * 9)) * 100) },
              ],
            }
          : null,
        orderTypes: cur.length ? { passengerPct: Math.round((passenger / cur.length) * 100), deliveryPct: 100 - Math.round((passenger / cur.length) * 100) } : null,
      };
    }),

  getDashboard: (period) =>
    withLatency<Dashboard>(() => {
      const actor = currentAdmin();
      requireSection(actor, "stats");
      const sections = ROLE_SECTIONS[actor.role];
      const t = mockToday();
      const span = period === "today" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
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
      if (sections.includes("tariffs")) {
        const fuel = getTariffSettingsRecord("all").fuel;
        const oldest = fuel.reduce((m, f) => (f.updatedAt < m.updatedAt ? f : m), fuel[0]);
        const days = oldest ? Math.floor((Date.now() - oldest.updatedAt) / DAY_MS) : 0;
        if (oldest && days >= 2) {
          attention.push({
            id: "fuel",
            tone: "info",
            title: `${oldest.kind === "gas" ? "Gaz" : "Benzin"} narxi ${days} kundan beri yangilanmagan`,
            detail: "Tariflarda 1 litr narxini tekshiring",
            section: "tariffs",
          });
        }
      }
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
      requireAnySection(currentAdmin(), ["stats", "marketing"]);
      const days = period === "today" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
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
      return rows.map((u) => ({
        ...u,
        canEdit: u.id !== actor.id && canCreateRole(actor.role, u.role),
        loginMethod: u.email ? ("email_sms" as const) : ("sms" as const),
      }));
    }),

  getStaffCounts: (query) =>
    withLatency(() => {
      currentAdmin();
      let rows = filterByArchivableStatus(readStaff(), query.status);
      if (query.search) rows = rows.filter((u) => matchesSearch(`${u.name} ${u.email} ${u.phone}`, query.search));
      return countBy(rows, (u) => u.role) as ListCounts<AdminRole>;
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
    withLatency<ApiDriver[]>(() => {
      const actor = currentAdmin();
      requireAnySection(actor, ["drivers", "drivers_view"]);
      return driversFor(actor, filterByArchivableStatus(driversMatching(query), query.status));
    }),

  getDriverCounts: (query) =>
    withLatency(() => {
      requireAnySection(currentAdmin(), ["drivers", "drivers_view"]);
      const rows = driversMatching(query);
      const c = countBy(rows, (d) => (d.archived ? "archived" : d.status)) as ListCounts<Driver["status"] | "archived">;
      // "all" = every non-archived driver, like the list's "all" filter.
      return { ...c, all: rows.filter((d) => !d.archived).length };
    }),

  getDriverRoutes: () =>
    withLatency(() => [...new Set(db.drivers().map((d) => d.route).filter((r): r is string => !!r))].sort()),

  getDriver: (id) =>
    withLatency<DriverProfile>(() => {
      requireSection(currentAdmin(), "drivers");
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
      requireAnySection(currentAdmin(), ["orders", "orders_view"]);
      let rows = ordersMatching(query);
      if (query.status && query.status !== "all") rows = rows.filter((o) => o.status === query.status);
      return rows.map(decorateOrder);
    }),

  getOrderCounts: (query) =>
    withLatency(() => {
      requireAnySection(currentAdmin(), ["orders", "orders_view"]);
      return countBy(ordersMatching(query), (o) => o.status);
    }),

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
      const bounds = periodBounds(query.period);
      let rows = [...db.walletEntries()].sort((a, b) => b.createdAt - a.createdAt);
      if (query.driverId) rows = rows.filter((e) => e.driverId === query.driverId);
      if (query.type && query.type !== "all") rows = rows.filter((e) => e.type === query.type);
      rows = rows.filter((e) => inBounds(e.createdAt, bounds));
      const decorated = rows.map((e) => ({ ...e, driverName: drivers.find((d) => d.id === e.driverId)?.name ?? "—" }));
      if (!query.search) return decorated;
      return decorated.filter((e) => matchesSearch(`${e.id} ${e.driverName} ${e.note ?? ""}`, query.search));
    }),

  getDriverWalletInfo: (driverId) =>
    withLatency(() => {
      const d = db.getDriver(driverId);
      if (!d) throw new ApiError("NOT_FOUND", "Haydovchi topilmadi");
      return { balance: d.walletBalance, debtLimit: d.debtLimit };
    }),

  getLedgerSummary: () =>
    withLatency<LedgerSummary>(() => {
      const actor = currentAdmin();
      requireSection(actor, "wallet");
      const today = [mockToday(), Infinity] as [number, number];
      const todays = db.walletEntries().filter((e) => inBounds(e.createdAt, today));
      const topups = todays.filter((e) => e.type === "topup");
      const payme = topups.filter((e) => e.note?.startsWith("Payme")).reduce((s, e) => s + e.amount, 0);
      const topupSum = topups.reduce((s, e) => s + e.amount, 0);
      const commissions = todays.filter((e) => e.type === "commission");
      return {
        toppedUpToday: topupSum,
        topupSplit: topupSum ? `Payme ${Math.round((payme / topupSum) * 100)}% · Click ${100 - Math.round((payme / topupSum) * 100)}%` : null,
        commissionToday: -commissions.reduce((s, e) => s + e.amount, 0),
        commissionTrips: commissions.length,
        driversAtLimit: db.drivers().filter((d) => !d.archived && d.atDebtLimit).length,
        reconciliation: { matchPct: 100, at: mockToday() + 6 * 3600_000 },
      };
    }),

  createWalletCorrection: (input) =>
    withLatency<WalletCorrectionResult>(() => {
      const actor = currentAdmin();
      requireSection(actor, "wallet");
      const driver = db.getDriver(input.driverId);
      if (!driver) throw new ApiError("DRIVER_NOT_FOUND", "Haydovchi topilmadi.");
      const reason = input.reason.trim();
      if (!Number.isFinite(input.amount) || input.amount === 0) throw new ApiError("VALIDATION_ERROR", "Summa 0 bo'lmasin.");
      if (reason.length < 5 || reason.length > 500) throw new ApiError("VALIDATION_ERROR", "Sabab 5–500 belgi bo'lsin.");
      const ref = input.entryId ? db.walletEntries().find((e) => e.id === input.entryId && e.driverId === input.driverId) : undefined;
      if (input.entryId && !ref) throw new ApiError("NOT_FOUND", "Yozuv topilmadi.");
      const balanceAfter = driver.walletBalance + input.amount;
      const entry = {
        id: `wal_fix_${Date.now().toString(36)}`,
        driverId: driver.id,
        type: "adjustment" as const,
        amount: input.amount,
        reason,
        note: ref ? `${reason} (yozuv ${ref.id})` : reason,
        createdByAdminId: actor.id,
        createdByAdminName: actor.name,
        createdAt: Date.now(),
        balanceAfter,
      };
      db.addWalletEntry(entry);
      db.updateDriver(driver.id, { walletBalance: balanceAfter, atDebtLimit: balanceAfter <= driver.debtLimit });
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "wallet_correction",
        targetType: "wallet",
        targetId: entry.id,
        detail: `${driver.name}: ${input.amount > 0 ? "+" : ""}${input.amount} so'm. Sabab: ${reason}${ref ? `. Yozuv: ${ref.id}` : ""}`,
      });
      return { applied: true, entry: { ...entry, driverName: driver.name } };
    }),

  getTariffSettings: (cityId) =>
    withLatency<TariffSettings>(() => {
      const actor = currentAdmin();
      requireSection(actor, "tariffs");
      return tariffSettingsView(cityId);
    }),

  getTariffCities: () =>
    withLatency(() => db.cities().map((c) => ({ id: c.id, name: c.name }))),

  updateTariffSettings: (cityId, patch) =>
    withLatency<TariffSettings>(() => {
      const actor = currentAdmin();
      requireSection(actor, "tariffs");
      const key = cityId ?? "all";
      const rec = getTariffSettingsRecord(key);
      const before = JSON.stringify(rec[patch.section]);
      const nonNeg = (n: number) => Number.isFinite(n) && n >= 0;
      switch (patch.section) {
        case "fuel":
          for (const f of patch.fuel) {
            if (!nonNeg(f.pricePerLitre) || f.pricePerLitre === 0) throw new ApiError("VALIDATION_ERROR", "Yoqilg'i narxi 0 dan katta bo'lsin.");
            const cur = rec.fuel.find((x) => x.kind === f.kind);
            if (cur && cur.pricePerLitre !== f.pricePerLitre) Object.assign(cur, { pricePerLitre: f.pricePerLitre, updatedAt: Date.now() });
          }
          break;
        case "classes":
          for (const c of patch.classes) {
            if (!nonNeg(c.markupValue)) throw new ApiError("VALIDATION_ERROR", "Ustama manfiy bo'lmasin.");
            Object.assign(rec.classes.find((x) => x.key === c.key) ?? {}, c);
          }
          break;
        case "bodies":
          for (const b of patch.bodies) {
            if (!nonNeg(b.markupValue)) throw new ApiError("VALIDATION_ERROR", "Ustama manfiy bo'lmasin.");
            Object.assign(rec.bodies.find((x) => x.size === b.size) ?? {}, b);
          }
          break;
        case "extras":
          for (const e of patch.extras) {
            if (!nonNeg(e.value)) throw new ApiError("VALIDATION_ERROR", "Qiymat manfiy bo'lmasin.");
            Object.assign(rec.extras.find((x) => x.key === e.key) ?? {}, { value: e.value });
          }
          break;
        case "levels":
          for (const l of patch.levels) {
            if (!nonNeg(l.commissionPct) || l.commissionPct > 100) throw new ApiError("VALIDATION_ERROR", "Komissiya 0–100% oralig'ida bo'lsin.");
            Object.assign(rec.levels.find((x) => x.level === l.level) ?? {}, l);
          }
          break;
      }
      saveTariffSettingsRecord(key, rec);
      if (JSON.stringify(rec[patch.section]) !== before) {
        addAuditEntry({
          actorId: actor.id,
          actorName: actor.name,
          action: "tariff_update",
          targetType: "tariff",
          targetId: `${key}:${patch.section}`,
          detail: `Tarif o'zgartirildi (${TARIFF_SECTION_LABEL[patch.section]}${cityId ? `, ${db.cities().find((c) => c.id === cityId)?.name ?? cityId}` : ""})`,
        });
      }
      return tariffSettingsView(cityId);
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
      const staff = readStaff();
      let rows = readAuditLog().map((e) => ({
        ...e,
        actorRole: staff.find((u) => u.id === e.actorId)?.role ?? null,
        category: AUDIT_CATEGORY[e.action] ?? null,
        ip: sampleIp(e.actorId),
      }));
      if (query.category && query.category !== "all") rows = rows.filter((e) => e.category === query.category);
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
      if (result === "unresolved") throw new ApiError("VALIDATION", "Natijani tanlang.");
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
        subjectKind: item.subjectKind,
        subjectName: item.subjectName,
        requestText: item.requestText,
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

  postponeTask: (queueId) =>
    withLatency<QueueListItem>(() => {
      const actor = currentAdmin();
      requireAction(actor, "operatorWork");
      const list = readQueue();
      const item = list.find((q) => q.id === queueId && q.assignedOperatorId === actor.id && q.status === "in_progress");
      if (!item) throw new ApiError("NOT_FOUND", "Faol vazifa topilmadi.");
      // Back to the queue; the wait time (waitingSinceAt) is kept.
      item.status = "waiting";
      item.assignedOperatorId = undefined;
      item.assignedOperatorName = undefined;
      item.startedAt = undefined;
      saveQueue(list);
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "operator_task_result", targetType: "queue", targetId: queueId, detail: "Keyinga qoldirildi (navbatga qaytdi)" });
      return toQueueListItem(item);
    }),

  getOperatorMyStats: () =>
    withLatency<OperatorMyStats>(() => {
      const actor = currentAdmin();
      requireAction(actor, "operatorWork");
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const mine = readHistory().filter((h) => h.operatorId === actor.id && h.resolvedAt >= start.getTime());
      const durations = mine.map((h) => Math.max(0, (h.resolvedAt - h.createdAt) / 1000)).filter((x) => x > 0 && x < 3600);
      return {
        resolvedToday: mine.filter((h) => h.result === "resolved").length,
        noAnswerToday: mine.filter((h) => h.result === "no_answer").length,
        avgHandleSec: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      };
    }),

  getOperatorsInProgress: (query: OperatorInProgressQuery) =>
    withLatency<QueueListItem[]>(() => {
      const actor = currentAdmin();
      requireAction(actor, "operatorSupervise");
      let rows = readQueue().filter((q) => q.status === "in_progress");
      const qq = query as OperatorQueueQuery;
      if (qq.reason && qq.reason !== "all") rows = rows.filter((q) => q.reason === qq.reason);
      if (qq.operatorId && qq.operatorId !== "all") rows = rows.filter((q) => q.assignedOperatorId === qq.operatorId);
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
      if (query.reason && query.reason !== "all") rows = rows.filter((h) => h.reason === query.reason);
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

  getOperatorCounts: (query = {}) =>
    withLatency<OperatorCounts>(() => {
      const all = readQueue();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const byReason = (r: { reason: string }) => !query.reason || query.reason === "all" || r.reason === query.reason;
      const bySearch = (text: string) => !query.search || matchesSearch(text, query.search);
      const byOperator = (id?: string) => !query.operatorId || query.operatorId === "all" || id === query.operatorId;
      const from = query.dateFrom ? dayStartMs(query.dateFrom) : todayStart.getTime();
      const to = query.dateTo ? dayEndMs(query.dateTo) : Infinity;
      const history = readHistory().filter(
        (h) =>
          h.resolvedAt >= from &&
          h.resolvedAt <= to &&
          byReason(h) &&
          byOperator(h.operatorId) &&
          bySearch(`${h.phone} ${h.note} ${h.operatorName}`) &&
          (!query.result || query.result === "all" || h.result === query.result)
      );
      return {
        queue: all.filter((q) => q.status === "waiting" && byReason(q) && bySearch(q.phone)).length,
        inProgress: all.filter((q) => q.status === "in_progress" && byReason(q) && byOperator(q.assignedOperatorId) && bySearch(`${q.assignedOperatorName ?? ""} ${q.phone}`)).length,
        approvedToday: history.length,
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
