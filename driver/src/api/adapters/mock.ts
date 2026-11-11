// Mock adapter: the only place with business rules (commission, debt limit,
// offer timing, trip stages, bonus levels, filtering, pagination). Screens
// never compute any of this.
import { CITIES, computePrice, roadDistanceKm } from "@/seed/generate";
import { withLatency, ApiError } from "@/mockDb/latency";
import {
  BASE_COMMISSION_PCT, BONUS_LEVELS, CAR_COLORS, CAR_MODELS, DEBT_LIMIT, DEBT_NEAR_RATIO, OFFER_COUNTDOWN_SEC,
  appendLedger, cityName, cityRef, genId, ledgerFor, levelFor, passengers, persist, presetState, pushNotification,
  replaceState, state, weekTrips, type DriverState, type LiveTrip, type OfferRecord, type TripRecord,
} from "@/mockDb/driverDb";
import { makeRng } from "@/lib/prng";
import type { ApiAdapter } from "../adapterTypes";
import type {
  ActiveTrip, BonusInfo, DebtState, DriverProfile, HistoryItem, HistoryPage, HomeSummary, LedgerPage, Offer,
  PassengerInfo, ReviewKind, ReviewRequest, TopupOptions, TripDetail, TripStage, TripStep, TripSummary, WalletSummary,
} from "../types";

const DEMO_OTP = "0000";
const LEDGER_PAGE_SIZE = 12;
const STAGES: TripStage[] = ["to_pickup", "waiting", "in_progress", "completed"];
const CANCEL_REASONS = ["cancel.reason.passengerNoShow", "cancel.reason.wrongAddress", "cancel.reason.carIssue", "cancel.reason.passengerAsked", "cancel.reason.other"];
const ADDR: Record<string, string[]> = {
  tsh: ["Amir Temur ko'chasi, 15", "Chilonzor, 9-kvartal", "Yunusobod, 4-mavze", "Shota Rustaveli, 42"],
  smq: ["Registon ko'chasi, 3", "Universitet xiyoboni, 18", "Temiryo'l vokzali"],
  bxr: ["Mustaqillik ko'chasi, 21", "Labi Hovuz", "Avtovokzal"],
  and: ["Navoiy shoh ko'chasi, 12", "Bobur maydoni"],
  nmn: ["Islom Karimov ko'chasi, 8", "Chorsu bozori"],
  frg: ["Al-Farg'oniy ko'chasi, 5", "Markaziy bog'"],
  qrs: ["Nasaf ko'chasi, 11", "Qarshi vokzali"],
  nks: ["Doslik guzari, 6", "Berdaq ko'chasi, 19"],
  xva: ["Ichan qal'a darvozasi", "Xiva avtovokzali"],
};

const rand = makeRng(Date.now() % 1_000_000);

// ---------- derived values ----------

function commissionPctNow(s: DriverState) {
  return levelFor(weekTrips(s)).commissionPct;
}

