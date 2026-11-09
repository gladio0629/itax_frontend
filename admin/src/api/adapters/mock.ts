import { ApiError, withLatency } from "@/mockDb/latency";
import { roadDistanceKm, computePrice, type Order, type Tariff, type Driver, type Passenger, type Complaint } from "@/seed/generate";
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
import type { ApiAdapter } from "../adapterTypes";
import type {
  DashboardStats,
  MarketingStats,
  OrderWithNames,
  WalletLedgerRow,
  Me,
  LoginStartResult,
  LoginStepResult,
  LoginStep,
  QueueListItem,
  ActiveTask,
} from "../types";

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

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return user.length <= 2 ? `${user[0] ?? "*"}***@${domain}` : `${user.slice(0, 2)}***@${domain}`;
}

function maskPhone(full: string): string {
  const digits = full.replace(/\D/g, "");
  if (digits.length < 9) return full;
  const last2 = digits.slice(-2);
  const cc = digits.slice(0, digits.length - 9);
  const op = digits.slice(-9, -7);
  return `+${cc} ${op} *** ** ${last2}`;
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
  demoCode: string;
  attemptsLeft: number;
};
const loginAttempts = new Map<string, LoginAttemptState>();

function destinationFor(user: AdminUser, step: LoginStep): string {
  return step === "email_code" ? maskEmail(user.email) : maskPhone(user.phone);
}

function hashDigit(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 10;
}

// Demo-only: deterministically "unmasks" a phone number from its masked
// form + entity id, so the same record always reveals the same digits
// without ever having stored real PII.
function revealMaskedPhone(masked: string, seedKey: string): string {
  let i = 0;
  return masked.replace(/\*/g, () => {
    i++;
    return String(hashDigit(`${seedKey}_${i}`));
  });
}

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
    driverName: o.driverId ? drivers.find((d) => d.id === o.driverId)?.name ?? "—" : null,
    fromCityName: cities.find((c) => c.id === o.fromCityId)?.name ?? o.fromCityId,
    toCityName: cities.find((c) => c.id === o.toCityId)?.name ?? o.toCityId,
  };
}

function toQueueListItem(q: QueueItem): QueueListItem {
  const { phoneFull, ...rest } = q;
  void phoneFull;
  return rest;
}

