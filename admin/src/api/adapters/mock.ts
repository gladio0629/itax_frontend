import { ApiError, withLatency } from "@/mockDb/latency";
import {
  db,
  CURRENT_ADMIN_ID,
  DEMO_PASSWORD,
  getAdminUsers as readAdminUsers,
  setAdminRole,
  addAuditEntry,
  getAuditLog as readAuditLog,
  getReviewRequest,
  saveReviewRequest,
  getTariffProposals as readTariffProposals,
  saveTariffProposal,
  saveTwoFactorCode,
  consumeTwoFactorCode,
  getSession,
  setSession,
  type ReviewRequest,
  type TariffProposal,
} from "@/mockDb/db";
import type { ApiAdapter } from "../adapterTypes";
import type { DashboardStats, OrderWithNames, OtpRequestResult, WalletLedgerRow } from "../types";

function currentAdminName(): string {
  return readAdminUsers().find((u) => u.id === CURRENT_ADMIN_ID)?.name ?? "Admin";
}

function resolveReview(req: ReviewRequest): ReviewRequest {
  if (req.status === "pending" && Date.now() >= req.resolvesAt) {
    req.status = "approved";
    saveReviewRequest(req);
  }
  return req;
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

export const mockAdapter: ApiAdapter = {
  login: (email, password) =>
    withLatency<void>(
      () => {
        const user = readAdminUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!user || password !== DEMO_PASSWORD) {
          throw new ApiError("INVALID_CREDENTIALS", "Email yoki parol noto'g'ri.");
        }
      },
      { minMs: 300, maxMs: 700 }
    ),

  requestTwoFactor: () =>
    withLatency<OtpRequestResult>(() => {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const requestId = `2fa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      saveTwoFactorCode(requestId, code);
      return { requestId, demoCode: code };
    }),

  verifyTwoFactor: (requestId, code) =>
    withLatency<ReviewRequest>(() => {
      const expected = consumeTwoFactorCode(requestId);
      if (!expected || expected !== code) {
        throw new ApiError("INVALID_CODE", "Kod noto'g'ri. Qaytadan urinib ko'ring.");
      }
      const now = Date.now();
      const delay = 2000 + Math.random() * 2000;
      const req: ReviewRequest = {
        id: `rev_${now}_${Math.random().toString(36).slice(2, 7)}`,
        kind: "admin_2fa",
        status: "pending",
        createdAt: now,
        resolvesAt: now + delay,
      };
      saveReviewRequest(req);
      return req;
    }),

  getReviewStatus: (id) =>
    withLatency<ReviewRequest>(() => {
      const existing = getReviewRequest(id);
      if (!existing) throw new ApiError("NOT_FOUND", "Tekshiruv so'rovi topilmadi");
      const req = resolveReview(existing);
      if (req.status === "approved" && !req.payload?.applied) {
        if (req.kind === "admin_2fa") {
          setSession({ adminId: CURRENT_ADMIN_ID });
          addAuditEntry({
            actorId: CURRENT_ADMIN_ID,
            actorName: currentAdminName(),
            action: "2fa_verify",
            targetType: "session",
            targetId: CURRENT_ADMIN_ID,
            detail: "Ikki bosqichli tasdiqlashdan muvaffaqiyatli o'tildi",
          });
        }
        if (req.kind === "tariff_second_approve") {
          const proposalId = req.payload?.proposalId as string | undefined;
          const proposal = proposalId ? readTariffProposals().find((p) => p.id === proposalId) : undefined;
          if (proposal) {
            const tariff = db.tariffs()[0];
            db.updateTariff(tariff.id, proposal.patch);
            saveTariffProposal({ ...proposal, status: "approved", resolvedAt: Date.now() });
            addAuditEntry({
              actorId: CURRENT_ADMIN_ID,
              actorName: currentAdminName(),
              action: "tariff_second_approve",
              targetType: "tariff",
              targetId: tariff.id,
              detail: `Tarif o'zgarishi ikkinchi admin tomonidan tasdiqlandi (so'rov: ${proposal.id})`,
            });
          }
        }
        req.payload = { ...req.payload, applied: true };
        saveReviewRequest(req);
      }
      return req;
    }),

  logout: () => withLatency<void>(() => setSession(null)),

  getCurrentAdmin: () =>
    withLatency(() => {
      const u = readAdminUsers().find((x) => x.id === CURRENT_ADMIN_ID);
      if (!u) throw new ApiError("NOT_FOUND", "Admin topilmadi");
      return u;
    }),

  isAuthenticated: () => !!getSession(),

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
        pendingVerifications: drivers.filter((d) => d.documentsStatus === "pending").length,
        openSupportTickets: complaints.filter((c) => (c.type === "service_quality" || c.type === "payment_dispute") && c.status === "open").length,
        flaggedRiskItems: complaints.filter(
          (c) => ["suspicious_gps", "repeated_pair", "otp_abuse", "referral_abuse"].includes(c.type) && c.status !== "dismissed"
        ).length,
      };
    }),

  getCities: () => withLatency(() => db.cities()),

  getPendingDrivers: () => withLatency(() => db.drivers().filter((d) => d.documentsStatus === "pending")),
  getDrivers: () => withLatency(() => db.drivers()),

  approveDriver: (driverId) =>
    withLatency(() => {
      db.updateDriver(driverId, { documentsStatus: "approved" });
      addAuditEntry({
        actorId: CURRENT_ADMIN_ID,
        actorName: currentAdminName(),
        action: "driver_approve",
        targetType: "driver",
        targetId: driverId,
        detail: "Haydovchi hujjatlari tasdiqlandi",
      });
      const d = db.getDriver(driverId);
      if (!d) throw new ApiError("NOT_FOUND", "Haydovchi topilmadi");
      return d;
    }),

  rejectDriver: (driverId, reason) =>
    withLatency(() => {
      db.updateDriver(driverId, { documentsStatus: "rejected" });
      addAuditEntry({
        actorId: CURRENT_ADMIN_ID,
        actorName: currentAdminName(),
        action: "driver_reject",
        targetType: "driver",
        targetId: driverId,
        detail: `Hujjatlar rad etildi: ${reason}`,
      });
      const d = db.getDriver(driverId);
      if (!d) throw new ApiError("NOT_FOUND", "Haydovchi topilmadi");
      return d;
    }),

  getPassengers: () => withLatency(() => db.passengers()),

  getOrders: () =>
    withLatency<OrderWithNames[]>(() => {
      const passengers = db.passengers();
      const drivers = db.drivers();
      const cities = db.cities();
      return db.orders().map((o) => ({
        ...o,
        passengerName: passengers.find((p) => p.id === o.passengerId)?.name ?? "—",
        driverName: o.driverId ? drivers.find((d) => d.id === o.driverId)?.name ?? "—" : null,
        fromCityName: cities.find((c) => c.id === o.fromCityId)?.name ?? o.fromCityId,
        toCityName: cities.find((c) => c.id === o.toCityId)?.name ?? o.toCityId,
      }));
    }),

  getWalletLedger: () =>
    withLatency<WalletLedgerRow[]>(() => {
      const drivers = db.drivers();
      return [...db.walletEntries()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((e) => ({ ...e, driverName: drivers.find((d) => d.id === e.driverId)?.name ?? "—" }));
    }),

  getTariffs: () => withLatency(() => db.tariffs()),
  getTariffProposals: () => withLatency(() => readTariffProposals()),

  proposeTariffChange: (patch) =>
    withLatency<TariffProposal>(() => {
      const proposal: TariffProposal = {
        id: `tpf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        patch,
        proposedById: CURRENT_ADMIN_ID,
        proposedByName: currentAdminName(),
        status: "pending_second",
        createdAt: Date.now(),
      };
      saveTariffProposal(proposal);
      addAuditEntry({
        actorId: CURRENT_ADMIN_ID,
        actorName: currentAdminName(),
        action: "tariff_propose",
        targetType: "tariff",
        targetId: db.tariffs()[0].id,
        detail: "Yangi tarif o'zgarishi taklif qilindi va ikkinchi adminga yuborildi",
      });
      return proposal;
    }),

  approveTariffChange: (proposalId) =>
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

  rejectTariffChange: (proposalId) =>
    withLatency<TariffProposal>(() => {
      const proposal = readTariffProposals().find((p) => p.id === proposalId);
      if (!proposal) throw new ApiError("NOT_FOUND", "So'rov topilmadi");
      const updated: TariffProposal = { ...proposal, status: "rejected", resolvedAt: Date.now() };
      saveTariffProposal(updated);
      addAuditEntry({
        actorId: CURRENT_ADMIN_ID,
        actorName: currentAdminName(),
        action: "tariff_reject",
        targetType: "tariff_proposal",
        targetId: proposalId,
        detail: "Tarif o'zgarishi rad etildi",
      });
      return updated;
    }),

  getSupportTickets: () =>
    withLatency(() => db.complaints().filter((c) => c.type === "service_quality" || c.type === "payment_dispute")),

  getRiskItems: () =>
    withLatency(() =>
      db.complaints().filter((c) => ["suspicious_gps", "repeated_pair", "otp_abuse", "referral_abuse"].includes(c.type))
    ),

  resolveComplaint: (id, status) =>
    withLatency(() => {
      db.updateComplaint(id, { status });
      addAuditEntry({
        actorId: CURRENT_ADMIN_ID,
        actorName: currentAdminName(),
        action: status === "resolved" ? "complaint_resolve" : "complaint_dismiss",
        targetType: "complaint",
        targetId: id,
        detail: status === "resolved" ? "Shikoyat hal qilindi" : "Shikoyat rad etildi",
      });
      const c = db.complaints().find((x) => x.id === id);
      if (!c) throw new ApiError("NOT_FOUND", "Shikoyat topilmadi");
      return c;
    }),

  getAdminUsers: () => withLatency(() => readAdminUsers()),

  updateAdminRole: (id, role) =>
    withLatency(() => {
      setAdminRole(id, role);
      addAuditEntry({
        actorId: CURRENT_ADMIN_ID,
        actorName: currentAdminName(),
        action: "role_change",
        targetType: "admin_user",
        targetId: id,
        detail: `Rol o'zgartirildi: ${role}`,
      });
      const u = readAdminUsers().find((x) => x.id === id);
      if (!u) throw new ApiError("NOT_FOUND", "Admin topilmadi");
      return u;
    }),

  getAuditLog: () => withLatency(() => readAuditLog()),

  revealPhone: (entityType, entityId) =>
    withLatency(() => {
      const masked = entityType === "driver" ? db.getDriver(entityId)?.phoneMasked : db.passengers().find((p) => p.id === entityId)?.phoneMasked;
      if (!masked) throw new ApiError("NOT_FOUND", "Topilmadi");
      const phone = revealMaskedPhone(masked, entityId);
      addAuditEntry({
        actorId: CURRENT_ADMIN_ID,
        actorName: currentAdminName(),
        action: "phone_reveal",
        targetType: entityType,
        targetId: entityId,
        detail: `Telefon raqami ko'rsatildi: ${phone}`,
      });
      return { phone };
    }),
};
