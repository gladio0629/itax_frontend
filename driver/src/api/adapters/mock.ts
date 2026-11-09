import { db } from "@/mockDb/db";
import { withLatency, ApiError } from "@/mockDb/latency";
import { submitForReview, pollReview } from "@/lib/reviewMechanism";
import { getDemoScenarios } from "@/stores/demoStore";
import { readJSON, writeJSON } from "@/mockDb/storage";
import {
  computePrice,
  roadDistanceKm,
  DEFAULT_TARIFF,
  CITIES,
  type City,
  type Order,
  type Passenger,
} from "@/seed/generate";
import type { ApiAdapter } from "../adapterTypes";
import {
  COMMISSION_PCT,
  DEBT_LIMIT_SOM,
  type DriverProfile,
  type EarningsStats,
  type NotificationItem,
  type OrderWithDetails,
  type OtpRequestResult,
  type RegistrationInput,
  type WalletSummary,
} from "../types";

const DEMO_OTP_CODE = "0000";

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function cityOf(id: string): City {
  const c = db.cities().find((x) => x.id === id);
  if (!c) throw new ApiError("NOT_FOUND", "Shahar topilmadi");
  return c;
}

function passengerOf(id: string): Passenger | undefined {
  return db.passengers().find((p) => p.id === id);
}

function toDetails(order: Order): OrderWithDetails {
  const coRiderOrders = db.orders().filter((o) => o.id.startsWith(`${order.id}_co`));
  return {
    ...order,
    passenger: passengerOf(order.passengerId),
    fromCity: cityOf(order.fromCityId),
    toCity: cityOf(order.toCityId),
    coRiders: coRiderOrders.length
      ? coRiderOrders.map((o) => ({ order: o, passenger: passengerOf(o.passengerId) }))
      : undefined,
  };
}

function isDebtBlocked(driver: DriverProfile | { walletBalance: number }): boolean {
  return getDemoScenarios().walletLimit || driver.walletBalance <= DEBT_LIMIT_SOM;
}

function toProfile(): DriverProfile {
  const d = db.currentDriver();
  return {
    id: d.id,
    name: d.name,
    phoneMasked: d.phoneMasked,
    avatarSeed: d.avatarSeed,
    rating: d.rating,
    totalTrips: d.totalTrips,
    cityId: d.cityId,
    carModel: d.carModel,
    carColor: d.carColor,
    carColorHex: d.carColorHex,
    plate: d.plate,
    online: d.online,
    walletBalance: d.walletBalance,
    documentsStatus: d.documentsStatus,
    joinedAt: d.joinedAt,
  };
}

/** Pure function of time: an unaccepted offer past its expiry becomes missed. */
function resolveOfferExpiry(order: Order) {
  if (order.status === "searching" && order.timeline && Date.now() >= order.timeline.searchResolvesAt) {
    order.status = "no_driver";
    db.updateOrder(order.id, order);
  }
}

function generateOffer(): Order {
  const driver = db.currentDriver();
  const passengers = db.passengers();
  const passenger = passengers[Math.floor(Math.random() * passengers.length)];
  const otherCities = CITIES.filter((c) => c.id !== driver.cityId);
  const toCity = otherCities[Math.floor(Math.random() * otherCities.length)];
  const distanceKm = roadDistanceKm(driver.cityId, toCity.id);
  const mode = Math.random() < 0.5 ? "car" : "seat";
  const seatIds =
    mode === "seat"
      ? (["front", "back-left", "back-mid", "back-right"] as const)
          .slice(0, 1 + Math.floor(Math.random() * 2))
      : [];
  const scenarios = getDemoScenarios();
  const expiryMs = scenarios.fastForward ? 8_000 : 25_000 + Math.random() * 15_000;
  const now = Date.now();
  return {
    id: genId("ord"),
    passengerId: passenger.id,
    driverId: null,
    fromCityId: driver.cityId,
    toCityId: toCity.id,
    distanceKm,
    mode,
    seatIds: [...seatIds],
    price: computePrice(distanceKm, mode, [...seatIds], DEFAULT_TARIFF),
    paymentMethod: Math.random() < 0.6 ? "cash" : "card",
    status: "searching",
    createdAt: now,
    timeline: { searchResolvesAt: now + expiryMs, outcome: "accepted" },
  };
}