export const mockAdapter: ApiAdapter = {
  requestLogin: (identifier) =>
    withLatency<LoginStartResult>(() => {
      const user = findStaffByEmailOrPhone(identifier);
      if (!user) throw new ApiError("NOT_FOUND", "Bunday foydalanuvchi topilmadi.");
      if (user.archived) throw new ApiError("ARCHIVED", "Hisob arxivlangan.");
      if (user.status === "blocked") throw new ApiError("BLOCKED", "Hisob bloklangan.");
      const steps: LoginStep[] = user.role === "operator" ? ["phone_code"] : ["email_code", "phone_code"];
      const requestId = `li_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const code = genCode();
      loginAttempts.set(requestId, { adminId: user.id, steps, stepIndex: 0, demoCode: code, attemptsLeft: 3 });
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
        maskedDestination: destinationFor(user, steps[0]),
        demoCode: code,
        resendSeconds: 30,
        attemptsLeft: 3,
      };
    }),

  resendLoginCode: (requestId) =>
    withLatency(() => {
      const st = loginAttempts.get(requestId);
      if (!st) throw new ApiError("NOT_FOUND", "So'rov topilmadi yoki eskirgan.");
      st.demoCode = genCode();
      return { demoCode: st.demoCode, resendSeconds: 30 };
    }),

  verifyLoginStep: (requestId, code) =>
    withLatency<LoginStepResult>(() => {
      const st = loginAttempts.get(requestId);
      if (!st) throw new ApiError("NOT_FOUND", "So'rov topilmadi yoki eskirgan.");
      if (code !== st.demoCode) {
        st.attemptsLeft -= 1;
        if (st.attemptsLeft <= 0) {
          loginAttempts.delete(requestId);
          throw new ApiError("TOO_MANY_ATTEMPTS", "Urinishlar soni tugadi. Qaytadan kiring.");
        }
        throw new ApiError("INVALID_CODE", `Kod noto'g'ri. ${st.attemptsLeft} urinish qoldi.`);
      }
      st.stepIndex += 1;
      if (st.stepIndex >= st.steps.length) {
        loginAttempts.delete(requestId);
        const now = Date.now();
        const delay = 2000 + Math.random() * 2000;
        const req: ReviewRequest = {
          id: `rev_${now}_${Math.random().toString(36).slice(2, 7)}`,
          kind: "login_2fa",
          status: "pending",
          createdAt: now,
          resolvesAt: now + delay,
          payload: { adminId: st.adminId },
        };
        saveReviewRequest(req);
        return { done: true, reviewId: req.id };
      }
      const user = getStaffMember(st.adminId)!;
      const nextStep = st.steps[st.stepIndex];
      st.demoCode = genCode();
      st.attemptsLeft = 3;
      return {
        done: false,
        requestId,
        step: nextStep,
        maskedDestination: destinationFor(user, nextStep),
        demoCode: st.demoCode,
        resendSeconds: 30,
        attemptsLeft: 3,
      };
    }),

  getReviewStatus: (id) =>
    withLatency<ReviewRequest>(() => {
      const existing = getReviewRequest(id);
      if (!existing) throw new ApiError("NOT_FOUND", "Tekshiruv so'rovi topilmadi");
      const req = resolveReview(existing);
      if (req.status === "approved" && !req.payload?.applied) {
        if (req.kind === "login_2fa") {
          const adminId = req.payload?.adminId as string;
          setSession({ adminId });
          const u = getStaffMember(adminId);
          if (u) upsertStaffMember({ ...u, lastLoginAt: Date.now() });
          addAuditEntry({
            actorId: adminId,
            actorName: u?.name ?? "Admin",
            action: "login_verified",
            targetType: "session",
            targetId: adminId,
            detail: "Kirish tasdiqlandi",
          });
        }
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
        detail: "Demo: rol sifatida kirish",
      });
    }),

  getDashboardStats: () =>
    withLatency<DashboardStats>(() => {
      const drivers = db.drivers();
      const passengers = db.passengers();
      const orders = db.orders();
      const complaints = db.complaints();
      const dayMs = 86_400_000;
      const refNow = db.generatedAt();
      const todayKey = new Date(refNow).toDateString();
      const weekStart = refNow - 7 * dayMs;

      const ordersToday = orders.filter((o) => new Date(o.createdAt).toDateString() === todayKey);
      const completedToday = ordersToday.filter((o) => o.status === "completed");
      const revenueToday = completedToday.reduce((sum, o) => sum + o.price, 0);

      const weekOrders = orders.filter((o) => o.createdAt >= weekStart && o.status === "completed");
      const revenueWeek = weekOrders.reduce((sum, o) => sum + o.price, 0);

      const weekPoints = Array.from({ length: 7 }, (_, i) => {
        const dayStart = refNow - (6 - i) * dayMs;
        const d = new Date(dayStart);
        const dayKey = d.toDateString();
        const dayCompleted = orders.filter((o) => o.status === "completed" && new Date(o.createdAt).toDateString() === dayKey);
        return {
          date: d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" }),
          revenue: dayCompleted.reduce((sum, o) => sum + o.price, 0),
          orders: dayCompleted.length,
        };
      });

      return {
        driversOnline: drivers.filter((d) => d.online).length,
        driversTotal: drivers.length,
        passengersTotal: passengers.length,
        ordersToday: ordersToday.length,
        completedToday: completedToday.length,
        revenueToday,
        revenueWeek,
        weekPoints,
        openComplaints: complaints.filter((c) => c.status === "open").length,
        flaggedComplaints: complaints.filter(
          (c) => ["suspicious_gps", "repeated_pair", "otp_abuse", "referral_abuse"].includes(c.type) && c.status !== "dismissed"
        ).length,
      };
    }),

  getMarketingStats: (period) =>
    withLatency<MarketingStats>(() => {
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const dayMs = 86_400_000;
      const refNow = db.generatedAt();
      const since = refNow - days * dayMs;
      const drivers = db.drivers();
      const passengers = db.passengers();
      const orders = db.orders();
      const cities = db.cities();

      const statusCounts = new Map<Order["status"], number>();
      for (const o of orders) if (o.createdAt >= since) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
      const ordersByStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }));

      const routeCounts = new Map<string, number>();
      for (const o of orders) {
        if (o.createdAt < since) continue;
        const key = `${o.fromCityId}__${o.toCityId}`;
        routeCounts.set(key, (routeCounts.get(key) ?? 0) + 1);
      }
      const ordersByRoute = Array.from(routeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([key, count]) => {
          const [f, t] = key.split("__");
          return { from: cities.find((c) => c.id === f)?.name ?? f, to: cities.find((c) => c.id === t)?.name ?? t, count };
        });

      const bucketCount = Math.min(days, 14);
      const step = Math.max(1, Math.floor(days / bucketCount));
      const registrations = Array.from({ length: bucketCount }, (_, i) => {
        const dayStart = refNow - (bucketCount - 1 - i) * step * dayMs;
        const d = new Date(dayStart);
        const dayKey = d.toDateString();
        return {
          date: d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" }),
          passengers: passengers.filter((p) => new Date(p.joinedAt).toDateString() === dayKey).length,
          drivers: drivers.filter((x) => new Date(x.joinedAt).toDateString() === dayKey).length,
        };
      });

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
      };
    }),

  getCities: () => withLatency(() => db.cities()),

  getStaff: () => withLatency(() => readStaff()),

  createStaff: (input) =>
    withLatency<AdminUser>(() => {
      const actor = currentAdmin();
      assertCanActOnRole(actor, input.role);
      const id = `adm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const user: AdminUser = {
        id,
        name: input.name,
        email: input.email,
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

  getDrivers: () => withLatency(() => db.drivers()),

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

  getPassengers: () => withLatency(() => db.passengers()),

  createPassenger: (input) =>
    withLatency<Passenger>(() => {
      const actor = currentAdmin();
      const id = `pax_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const passenger: Passenger = {
        id,
        name: input.name,
        phoneMasked: maskPhone(input.phone),
        rating: 5.0,
        totalTrips: 0,
        avatarSeed: id,
        cityId: input.cityId,
        status: "active",
        archived: false,
        joinedAt: Date.now(),
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

  getOrders: () => withLatency<OrderWithNames[]>(() => db.orders().map(decorateOrder)),

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
        createdByAdminId: actor.id,
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
      db.updateOrder(id, patch);
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "order_edit", targetType: "order", targetId: id, detail: "Buyurtma tahrirlandi" });
      const o = db.getOrder(id);
      if (!o) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      return decorateOrder(o);
    }),

  cancelOrder: (id, reason) =>
    withLatency<OrderWithNames>(() => {
      const actor = currentAdmin();
      db.updateOrder(id, { status: "cancelled", cancelReason: reason });
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "order_cancel", targetType: "order", targetId: id, detail: `Bekor qilindi: ${reason}` });
      const o = db.getOrder(id);
      if (!o) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      return decorateOrder(o);
    }),

  getWalletLedger: () =>
    withLatency<WalletLedgerRow[]>(() => {
      const drivers = db.drivers();
      return [...db.walletEntries()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((e) => ({ ...e, driverName: drivers.find((d) => d.id === e.driverId)?.name ?? "—" }));
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

  getAdjustmentProposals: () => withLatency(() => readAdjustmentProposals()),

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

  getTariffs: () => withLatency(() => db.tariffs()),
  getTariffProposals: () => withLatency(() => readTariffProposals()),

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

  getComplaints: () => withLatency(() => db.complaints()),

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

  getAuditLog: () => withLatency(() => readAuditLog()),

  revealPhone: (entityType, entityId) =>
    withLatency(() => {
      const actor = currentAdmin();
      const masked = entityType === "driver" ? db.getDriver(entityId)?.phoneMasked : db.passengers().find((p) => p.id === entityId)?.phoneMasked;
      if (!masked) throw new ApiError("NOT_FOUND", "Topilmadi");
      const phone = revealMaskedPhone(masked, entityId);
      addAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        action: "phone_reveal",
        targetType: entityType,
        targetId: entityId,
        detail: `Telefon raqami ko'rsatildi: ${phone}`,
      });
      return { phone };
    }),

  getQueue: () => withLatency(() => readQueue().filter((q) => q.status === "waiting").map(toQueueListItem)),

  getActiveTask: () =>
    withLatency<ActiveTask | null>(() => {
      const actor = currentAdmin();
      return readQueue().find((q) => q.assignedOperatorId === actor.id && q.status === "in_progress") ?? null;
    }),

  startTask: (queueId) =>
    withLatency<ActiveTask>(() => {
      const actor = currentAdmin();
      const list = readQueue();
      const alreadyActive = list.find((q) => q.assignedOperatorId === actor.id && q.status === "in_progress");
      if (alreadyActive) throw new ApiError("ACTIVE_TASK_EXISTS", "Sizda allaqachon faol vazifa bor.");
      const item = list.find((q) => q.id === queueId);
      if (!item || item.status !== "waiting") throw new ApiError("NOT_FOUND", "Vazifa topilmadi yoki band.");
      item.status = "in_progress";
      item.assignedOperatorId = actor.id;
      saveQueue(list);
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "operator_task_start", targetType: "queue", targetId: queueId, detail: "Vazifa boshlandi" });
      return item;
    }),

  rejectQueueItem: (queueId, reason) =>
    withLatency<QueueListItem>(() => {
      const actor = currentAdmin();
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
        phoneMasked: item.phoneMasked,
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
      if (result === "rejected" && !rejectReason) throw new ApiError("VALIDATION", "Rad etish sababini kiriting.");
      const list = readQueue();
      const item = list.find((q) => q.id === queueId);
      if (!item) throw new ApiError("NOT_FOUND", "Topilmadi");
      if (result === "callback") {
        item.status = "waiting";
        item.assignedOperatorId = undefined;
      } else {
        item.status = result === "rejected" ? "rejected" : "done";
      }
      saveQueue(list);
      const entry: HistoryEntry = {
        id: `h_${Date.now().toString(36)}`,
        queueItemId: item.id,
        operatorId: actor.id,
        operatorName: actor.name,
        phoneMasked: item.phoneMasked,
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

  getHistory: () =>
    withLatency(() => {
      const actor = currentAdmin();
      const all = readHistory();
      return actor.role === "operator" ? all.filter((h) => h.operatorId === actor.id) : all;
    }),

  editHistoryEntry: (id, patch) =>
    withLatency<HistoryEntry>(() => {
      const actor = currentAdmin();
      const all = readHistory();
      const entry = all.find((h) => h.id === id);
      if (!entry) throw new ApiError("NOT_FOUND", "Topilmadi");
      if (actor.role === "operator" && entry.operatorId !== actor.id) throw new ApiError("FORBIDDEN", "Faqat o'z tarixingizni tahrirlay olasiz.");
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

  recordExport: (section) =>
    withLatency<void>(() => {
      const actor = currentAdmin();
      if (!ROLE_ACTIONS[actor.role].includes("export")) throw new ApiError("FORBIDDEN", "Eksport huquqingiz yo'q.");
      addAuditEntry({ actorId: actor.id, actorName: actor.name, action: "export", targetType: "section", targetId: section, detail: `${section} eksport qilindi` });
    }),
};