function debtState(s: DriverState): DebtState {
  const debtAmount = Math.max(0, -s.balance);
  const usedRatio = Math.min(1, debtAmount / -DEBT_LIMIT);
  const level = s.balance <= DEBT_LIMIT ? "blocked" : usedRatio >= DEBT_NEAR_RATIO ? "near" : "ok";
  return { level, balance: s.balance, limit: DEBT_LIMIT, debtAmount, usedRatio };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function todayTrips(s: DriverState) {
  const t0 = startOfToday();
  // Earnings land when a trip finishes, so "today" is by completion time.
  return s.trips.filter((t) => t.status === "completed" && t.timeline[t.timeline.length - 1].at >= t0);
}

function homeSummary(s: DriverState): HomeSummary {
  const today = todayTrips(s);
  const debt = debtState(s);
  return {
    online: s.online,
    todayEarnings: today.reduce((sum, t) => sum + t.net, 0),
    todayTrips: today.length,
    unreadNotifications: s.notifications.filter((n) => !n.read).length,
    debt,
    canAcceptOrders: debt.level !== "blocked",
    bonusActive: commissionPctNow(s) < BASE_COMMISSION_PCT,
  };
}

function passengerInfo(id: string): PassengerInfo {
  const p = passengers.find((x) => x.id === id) ?? passengers[0];
  const tail = p.phoneMasked.slice(-2);
  return { name: p.name, rating: p.rating, phoneMasked: `+998 ** *** ** ${tail}`, avatarSeed: p.avatarSeed };
}

function toOffer(o: OfferRecord): Offer {
  return {
    id: o.id,
    pickup: { city: cityRef(o.fromCityId), address: o.pickupAddr },
    dropoff: { city: cityRef(o.toCityId), address: o.dropoffAddr },
    distanceKm: o.distanceKm,
    durationMin: o.durationMin,
    pickupEtaMin: o.pickupEtaMin,
    priceMin: o.price,
    priceMax: o.priceMax,
    kind: o.kind,
    passengers: o.passengers,
    cargo: o.cargo,
    payment: o.payment,
    createdAt: o.createdAt,
    expiresAt: o.expiresAt,
    countdownSec: OFFER_COUNTDOWN_SEC,
  };
}

function steps(stage: TripStage): TripStep[] {
  const idx = STAGES.indexOf(stage);
  return STAGES.map((st, i) => ({ stage: st, state: i < idx ? "done" : i === idx ? "active" : "upcoming" }));
}

function toActiveTrip(t: LiveTrip): ActiveTrip {
  const elapsedMin = (Date.now() - t.stageStartedAt) / 60_000;
  // The demo clock runs ~6x fast so the remaining numbers visibly tick down.
  let remainingKm: number;
  let remainingMin: number;
  if (t.stage === "to_pickup") {
    remainingMin = Math.max(1, Math.round(t.pickupEtaMin - elapsedMin * 6));
    remainingKm = Math.max(0.3, Math.round(remainingMin * 0.6 * 10) / 10);
  } else if (t.stage === "waiting") {
    remainingKm = t.distanceKm;
    remainingMin = t.durationMin;
  } else {
    const frac = Math.min(0.97, (elapsedMin * 6) / t.durationMin);
    remainingKm = Math.max(1, Math.round(t.distanceKm * (1 - frac)));
    remainingMin = Math.max(1, Math.round(t.durationMin * (1 - frac)));
  }
  return {
    id: t.id,
    stage: t.stage,
    steps: steps(t.stage),
    nextAction: t.stage === "to_pickup" ? "arrived" : t.stage === "waiting" ? "start" : "finish",
    pendingReviewId: t.pendingReviewId,
    passenger: passengerInfo(t.passengerId),
    pickup: { city: cityRef(t.fromCityId), address: t.pickupAddr },
    dropoff: { city: cityRef(t.toCityId), address: t.dropoffAddr },
    remainingKm,
    remainingMin,
    price: t.price,
    payment: t.payment,
    kind: t.kind,
    passengers: t.passengers,
    cargo: t.cargo,
    acceptedAt: t.acceptedAt,
  };
}

function toHistoryItem(t: TripRecord): HistoryItem {
  return {
    id: t.id,
    createdAt: t.createdAt,
    from: cityRef(t.fromCityId),
    to: cityRef(t.toCityId),
    passengerName: passengerInfo(t.passengerId).name,
    earnings: t.net,
    payment: t.payment,
    ratingReceived: t.ratingReceived,
    status: t.status,
    kind: t.kind,
  };
}

function inRange(ts: number, range: "all" | "today" | "week" | "month") {
  const now = Date.now();
  if (range === "today") return ts >= startOfToday();
  if (range === "week") return ts >= now - 7 * 86_400_000;
  if (range === "month") return ts >= now - 30 * 86_400_000;
  return true;
}

function makeOffer(s: DriverState): OfferRecord {
  const from = s.profile.cityId;
  const to = rand.pick(CITIES.filter((c) => c.id !== from && ["smq", "bxr", "and", "nmn", "frg", "qrs"].includes(c.id)));
  const distanceKm = roadDistanceKm(from, to.id);
  const kind = rand.bool(0.25) ? "delivery" : "passengers";
  const n = kind === "passengers" ? rand.int(1, 3) : undefined;
  const price = computePrice(distanceKm, kind === "delivery" ? "car" : "seat", ["front", "back-left", "back-mid"].slice(0, n ?? 1));
  const now = Date.now();
  return {
    id: genId("ofr"),
    fromCityId: from,
    toCityId: to.id,
    pickupAddr: rand.pick(ADDR[from] ?? ["Markaz"]),
    dropoffAddr: rand.pick(ADDR[to.id] ?? ["Markaz"]),
    distanceKm,
    durationMin: Math.round((distanceKm / 75) * 60),
    pickupEtaMin: rand.int(3, 9),
    price,
    priceMax: Math.round((price * 1.15) / 1000) * 1000,
    passengerId: rand.pick(passengers).id,
    kind,
    passengers: n,
    cargo: kind === "delivery" ? rand.pick([{ labelKey: "cargo.box", weightKg: 8 }, { labelKey: "cargo.documents", weightKg: 1 }, { labelKey: "cargo.bags", weightKg: 15 }]) : undefined,
    payment: rand.bool(0.6) ? "cash" : "card",
    createdAt: now,
    expiresAt: now + OFFER_COUNTDOWN_SEC * 1000,
  };
}

function scheduleNextOffer(s: DriverState, minMs = 6000, maxMs = 11000) {
  s.nextOfferAt = Date.now() + minMs + Math.random() * (maxMs - minMs);
}

// ---------- review mechanism ----------

function submitForReview(kind: ReviewKind, payload?: Record<string, unknown>, delay: [number, number] = [2000, 4000]): ReviewRequest {
  const s = state();
  const now = Date.now();
  const req: ReviewRequest = {
    id: genId("rev"),
    kind,
    status: "pending",
    createdAt: now,
    resolvesAt: now + delay[0] + Math.random() * (delay[1] - delay[0]),
    payload,
  };
  s.reviews = [req, ...s.reviews.filter((r) => now - r.createdAt < 3_600_000)].slice(0, 40);
  persist();
  return req;
}

function finishTrip(s: DriverState, t: LiveTrip): TripSummary {
  const pct = commissionPctNow(s);
  const commission = Math.round((t.price * pct) / 100);
  const baseCommission = Math.round((t.price * BASE_COMMISSION_PCT) / 100);
  const now = Date.now();
  const rating = rand.bool(0.8) ? 5 : 4;
  const record: TripRecord = {
    id: t.id,
    createdAt: t.acceptedAt,
    fromCityId: t.fromCityId,
    toCityId: t.toCityId,
    pickupAddr: t.pickupAddr,
    dropoffAddr: t.dropoffAddr,
    distanceKm: t.distanceKm,
    durationMin: t.durationMin,
    passengerId: t.passengerId,
    kind: t.kind,
    passengers: t.passengers,
    cargo: t.cargo,
    payment: t.payment,
    gross: t.price,
    commissionPct: pct,
    commission,
    bonusDiscount: baseCommission - commission,
    net: t.price - commission,
    ratingReceived: rating,
    status: "completed",
    timeline: [...t.timeline, { stage: "completed", at: now }],
  };
  s.trips.unshift(record);
  for (const row of ledgerFor(record)) appendLedger(row.type, row.amount, row.descKey, row.descParams);
  const summary: TripSummary = {
    tripId: t.id,
    gross: t.price,
    commissionPct: pct,
    baseCommissionPct: BASE_COMMISSION_PCT,
    commission,
    baseCommission,
    commissionWaived: pct < BASE_COMMISSION_PCT,
    net: record.net,
    ratingReceived: rating,
    payment: t.payment,
  };
  s.summaries = { [t.id]: summary };
  s.trip = null;
  scheduleNextOffer(s, 9000, 14000);
  return summary;
}

/** Apply a review's effect exactly once, on approval. */
function applyReview(s: DriverState, r: ReviewRequest) {
  if (r.status !== "approved" || r.applied) return;
  r.applied = true;
  const p = r.payload ?? {};
  switch (r.kind) {
    case "otp_verify":
      s.session = { stage: s.registered ? "active" : "personal", phone: String(p.phone ?? "") };
      if (p.phone) s.profile.phoneMasked = maskPhone(String(p.phone));
      break;
    case "driver_registration": {
      const d = s.draft;
      if (d.name) s.profile.name = d.name;
      if (d.cityId) s.profile.cityId = d.cityId;
      if (d.car) s.profile.car = d.car;
      s.profile.documents = s.profile.documents.map((doc) => ({ ...doc, status: "approved" }));
      s.profile.rating = 5;
      s.profile.ratingCount = 0;
      s.profile.memberSinceYear = new Date().getFullYear();
      s.registered = true;
      s.session = { ...s.session, stage: "active" };
      pushNotification({ kind: "docs", titleKey: "notif.docs.title", bodyKey: "notif.docs.body" });
      break;
    }
    case "wallet_topup": {
      const amount = Number(p.amount);
      appendLedger("topup", amount, "ledger.desc.topup", { provider: p.provider === "click" ? "Click" : "Payme" });
      pushNotification({ kind: "wallet", titleKey: "notif.topup.title", bodyKey: "notif.topup.body", params: { amount } });
      break;
    }
    case "card_link":
      s.cards.push({ id: genId("card"), brand: rand.bool() ? "humo" : "uzcard", last4: String(rand.int(1000, 9999)), provider: p.provider === "click" ? "click" : "payme" });
      break;
    case "trip_step": {
      const t = s.trip;
      if (!t || t.id !== p.tripId) break;
      t.pendingReviewId = null;
      const now = Date.now();
      if (t.stage === "to_pickup") {
        t.stage = "waiting";
        t.timeline.push({ stage: "arrived", at: now });
      } else if (t.stage === "waiting") {
        t.stage = "in_progress";
        t.timeline.push({ stage: "started", at: now });
      } else {
        finishTrip(s, t);
        break;
      }
      t.stageStartedAt = now;
      break;
    }
    case "profile_change":
      if (p.field === "name" && typeof p.value === "string" && p.value.trim()) s.profile.name = p.value.trim();
      break;
    case "help_request": {
      const h = s.help.find((x) => x.id === p.helpId);
      if (h) h.status = "resolved";
      break;
    }
  }
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-9);
  return `+998 ${digits.slice(0, 2)} *** ** ${digits.slice(-2)}`;
}

