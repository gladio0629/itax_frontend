import { db } from "@/mockDb/db";
import { withLatency, ApiError } from "@/mockDb/latency";
import { submitForReview, pollReview } from "@/lib/reviewMechanism";
import { getDemoScenarios } from "@/stores/demoStore";
import { computePrice, roadDistanceKm, DEFAULT_TARIFF, type City, type Order } from "@/seed/generate";
import { readJSON, writeJSON } from "@/mockDb/storage";
import type { ApiAdapter } from "../adapterTypes";
import type {
  CreateOrderInput,
  NotificationItem,
  OrderWithDetails,
  OtpRequestResult,
  Profile,
  Quote,
  QuoteInput,
  RouteSuggestion,
  SavedCard,
} from "../types";

const DEMO_OTP_CODE = "0000";

function cityOf(id: string): City {
  const c = db.cities().find((x) => x.id === id);
  if (!c) throw new ApiError("NOT_FOUND", "Shahar topilmadi");
  return c;
}

function currentPassengerId(): string {
  return db.passengers()[2].id; // fixed demo passenger: a stable "me"
}

function toDetails(order: Order): OrderWithDetails {
  const driver = order.driverId ? db.drivers().find((d) => d.id === order.driverId) : undefined;
  return {
    ...order,
    driver,
    fromCity: cityOf(order.fromCityId),
    toCity: cityOf(order.toCityId),
  };
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Pure function of time: resolves a live order's transient status. */
function resolveLiveStatus(order: Order): Order {
  if (!order.timeline) return order;
  const now = Date.now();
  const t = order.timeline;

  if (order.status === "searching" && now >= t.searchResolvesAt) {
    if (t.outcome === "no_driver") {
      order.status = "no_driver";
    } else {
      const approvedDrivers = db.drivers().filter((d) => d.documentsStatus === "approved");
      const driver = approvedDrivers[Math.floor(Math.random() * approvedDrivers.length)];
      order.driverId = driver.id;
      order.status = "accepted";
      const pickupMs = 15_000 + Math.random() * 15_000;
      t.acceptedAt = now;
      t.tripStartsAt = now + pickupMs;
      const tripMs = Math.min(60_000, Math.max(20_000, order.distanceKm * 150));
      t.tripEndsAt = t.tripStartsAt + tripMs;
    }
  } else if (order.status === "accepted" && t.tripStartsAt && now >= t.tripStartsAt) {
    order.status = "in_progress";
  } else if (order.status === "in_progress" && t.tripEndsAt && now >= t.tripEndsAt) {
    order.status = "completed";
  }
  db.updateOrder(order.id, order);
  return order;
}

function popularPairs(): { from: string; to: string }[] {
  return [
    { from: "tsh", to: "smq" },
    { from: "tsh", to: "frg" },
    { from: "tsh", to: "and" },
    { from: "smq", to: "bxr" },
    { from: "tsh", to: "nmn" },
    { from: "nks", to: "xva" },
  ];
}

function routeSuggestion(fromId: string, toId: string): RouteSuggestion {
  const distanceKm = roadDistanceKm(fromId, toId);
  return {
    fromCityId: fromId,
    toCityId: toId,
    distanceKm,
    fromPrice: computePrice(distanceKm, "seat", [], DEFAULT_TARIFF),
    label: `${cityOf(fromId).name} \u2192 ${cityOf(toId).name}`,
  };
}

export const mockAdapter: ApiAdapter = {
  getCities: () => withLatency(() => db.cities()),

  getPopularRoutes: () =>
    withLatency(() => popularPairs().map((p) => routeSuggestion(p.from, p.to))),

  getRecentRoutes: () =>
    withLatency(() => {
      const mine = db
        .orders()
        .filter((o) => o.passengerId === currentPassengerId())
        .slice(0, 8);
      const seen = new Set<string>();
      const result: RouteSuggestion[] = [];
      for (const o of mine) {
        const key = `${o.fromCityId}-${o.toCityId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(routeSuggestion(o.fromCityId, o.toCityId));
        if (result.length >= 3) break;
      }
      return result;
    }),

  getQuote: (input: QuoteInput) =>
    withLatency<Quote>(() => {
      const distanceKm = roadDistanceKm(input.fromCityId, input.toCityId);
      if (distanceKm === 0) throw new ApiError("INVALID_ROUTE", "Yo'nalishni tanlang");
      const price = computePrice(distanceKm, input.mode, input.seatIds, DEFAULT_TARIFF);
      return {
        distanceKm,
        price,
        perSeatPrice:
          input.mode === "seat"
            ? computePrice(distanceKm, "seat", ["back-mid"], DEFAULT_TARIFF)
            : undefined,
        etaMinutes: 3 + Math.round(Math.random() * 6),
        durationMinutes: Math.round((distanceKm / 70) * 60),
      };
    }),

  requestOtp: (_phone: string) =>
    withLatency<OtpRequestResult>(() => ({
      requestId: genId("otp"),
      demoCode: DEMO_OTP_CODE,
    }), { minMs: 250, maxMs: 500 }),

  verifyOtp: (_requestId: string, code: string) =>
    withLatency(() => {
      if (code !== DEMO_OTP_CODE) {
        throw new ApiError("INVALID_CODE", "Kod noto'g'ri. Qaytadan urinib ko'ring.");
      }
      return submitForReview("otp_verify", { phone: _requestId });
    }, { minMs: 200, maxMs: 400 }),

  getReviewStatus: (reviewId: string) => withLatency(() => pollReview(reviewId), { minMs: 150, maxMs: 350 }),

  createOrder: (input: CreateOrderInput) =>
    withLatency<OrderWithDetails>(() => {
      const scenarios = getDemoScenarios();
      const distanceKm = roadDistanceKm(input.fromCityId, input.toCityId);
      const price = computePrice(distanceKm, input.mode, input.seatIds, DEFAULT_TARIFF);
      const now = Date.now();
      const searchMs = scenarios.noDriverFound
        ? 9_000 + Math.random() * 6_000
        : 4_000 + Math.random() * 5_000;
      const order: Order = {
        id: genId("ord"),
        passengerId: currentPassengerId(),
        driverId: null,
        fromCityId: input.fromCityId,
        toCityId: input.toCityId,
        distanceKm,
        mode: input.mode,
        seatIds: input.seatIds,
        price,
        paymentMethod: input.paymentMethod,
        status: "searching",
        createdAt: now,
        timeline: {
          searchResolvesAt: now + searchMs,
          outcome: scenarios.noDriverFound ? "no_driver" : "accepted",
        },
      };
      db.addOrder(order);
      return toDetails(order);
    }, { minMs: 400, maxMs: 800 }),

  getOrder: (orderId: string) =>
    withLatency<OrderWithDetails>(() => {
      const order = db.getOrder(orderId);
      if (!order) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      resolveLiveStatus(order);
      return toDetails(order);
    }, { minMs: 150, maxMs: 400 }),

  cancelOrder: (orderId: string, reason: string) =>
    withLatency<OrderWithDetails>(() => {
      db.updateOrder(orderId, { status: "cancelled", cancelReason: reason });
      return toDetails(db.getOrder(orderId)!);
    }),

  rateOrder: (orderId: string, rating: number) =>
    withLatency<OrderWithDetails>(() => {
      db.updateOrder(orderId, { rating });
      return toDetails(db.getOrder(orderId)!);
    }, { minMs: 200, maxMs: 500 }),

  getOrderHistory: () =>
    withLatency(() =>
      db
        .orders()
        .filter((o) => o.passengerId === currentPassengerId())
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(toDetails)
    ),

  getSavedCards: () => withLatency(() => readJSON<SavedCard[]>("saved_cards", [])),

  linkCard: (payload) =>
    withLatency(() => {
      const review = submitForReview("card_link", payload);
      const cards = readJSON<SavedCard[]>("saved_cards", []);
      cards.push({ id: genId("card"), ...payload });
      writeJSON("saved_cards", cards);
      return review;
    }, { minMs: 300, maxMs: 600 }),

  getNotifications: () =>
    withLatency(() => {
      const seeded: NotificationItem[] = [
        {
          id: "ntf_1",
          title: "Haydovchi topildi",
          body: "Jahongir Yusupov sizning tomoningizga yo'l oldi.",
          createdAt: Date.now() - 2 * 86_400_000,
          read: true,
          kind: "order",
        },
        {
          id: "ntf_2",
          title: "Promo-kod faollashtirildi",
          body: "IZGO10 kodi bilan 10% chegirma qo'llandi.",
          createdAt: Date.now() - 6 * 86_400_000,
          read: true,
          kind: "promo",
        },
        {
          id: "ntf_3",
          title: "Karta muvaffaqiyatli bog'landi",
          body: "Uzcard *4821 endi to'lov usuli sifatida mavjud.",
          createdAt: Date.now() - 10 * 86_400_000,
          read: false,
          kind: "wallet",
        },
      ];
      return readJSON<NotificationItem[]>("notifications", seeded);
    }),

  markNotificationRead: (id: string) =>
    withLatency(() => {
      const list = readJSON<NotificationItem[]>("notifications", []);
      const next = list.map((n) => (n.id === id ? { ...n, read: true } : n));
      writeJSON("notifications", next);
    }, { minMs: 100, maxMs: 200 }).then(() => undefined),

  getProfile: () =>
    withLatency<Profile>(() => {
      const p = db.passengers().find((x) => x.id === currentPassengerId())!;
      return {
        id: p.id,
        name: p.name,
        phoneMasked: p.phoneMasked,
        avatarSeed: p.avatarSeed,
        rating: p.rating,
        totalTrips: p.totalTrips,
      };
    }),

  applyPromoCode: (code: string) =>
    withLatency(() => {
      const normalized = code.trim().toUpperCase();
      if (normalized === "IZGO10") {
        return { valid: true, discountPct: 10, message: "10% chegirma qo'llandi" };
      }
      return { valid: false, discountPct: 0, message: "Promo-kod topilmadi yoki muddati tugagan" };
    }, { minMs: 300, maxMs: 600 }),

  getReferralCode: () =>
    withLatency(() => ({ code: "IZGO-A3F9", invitedCount: 4, bonusSom: 60_000 })),

  submitSupportTicket: (message: string) =>
    withLatency(() => submitForReview("support_ticket", { message }), { minMs: 300, maxMs: 600 }),
};