function pendingOffers(): Order[] {
  return db
    .orders()
    .filter((o) => o.status === "searching" && o.driverId === null && !!o.timeline && !o.id.includes("_co"));
}

function creditEarnings(order: Order) {
  const driver = db.currentDriver();
  const entries = db.walletEntries().filter((e) => e.driverId === driver.id);
  let balance = entries.length ? entries[entries.length - 1].balanceAfter : driver.walletBalance;
  if (order.paymentMethod === "cash") {
    const commission = Math.round((order.price * COMMISSION_PCT) / 100);
    balance -= commission;
    db.addWalletEntry({
      id: genId("wal"),
      driverId: driver.id,
      type: "commission",
      amount: -commission,
      orderId: order.id,
      createdAt: Date.now(),
      balanceAfter: balance,
    });
  } else {
    const net = Math.round((order.price * (100 - COMMISSION_PCT)) / 100);
    balance += net;
    db.addWalletEntry({
      id: genId("wal"),
      driverId: driver.id,
      type: "card",
      amount: net,
      orderId: order.id,
      createdAt: Date.now(),
      balanceAfter: balance,
    });
  }
  db.updateDriver(driver.id, { walletBalance: balance, totalTrips: driver.totalTrips + 1 });
}

export const mockAdapter: ApiAdapter = {
  getProfile: () => withLatency(() => toProfile()),

  setOnline: (online: boolean) =>
    withLatency(() => {
      db.updateDriver(db.currentDriverId(), { online });
      return toProfile();
    }, { minMs: 150, maxMs: 350 }),

  getOffers: () =>
    withLatency(() => {
      const driver = db.currentDriver();
      if (!driver.online) return [];
      db.orders().forEach(resolveOfferExpiry);
      let offers = pendingOffers();
      if (offers.length < 2) {
        const fresh = generateOffer();
        db.addOrder(fresh);
        offers = [fresh, ...offers];
      }
      return offers.slice(0, 4).map(toDetails);
    }),

  acceptOffer: (orderId: string) =>
    withLatency<OrderWithDetails>(() => {
      const driver = db.currentDriver();
      if (isDebtBlocked(driver)) {
        throw new ApiError("WALLET_LIMIT", "Hamyon balansi past. Avval hamyonni to'ldiring.");
      }
      const order = db.getOrder(orderId);
      resolveOfferExpiry(order ?? ({} as Order));
      if (!order || order.status !== "searching" || order.driverId !== null) {
        throw new ApiError("ALREADY_TAKEN", "Bu buyurtmani boshqa haydovchi birinchi bo'lib qabul qildi.");
      }
      if (Math.random() < 0.22) {
        order.status = "no_driver";
        db.updateOrder(order.id, order);
        throw new ApiError("ALREADY_TAKEN", "Bu buyurtmani boshqa haydovchi birinchi bo'lib qabul qildi.");
      }
      order.driverId = driver.id;
      order.status = "accepted";
      order.timeline = { searchResolvesAt: order.timeline!.searchResolvesAt, acceptedAt: Date.now(), outcome: "accepted" };
      db.updateOrder(order.id, order);

      if (order.mode === "seat" && order.seatIds.length < 3 && Math.random() < 0.6) {
        const coCount = 1 + Math.floor(Math.random() * 2);
        const takenSeats = new Set(order.seatIds);
        const freeSeats = (["front", "back-left", "back-mid", "back-right"] as const).filter(
          (s) => !takenSeats.has(s)
        );
        const passengers = db.passengers();
        for (let i = 0; i < Math.min(coCount, freeSeats.length); i++) {
          const seat = freeSeats[i];
          const co = passengers[Math.floor(Math.random() * passengers.length)];
          const coOrder: Order = {
            id: `${order.id}_co${i + 1}`,
            passengerId: co.id,
            driverId: driver.id,
            fromCityId: order.fromCityId,
            toCityId: order.toCityId,
            distanceKm: order.distanceKm,
            mode: "seat",
            seatIds: [seat],
            price: computePrice(order.distanceKm, "seat", [seat], DEFAULT_TARIFF),
            paymentMethod: Math.random() < 0.6 ? "cash" : "card",
            status: "accepted",
            createdAt: Date.now(),
          };
          db.addOrder(coOrder);
        }
      }
      return toDetails(order);
    }, { minMs: 250, maxMs: 500 }),

  declineOffer: (orderId: string) =>
    withLatency(() => {
      db.updateOrder(orderId, { status: "no_driver" });
    }, { minMs: 100, maxMs: 200 }).then(() => undefined),

  getActiveTrip: () =>
    withLatency(() => {
      const driver = db.currentDriver();
      const order = db
        .orders()
        .find((o) => o.driverId === driver.id && !o.id.includes("_co") && (o.status === "accepted" || o.status === "in_progress"));
      return order ? toDetails(order) : null;
    }),

  startTrip: (orderId: string) =>
    withLatency<OrderWithDetails>(() => {
      const order = db.getOrder(orderId);
      if (!order) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      order.status = "in_progress";
      db.updateOrder(order.id, order);
      db.orders()
        .filter((o) => o.id.startsWith(`${order.id}_co`))
        .forEach((o) => db.updateOrder(o.id, { status: "in_progress" }));
      return toDetails(order);
    }, { minMs: 200, maxMs: 400 }),

  completeTrip: (orderId: string) =>
    withLatency<OrderWithDetails>(() => {
      const order = db.getOrder(orderId);
      if (!order) throw new ApiError("NOT_FOUND", "Buyurtma topilmadi");
      order.status = "completed";
      db.updateOrder(order.id, order);
      creditEarnings(order);
      const coRiders = db.orders().filter((o) => o.id.startsWith(`${order.id}_co`));
      coRiders.forEach((o) => {
        db.updateOrder(o.id, { status: "completed" });
        creditEarnings({ ...o, status: "completed" });
      });
      return toDetails(order);
    }, { minMs: 300, maxMs: 600 }),

  cancelTrip: (orderId: string, reason: string) =>
    withLatency<OrderWithDetails>(() => {
      db.updateOrder(orderId, { status: "cancelled", cancelReason: reason });
      db.orders()
        .filter((o) => o.id.startsWith(`${orderId}_co`))
        .forEach((o) => db.updateOrder(o.id, { status: "cancelled", cancelReason: reason }));
      return toDetails(db.getOrder(orderId)!);
    }),

  getOrderHistory: () =>
    withLatency(() => {
      const driver = db.currentDriver();
      return db
        .orders()
        .filter((o) => o.driverId === driver.id && !o.id.includes("_co") && (o.status === "completed" || o.status === "cancelled"))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(toDetails);
    }),

  getWallet: () =>
    withLatency<WalletSummary>(() => {
      const driver = db.currentDriver();
      const entries = db
        .walletEntries()
        .filter((e) => e.driverId === driver.id)
        .sort((a, b) => b.createdAt - a.createdAt);
      return {
        balance: driver.walletBalance,
        commissionPct: COMMISSION_PCT,
        debtBlocked: isDebtBlocked(driver),
        entries,
      };
    }),

  requestWalletTopup: (amount: number) =>
    withLatency(() => {
      if (amount <= 0) throw new ApiError("INVALID_AMOUNT", "Summani to'g'ri kiriting");
      const driver = db.currentDriver();
      const balance = driver.walletBalance + amount;
      db.addWalletEntry({
        id: genId("wal"),
        driverId: driver.id,
        type: "topup",
        amount,
        createdAt: Date.now(),
        balanceAfter: balance,
      });
      db.updateDriver(driver.id, { walletBalance: balance });
      return submitForReview("wallet_topup", { amount });
    }, { minMs: 300, maxMs: 600 }),

  getReviewStatus: (reviewId: string) =>
    withLatency(() => {
      const review = pollReview(reviewId);
      if (review.status === "approved" && review.kind === "driver_registration") {
        db.updateDriver(db.currentDriverId(), { documentsStatus: "approved" });
      }
      return review;
    }, { minMs: 150, maxMs: 350 }),

  getEarningsStats: (range: "week" | "month") =>
    withLatency<EarningsStats>(() => {
      const driver = db.currentDriver();
      const days = range === "week" ? 7 : 30;
      const now = Date.now();
      const dayMs = 86_400_000;
      // Revenue is derived straight from completed orders (price), not wallet
      // entries: wallet entries only ever record the commission/net-card
      // movement, never the full cash amount a driver collects in person.
      const allCompleted = db.orders().filter((o) => o.driverId === driver.id && o.status === "completed");
      const trips = allCompleted.filter((o) => !o.id.includes("_co"));

      const points = Array.from({ length: days }, (_, i) => {
        const dayStart = now - (days - 1 - i) * dayMs;
        const d = new Date(dayStart);
        const dayKey = d.toDateString();
        const amount = allCompleted
          .filter((o) => new Date(o.createdAt).toDateString() === dayKey)
          .reduce((sum, o) => sum + o.price, 0);
        const tripCount = trips.filter((o) => new Date(o.createdAt).toDateString() === dayKey).length;
        return {
          date: d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" }),
          amount,
          trips: tripCount,
        };
      });

      const todayKey = new Date(now).toDateString();
      const weekStart = now - 7 * dayMs;
      return {
        points,
        totalToday: allCompleted
          .filter((o) => new Date(o.createdAt).toDateString() === todayKey)
          .reduce((sum, o) => sum + o.price, 0),
        tripsToday: trips.filter((o) => new Date(o.createdAt).toDateString() === todayKey).length,
        totalWeek: allCompleted
          .filter((o) => o.createdAt >= weekStart)
          .reduce((sum, o) => sum + o.price, 0),
        tripsWeek: trips.filter((o) => o.createdAt >= weekStart).length,
        avgRating: driver.rating,
      };
    }),

  getNotifications: () =>
    withLatency(() => {
      const seeded: NotificationItem[] = [
        {
          id: "ntf_1",
          title: "Yangi buyurtma taklifi",
          body: "Yaqin atrofda yo'lovchi sizni kutmoqda.",
          createdAt: Date.now() - 1 * 86_400_000,
          read: true,
          kind: "order",
        },
        {
          id: "ntf_2",
          title: "Komissiya yechib olindi",
          body: "Yakunlangan safar uchun 10% komissiya hamyondan yechildi.",
          createdAt: Date.now() - 3 * 86_400_000,
          read: true,
          kind: "wallet",
        },
        {
          id: "ntf_3",
          title: "Hujjatlar tasdiqlandi",
          body: "Haydovchilik guvohnomangiz muvaffaqiyatli tekshirildi.",
          createdAt: Date.now() - 12 * 86_400_000,
          read: false,
          kind: "docs",
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

  getCities: () => withLatency(() => db.cities()),

  getRegistrationStatus: () =>
    withLatency(() => ({ documentsStatus: db.currentDriver().documentsStatus })),

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

  submitRegistration: (input: RegistrationInput) =>
    withLatency(() => {
      db.updateDriver(db.currentDriverId(), { documentsStatus: "pending" });
      return submitForReview("driver_registration", { ...input });
    }, { minMs: 300, maxMs: 600 }),
};