function requireActive(s: DriverState) {
  if (s.session.stage !== "active") throw new ApiError("NOT_SIGNED_IN");
}

// ---------- adapter ----------

export const mockAdapter: ApiAdapter = {
  getSession: () => withLatency(() => ({ ...state().session }), { noFail: true }),

  getRegistrationOptions: () =>
    withLatency(() => ({
      cities: CITIES.map((c) => ({ id: c.id, name: c.name })),
      carModels: CAR_MODELS,
      carColors: CAR_COLORS,
      years: Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i),
      platePattern: "01 A 123 BC",
    })),

  requestOtp: (phone) =>
    withLatency(() => {
      const digits = phone.replace(/\D/g, "");
      if (digits.length !== 9) throw new ApiError("PHONE_INVALID");
      return { requestId: genId("otp") + ":" + digits, demoCode: DEMO_OTP, resendInSec: 30 };
    }),

  verifyOtp: (requestId, code) =>
    withLatency(() => {
      if (code !== DEMO_OTP) throw new ApiError("CODE_INVALID");
      return submitForReview("otp_verify", { phone: requestId.split(":")[1] ?? "" }, [900, 1400]);
    }),

  savePersonal: ({ name, cityId }) =>
    withLatency(() => {
      const s = state();
      if (name.trim().split(/\s+/).length < 2 || name.trim().length < 5) throw new ApiError("NAME_INVALID");
      if (!CITIES.some((c) => c.id === cityId)) throw new ApiError("CITY_REQUIRED");
      s.draft = { ...s.draft, name: name.trim(), cityId };
      s.session = { ...s.session, stage: "car" };
      persist();
      return { ...s.session };
    }),

  saveCar: ({ model, colorKey, plate, year }) =>
    withLatency(() => {
      const s = state();
      const normalized = plate.toUpperCase().replace(/\s+/g, " ").trim();
      // Uzbek plates: "01 A 123 BC" (private) or "01 123 ABC" (company).
      if (!/^\d{2} ([A-Z] \d{3} [A-Z]{2}|\d{3} [A-Z]{3})$/.test(normalized)) throw new ApiError("PLATE_INVALID");
      if (!model) throw new ApiError("MODEL_REQUIRED");
      if (!CAR_COLORS.some((c) => c.key === colorKey)) throw new ApiError("COLOR_REQUIRED");
      s.draft = { ...s.draft, car: { model, colorKey, plate: normalized, year } };
      s.session = { ...s.session, stage: "documents" };
      persist();
      return { ...s.session };
    }),

  submitDocuments: ({ licenseFile, registrationFile }) =>
    withLatency(() => {
      const s = state();
      if (!licenseFile || !registrationFile) throw new ApiError("DOCS_REQUIRED");
      s.profile.documents = [
        { kind: "license", status: "auto_review", fileName: licenseFile },
        { kind: "registration", status: "auto_review", fileName: registrationFile },
      ];
      const review = submitForReview("driver_registration", {}, [3000, 4000]);
      s.session = { ...s.session, stage: "review", documentsReviewId: review.id };
      persist();
      return review;
    }, { minMs: 400, maxMs: 700 }),

  logout: () =>
    withLatency(() => {
      const s = state();
      s.online = false;
      s.offer = null;
      s.session = { stage: "signed_out" };
      persist();
      return { ...s.session };
    }, { noFail: true }),

  getProfile: () =>
    withLatency<DriverProfile>(() => {
      const s = state();
      const p = s.profile;
      const color = CAR_COLORS.find((c) => c.key === p.car.colorKey) ?? CAR_COLORS[0];
      return {
        id: p.id,
        name: p.name,
        phoneMasked: p.phoneMasked,
        avatarSeed: p.avatarSeed,
        rating: p.rating,
        ratingCount: p.ratingCount,
        totalTrips: s.trips.filter((t) => t.status === "completed").length + 280,
        city: cityRef(p.cityId),
        car: { model: p.car.model, color: color.key, colorHex: color.hex, plate: p.car.plate, year: p.car.year },
        online: s.online,
        documents: p.documents,
        memberSinceYear: p.memberSinceYear,
      };
    }),

  getHomeSummary: () => withLatency(() => homeSummary(state())),

  setOnline: (online) =>
    withLatency(() => {
      const s = state();
      requireActive(s);
      s.online = online;
      if (online) scheduleNextOffer(s, 4000, 7000);
      else {
        s.offer = null;
        s.nextOfferAt = null;
      }
      persist();
      return homeSummary(s);
    }, { minMs: 250, maxMs: 450 }),

  getCurrentOffer: () =>
    withLatency(() => {
      const s = state();
      const now = Date.now();
      if (s.session.stage !== "active" || !s.online || s.trip || debtState(s).level === "blocked") return null;
      if (s.offer && now >= s.offer.expiresAt) {
        s.offer = null;
        scheduleNextOffer(s);
      }
      if (!s.offer) {
        if (s.nextOfferAt == null) scheduleNextOffer(s);
        else if (now >= s.nextOfferAt) {
          s.offer = makeOffer(s);
          s.nextOfferAt = null;
        }
      }
      persist();
      return s.offer ? toOffer(s.offer) : null;
    }, { minMs: 80, maxMs: 160 }),

  acceptOffer: (offerId) =>
    withLatency(() => {
      const s = state();
      if (debtState(s).level === "blocked") throw new ApiError("WALLET_LIMIT");
      const o = s.offer;
      if (!o || o.id !== offerId || Date.now() >= o.expiresAt) throw new ApiError("OFFER_EXPIRED");
      const now = Date.now();
      s.trip = { ...o, stage: "to_pickup", stageStartedAt: now, acceptedAt: now, pendingReviewId: null, timeline: [{ stage: "accepted", at: now }] };
      s.offer = null;
      s.nextOfferAt = null;
      persist();
      return toActiveTrip(s.trip);
    }, { minMs: 300, maxMs: 500 }),

  declineOffer: (offerId) =>
    withLatency(() => {
      const s = state();
      if (s.offer?.id === offerId) s.offer = null;
      scheduleNextOffer(s);
      persist();
    }, { minMs: 100, maxMs: 200, noFail: true }),

  getActiveTrip: () =>
    withLatency(() => {
      const s = state();
      if (s.trip?.pendingReviewId) {
        const r = s.reviews.find((x) => x.id === s.trip!.pendingReviewId);
        if (r && r.status === "pending" && Date.now() >= r.resolvesAt) {
          r.status = "approved";
          applyReview(s, r);
          persist();
        }
      }
      return s.trip ? toActiveTrip(s.trip) : null;
    }, { minMs: 100, maxMs: 250 }),

  advanceTrip: (tripId) =>
    withLatency(() => {
      const s = state();
      const t = s.trip;
      if (!t || t.id !== tripId) throw new ApiError("TRIP_NOT_FOUND");
      if (t.pendingReviewId) {
        const existing = s.reviews.find((r) => r.id === t.pendingReviewId);
        if (existing) return existing;
      }
      const review = submitForReview("trip_step", { tripId, from: t.stage }, [700, 1100]);
      t.pendingReviewId = review.id;
      persist();
      return review;
    }, { minMs: 150, maxMs: 300 }),

  getCancelReasons: () => withLatency(() => CANCEL_REASONS.map((key) => ({ key }))),

  cancelTrip: (tripId, reasonKey) =>
    withLatency(() => {
      const s = state();
      const t = s.trip;
      if (!t || t.id !== tripId) throw new ApiError("TRIP_NOT_FOUND");
      const now = Date.now();
      s.trips.unshift({
        id: t.id, createdAt: t.acceptedAt, fromCityId: t.fromCityId, toCityId: t.toCityId, pickupAddr: t.pickupAddr,
        dropoffAddr: t.dropoffAddr, distanceKm: t.distanceKm, durationMin: t.durationMin, passengerId: t.passengerId,
        kind: t.kind, passengers: t.passengers, cargo: t.cargo, payment: t.payment, gross: 0, commissionPct: 0,
        commission: 0, bonusDiscount: 0, net: 0, ratingReceived: null, status: "cancelled", cancelReasonKey: reasonKey,
        timeline: [...t.timeline, { stage: "cancelled", at: now }],
      });
      s.trip = null;
      scheduleNextOffer(s);
      persist();
    }),

  getTripSummary: (tripId) =>
    withLatency(() => {
      const sum = state().summaries[tripId];
      if (!sum) throw new ApiError("TRIP_NOT_FOUND");
      return sum;
    }, { noFail: true }),

  getHistory: (filter) =>
    withLatency<HistoryPage>(() => {
      const s = state();
      const q = filter.city.trim().toLocaleLowerCase();
      const items = s.trips
        .filter((t) => inRange(t.createdAt, filter.range))
        .filter((t) => t.net >= filter.minEarnings)
        .filter((t) => !q || cityName(t.fromCityId).toLocaleLowerCase().includes(q) || cityName(t.toCityId).toLocaleLowerCase().includes(q))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(toHistoryItem);
      return { items, total: items.length, filterOptions: { minEarnings: [0, 100_000, 200_000, 300_000], ranges: ["all", "today", "week", "month"] } };
    }),

  getTripDetail: (id) =>
    withLatency<TripDetail>(() => {
      const t = state().trips.find((x) => x.id === id);
      if (!t) throw new ApiError("TRIP_NOT_FOUND");
      return {
        ...toHistoryItem(t),
        pickup: { city: cityRef(t.fromCityId), address: t.pickupAddr },
        dropoff: { city: cityRef(t.toCityId), address: t.dropoffAddr },
        distanceKm: t.distanceKm,
        durationMin: t.durationMin,
        passenger: passengerInfo(t.passengerId),
        passengers: t.passengers,
        cargo: t.cargo,
        timeline: t.timeline,
        breakdown: { base: t.gross, commission: t.commission + t.bonusDiscount, commissionPct: BASE_COMMISSION_PCT, bonusDiscount: t.bonusDiscount, net: t.net },
        cancelReasonKey: t.cancelReasonKey,
      };
    }),

  getWallet: () =>
    withLatency<WalletSummary>(() => {
      const s = state();
      const today = todayTrips(s);
      const earnings = today.reduce((sum, t) => sum + t.net, 0);
      const pct = commissionPctNow(s);
      return {
        balance: s.balance,
        debt: debtState(s),
        today: { earnings, trips: today.length, avgPerTrip: today.length ? Math.round(earnings / today.length) : 0 },
        commission: { pct: BASE_COMMISSION_PCT, bonusPct: pct, bonusActive: pct < BASE_COMMISSION_PCT },
        cards: [...s.cards],
      };
    }),

  getLedger: ({ type, range, page }) =>
    withLatency<LedgerPage>(() => {
      const rows = state().ledger.filter((e) => (type === "all" || e.type === type) && inRange(e.createdAt, range));
      const pageCount = Math.max(1, Math.ceil(rows.length / LEDGER_PAGE_SIZE));
      const p = Math.min(Math.max(1, page), pageCount);
      return { items: rows.slice(0, p * LEDGER_PAGE_SIZE), page: p, pageCount, total: rows.length };
    }),

  getTopupOptions: () =>
    withLatency<TopupOptions>(() => ({ presets: [10_000, 25_000, 50_000, 100_000], min: 5_000, max: 5_000_000, providers: ["payme", "click"] })),

  requestTopup: (amount, provider) =>
    withLatency(() => {
      if (!Number.isFinite(amount) || amount < 5_000) throw new ApiError("AMOUNT_TOO_SMALL");
      if (amount > 5_000_000) throw new ApiError("AMOUNT_TOO_LARGE");
      return submitForReview("wallet_topup", { amount, provider });
    }, { minMs: 300, maxMs: 600 }),

  linkCard: (provider) => withLatency(() => submitForReview("card_link", { provider }), { minMs: 300, maxMs: 600 }),

  getBonus: () =>
    withLatency<BonusInfo>(() => {
      const s = state();
      const wt = weekTrips(s);
      const current = levelFor(wt);
      const idx = BONUS_LEVELS.findIndex((l) => l.key === current.key);
      const next = BONUS_LEVELS[idx + 1] ?? null;
      const top = BONUS_LEVELS[BONUS_LEVELS.length - 1];
      const weekStart = Date.now() - 7 * 86_400_000;
      const saved = s.trips.filter((t) => t.createdAt >= weekStart).reduce((sum, t) => sum + t.bonusDiscount, 0);
      const cancels = s.trips.filter((t) => t.createdAt >= weekStart && t.status === "cancelled").length;
      return {
        active: current.commissionPct < BASE_COMMISSION_PCT,
        currentLevel: { ...current },
        nextLevel: next ? { ...next } : null,
        levels: BONUS_LEVELS.map((l) => ({ ...l })),
        weekTrips: wt,
        progressRatio: Math.min(1, wt / top.tripsRequired),
        tripsToNext: next ? next.tripsRequired - wt : 0,
        commissionPct: current.commissionPct,
        baseCommissionPct: BASE_COMMISSION_PCT,
        rules: [
          { key: "bonus.rule.trips", progress: Math.min(wt, top.tripsRequired), target: top.tripsRequired, done: wt >= top.tripsRequired },
          { key: "bonus.rule.rating", progress: Math.round(s.profile.rating * 10), target: 48, done: s.profile.rating >= 4.8 },
          { key: "bonus.rule.cancels", progress: cancels, target: 2, done: cancels < 2 },
        ],
        savedThisWeek: saved,
        resetsInDays: 7 - new Date().getDay() || 7,
      };
    }),

  requestProfileChange: (field, value) =>
    withLatency(() => {
      if (!value.trim()) throw new ApiError("VALUE_REQUIRED");
      return submitForReview("profile_change", { field, value });
    }),

  getNotifications: () => withLatency(() => state().notifications.map((n) => ({ ...n }))),

  markAllNotificationsRead: () =>
    withLatency(() => {
      state().notifications.forEach((n) => (n.read = true));
      persist();
    }, { noFail: true }),

  getNotificationPrefs: () => withLatency(() => ({ ...state().prefs })),

  setNotificationPrefs: (prefs) =>
    withLatency(() => {
      state().prefs = { ...prefs };
      persist();
      return { ...prefs };
    }, { minMs: 120, maxMs: 260 }),

  getHelpRequests: () => withLatency(() => state().help.map((h) => ({ ...h }))),

  submitHelpRequest: (topic, message) =>
    withLatency(() => {
      const s = state();
      const id = genId("help");
      s.help.unshift({ id, topic, message, createdAt: Date.now(), status: "in_review" });
      const r = submitForReview("help_request", { helpId: id });
      persist();
      return r;
    }),

  getAppInfo: () => withLatency(() => ({ version: "2.0.0", build: "2026.11" }), { noFail: true }),

  getReviewStatus: (reviewId) =>
    withLatency(() => {
      const s = state();
      const r = s.reviews.find((x) => x.id === reviewId);
      if (!r) throw new ApiError("REVIEW_NOT_FOUND");
      if (r.status === "pending" && Date.now() >= r.resolvesAt) r.status = "approved";
      applyReview(s, r);
      persist();
      return { ...r };
    }, { minMs: 120, maxMs: 260, noFail: true }),

  demoApplyPreset: (preset) =>
    withLatency(() => {
      replaceState(presetState(preset));
    }, { noFail: true, minMs: 100, maxMs: 200 }),

  demoTriggerOffer: () =>
    withLatency(() => {
      const s = state();
      requireActive(s);
      if (s.trip) throw new ApiError("TRIP_ACTIVE");
      s.online = true;
      s.offer = makeOffer(s);
      s.nextOfferAt = null;
      persist();
    }, { noFail: true, minMs: 80, maxMs: 120 }),

  demoTripAtStage: (stage) =>
    withLatency(() => {
      const s = state();
      requireActive(s);
      const o = makeOffer(s);
      const now = Date.now();
      const timeline: LiveTrip["timeline"] = [{ stage: "accepted", at: now - 9 * 60_000 }];
      if (stage !== "to_pickup") timeline.push({ stage: "arrived", at: now - 3 * 60_000 });
      if (stage === "in_progress") timeline.push({ stage: "started", at: now - 60_000 });
      s.online = true;
      s.offer = null;
      s.nextOfferAt = null;
      s.trip = { ...o, stage, stageStartedAt: now, acceptedAt: now - 9 * 60_000, pendingReviewId: null, timeline };
      persist();
    }, { noFail: true, minMs: 80, maxMs: 120 }),
};
