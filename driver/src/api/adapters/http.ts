// Real-backend adapter for the driver app (api/openapi.yml). Same interface
// as the mock adapter; field conversions live in ../httpMapper.ts.
// Features with no endpoint in the contract are switched off in
// `capabilities` and reject with NOT_SUPPORTED instead of being faked
// (docs/backend-gaps/driver.md).
import { API_PATHS } from "@shared/api/openapi";
import type * as Api from "@shared/api/openapi";
import { ApiError } from "@shared/http/errors";
import type { ApiAdapter, ApiCapabilities, ServerEvent } from "../adapterTypes";
import type {
  AcceptedPage,
  Booking,
  DocSlot,
  HomeSummary,
  LedgerEntry,
  NotificationItem,
  NotificationPrefs,
  ReviewKind,
  ReviewRequest,
  RideRequest,
  Session,
  SessionStage,
} from "../types";
import { session } from "../httpSession";
import {
  mapFieldError,
  offerToRequest,
  REG_CAR_CLASSES,
  REG_CAR_COLORS,
  REG_CAR_MODELS,
  REG_CITIES,
  REG_SEAT_COUNTS,
  safeRedirect,
  splitCarModel,
  splitName,
  toApiPhone,
  toApiPlate,
  toDebtState,
  toDriverProfile,
  toLedgerEntry,
  toNotification,
  toTiyin,
  tripToBooking,
} from "../httpMapper";
import { version as appVersion } from "../../../package.json";

const { http } = session;

const notSupported = (): Promise<never> => Promise.reject(new ApiError("NOT_SUPPORTED"));

const capabilities: ApiCapabilities = {
  routes: false,
  rejectRequest: false,
  feedFilters: false,
  seatSummary: false,
  arrivedStep: false,
  cancelBooking: false,
  tripChat: false,
  tripSummary: false,
  history: false,
  bonus: false,
  help: false,
  driverCapabilities: false,
  profileChangePhone: false,
  profileChangeCar: false,
  requestAlerts: false,
  ledgerFilters: false,
  notificationCategories: false,
  locationReporting: true,
};

// ------------------------------------------------------ settled "reviews"
// The real backend answers synchronously, so review-shaped results are
// already decided. The registration review is the exception: it follows
// GET /drivers/me/status.
const REGISTRATION_REVIEW_ID = "registration";
const reviews = new Map<string, ReviewRequest>();
let reviewSeq = 0;

function settled(kind: ReviewKind, status: ReviewRequest["status"], extra: Partial<ReviewRequest> = {}): ReviewRequest {
  const now = Date.now();
  const r: ReviewRequest = { id: `r${++reviewSeq}`, kind, status, createdAt: now, resolvesAt: now, ...extra };
  reviews.set(r.id, r);
  return r;
}

// -------------------------------------------------------------- tab state
// Kept in memory for this tab only (cleared on logout / session end).
const otpPhones = new Map<string, string>();
/** Trips accepted in this tab: the contract has no "my trips" list. */
const trips = new Map<string, { booking: Booking; offer: RideRequest }>();
/** Last offers seen, so an accepted trip can show where it goes. */
const lastOffers = new Map<string, RideRequest>();
/** Registration step reached in this tab (no GET for progress). */
let registrationStage: SessionStage | null = null;
let lastNotifications: NotificationItem[] = [];
let statusCache: { at: number; value: Api.DriverStatus } | null = null;
let ledgerPages: { cursors: (string | null)[]; items: LedgerEntry[][] } = { cursors: [], items: [] };

function clearTabState() {
  otpPhones.clear();
  trips.clear();
  lastOffers.clear();
  reviews.clear();
  registrationStage = null;
  lastNotifications = [];
  statusCache = null;
  ledgerPages = { cursors: [], items: [] };
}

// ----------------------------------------------------- events & session end
const eventListeners = new Set<(e: ServerEvent) => void>();
const endListeners = new Set<() => void>();
const emit = (type: ServerEvent["type"]) => eventListeners.forEach((l) => l({ type }));

session.onEnd((reason) => {
  clearTabState();
  if (reason !== "logout") endListeners.forEach((l) => l());
});

session.realtime?.subscribe((event) => {
  switch (event.type) {
    case "offer.created":
      emit("feed");
      break;
    case "order.accepted":
      emit("trips");
      break;
    case "trip.completed": {
      const t = trips.get(event.id);
      if (t) trips.delete(event.id);
      emit("trips");
      emit("wallet");
      break;
    }
    case "wallet.limit_reached":
      emit("wallet");
      break;
    case "driver.approved":
      statusCache = null;
      emit("session");
      break;
    default:
      break;
  }
});

// ----------------------------------------------------------------- session
async function driverStatus(maxAgeMs = 0): Promise<Api.DriverStatus> {
  if (statusCache && Date.now() - statusCache.at < maxAgeMs) return statusCache.value;
  try {
    const value = await http.get<Api.DriverStatus>(API_PATHS.driverStatus);
    statusCache = { at: Date.now(), value };
    return value;
  } catch (err) {
    // A phone that never started registration has no driver record yet.
    if (err instanceof ApiError && (err.code === "DRIVER_NOT_FOUND" || err.code === "NOT_FOUND")) {
      return { state: "draft", updated_at: new Date().toISOString() };
    }
    throw err;
  }
}

function stageFromStep(state: Api.RegistrationState): SessionStage {
  if (state.state === "pending_review") return "review";
  if (state.state === "active") return "active";
  if (state.state === "blocked") return "blocked";
  return state.current_step <= 1 ? "personal" : state.current_step === 2 ? "car" : "documents";
}

async function currentSession(): Promise<Session> {
  if (!session.hasSession()) return { stage: "signed_out" };
  if (!(await session.resume())) return { stage: "signed_out" };
  const status = await driverStatus();
  switch (status.state) {
    case "active":
      return { stage: "active" };
    case "pending_review":
      return { stage: "review", documentsReviewId: REGISTRATION_REVIEW_ID };
    case "blocked":
      return { stage: "blocked" };
    case "rejected":
      return { stage: registrationStage ?? "personal", notice: "rejected" };
    case "draft":
    default:
      return { stage: registrationStage ?? "personal" };
  }
}

async function registrationStep(step: 1 | 2 | 3 | 4, body: unknown): Promise<Session> {
  try {
    const state = await http.post<Api.RegistrationState>(API_PATHS.driverRegistrationStep(step), body);
    statusCache = null;
    registrationStage = stageFromStep(state);
    return registrationStage === "review" ? { stage: "review", documentsReviewId: REGISTRATION_REVIEW_ID } : { stage: registrationStage };
  } catch (err) {
    throw mapFieldError(err);
  }
}

const DOC_KIND: Record<DocSlot, Api.DocumentKind> = { license: "license_front", registration: "tech_passport_front", selfie: "selfie" };
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // UploadUrlRequest.size_bytes maximum

// -------------------------------------------------------------- summaries
let summaryCache: { at: number; value: HomeSummary } | null = null;

async function homeSummary(): Promise<HomeSummary> {
  if (summaryCache && Date.now() - summaryCache.at < 5000) return summaryCache.value;
  const [balance, notifications] = await Promise.all([
    http.get<Api.WalletBalance>(API_PATHS.walletBalance),
    http.get<Api.NotificationPage>(API_PATHS.notifications, { limit: 50 }),
  ]);
  const value: HomeSummary = {
    // Not in the contract; not shown in http mode.
    todayEarnings: 0,
    todayTrips: 0,
    bonusActive: false,
    newRequests: 0,
    // Unread on the first page (the contract has no unread count).
    unreadNotifications: notifications.data.filter((n) => !n.read).length,
    debt: toDebtState(balance),
    canAcceptOrders: !balance.limit_reached,
    tripActive: [...trips.values()].some((t) => t.booking.stage !== "completed"),
  };
  summaryCache = { at: Date.now(), value };
  return value;
}

const PREFS_ASKED_KEY = "izgo_driver_notify_asked";
function readAsked(): boolean {
  try {
    return localStorage.getItem(PREFS_ASKED_KEY) === "1";
  } catch {
    return false;
  }
}
function writeAsked(v: boolean) {
  try {
    if (v) localStorage.setItem(PREFS_ASKED_KEY, "1");
    else localStorage.removeItem(PREFS_ASKED_KEY);
  } catch {
    /* storage unavailable */
  }
}

function prefsFrom(settings: Api.Settings | undefined): NotificationPrefs {
  const master = settings?.notifications?.push ?? true;
  const news = settings?.notifications?.promo ?? false;
  // Only push (master) and promo (news) exist in the contract; the other
  // switches are hidden in http mode and follow the master switch.
  return { master, newOrders: master, payments: master, news, bonus: news, systemAsked: readAsked() };
}

// ------------------------------------------------------------------ adapter
export const httpAdapter: ApiAdapter = {
  capabilities,
  subscribe(listener) {
    eventListeners.add(listener);
    return () => eventListeners.delete(listener);
  },
  onSessionEnd(listener) {
    endListeners.add(listener);
    return () => endListeners.delete(listener);
  },

  // ---------- session & registration ----------
  getSession: () => currentSession(),

  getRegistrationOptions: async () => ({
    cities: REG_CITIES,
    carModels: REG_CAR_MODELS,
    carColors: REG_CAR_COLORS,
    years: Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i),
    platePattern: "01 A 123 BC",
    askBirthDate: true,
    carClasses: REG_CAR_CLASSES,
    seatCounts: REG_SEAT_COUNTS,
    realDocuments: true,
  }),

  async requestOtp(phone) {
    const apiPhone = toApiPhone(phone);
    try {
      const res = await http.post<Api.OtpRequestResult>(API_PATHS.otpRequest, { phone: apiPhone }, { auth: false });
      const requestId = `otp${++reviewSeq}`;
      otpPhones.set(requestId, apiPhone);
      return { requestId, resendInSec: res.resend_after };
    } catch (err) {
      throw mapFieldError(err);
    }
  },

  async verifyOtp(requestId, code) {
    const phone = otpPhones.get(requestId);
    if (!phone) throw new ApiError("AUTH_OTP_EXPIRED");
    let pair: Api.TokenPair;
    try {
      pair = await http.post<Api.TokenPair>(API_PATHS.otpVerify, { phone, code }, { auth: false });
    } catch (err) {
      throw mapFieldError(err);
    }
    otpPhones.delete(requestId);
    session.signIn(pair);
    return settled("otp_verify", "approved");
  },

  async savePersonal({ name, cityId, birthDate }) {
    const city = REG_CITIES.find((c) => c.id === cityId)?.name;
    if (!city) throw new ApiError("CITY_REQUIRED");
    return registrationStep(1, { ...splitName(name), birth_date: birthDate || undefined, city });
  },

  async saveCar({ model, colorKey, plate, year, carClass, seats }) {
    const car: Partial<Api.Car> = {
      ...splitCarModel(model),
      year,
      color: colorKey || undefined,
      plate_number: toApiPlate(plate) || undefined,
      car_class: carClass,
      seats,
    };
    return registrationStep(2, { car });
  },

  async uploadDocument(slot, file) {
    if (!file) throw new ApiError("DOCS_REQUIRED");
    if (file.type !== "image/jpeg" && file.type !== "image/png") throw new ApiError("FILE_TYPE_INVALID");
    if (file.size > MAX_UPLOAD_BYTES) throw new ApiError("FILE_TOO_LARGE");
    const target = await http.post<Api.UploadUrl>(API_PATHS.driverDocumentUploadUrl, {
      kind: DOC_KIND[slot],
      content_type: file.type,
      size_bytes: file.size,
    });
    await http.uploadFile(target.upload_url, file, target.headers);
    return { ref: target.document_id, name: file.name };
  },

  async submitDocuments({ licenseFile, registrationFile, selfieFile, acceptTerms }) {
    if (!acceptTerms) throw new ApiError("TERMS_REQUIRED");
    const documents = (
      [
        ["license", licenseFile],
        ["registration", registrationFile],
        ["selfie", selfieFile],
      ] as const
    )
      .filter(([, id]) => !!id)
      .map(([slot, id]) => ({ kind: DOC_KIND[slot], document_id: id as string }));
    await registrationStep(3, { documents });
    await registrationStep(4, { accept_terms: true });
    return { ...settled("driver_registration", "pending"), id: REGISTRATION_REVIEW_ID };
  },

  async logout() {
    await session.logout();
    return { stage: "signed_out" };
  },

  reportLocation: (lat, lng) => http.post<void>(API_PATHS.locationUpdate, { lat, lng }),

  // ---------- routes: no endpoint ----------
  getRoutes: notSupported,
  addRoute: notSupported,
  setRouteBothWays: notSupported,
  removeRoute: notSupported,
  completeRoutesSetup: async () => currentSession(),

  // ---------- home ----------
  getProfile: async () => toDriverProfile(await http.get<Api.DriverProfile>(API_PATHS.driverMe)),
  getHomeSummary: () => homeSummary(),

  async getFeed() {
    const page = await http.get<Api.OfferPage>(API_PATHS.tripOffers, { limit: 50 });
    const items = page.data.map(offerToRequest);
    lastOffers.clear();
    for (const r of items) lastOffers.set(r.id, r);
    return { items, seats: null, directions: [], dates: [] };
  },
  markFeedSeen: async () => {},
  getRejectReasons: async () => [],
  rejectRequest: notSupported,

  async acceptRequest(requestId) {
    let trip: Api.Trip;
    try {
      trip = await http.post<Api.Trip>(API_PATHS.tripOfferAccept(requestId));
    } catch (err) {
      if (err instanceof ApiError && err.code === "ORDER_ALREADY_TAKEN") return settled("request_accept", "rejected", { resultKey: "request.taken" });
      throw err;
    }
    const offer = lastOffers.get(requestId);
    if (offer) {
      const acceptedAt = Date.now();
      trips.set(trip.id, { booking: tripToBooking(trip, offer, acceptedAt), offer });
    }
    summaryCache = null;
    return settled("request_accept", "approved");
  },
  takeRequestAlerts: async () => [],

  // ---------- accepted trips (this tab only) ----------
  async getAccepted(): Promise<AcceptedPage> {
    const bookings = [...trips.values()].map((t) => t.booking).filter((b) => b.stage !== "completed");
    return {
      count: bookings.length,
      days: bookings.length
        ? [
            {
              date: "",
              dayOffset: 0,
              dayStart: 0,
              undated: true,
              trips: bookings.map((b) => ({
                direction: { id: b.id, from: b.pickup.city, to: b.dropoff.city },
                seats: { used: b.seats, total: 0 },
                bookings: [b],
              })),
            },
          ]
        : [],
    };
  },

  async advanceBooking(bookingId) {
    const entry = trips.get(bookingId);
    if (!entry) throw new ApiError("TRIP_NOT_FOUND");
    const action = entry.booking.nextAction;
    if (action !== "start" && action !== "finish") throw new ApiError("FORBIDDEN");
    const trip = await http.post<Api.Trip>(action === "start" ? API_PATHS.tripStart(bookingId) : API_PATHS.tripComplete(bookingId));
    const booking = tripToBooking(trip, entry.offer, entry.booking.acceptedAt);
    if (booking.stage === "completed") trips.delete(bookingId);
    else trips.set(bookingId, { ...entry, booking });
    summaryCache = null;
    return settled("trip_step", "approved");
  },
  getCancelReasons: async () => [],
  cancelBooking: notSupported,
  getTripSummary: notSupported,
  getTripChat: notSupported,
  sendTripMessage: notSupported,

  // ---------- history: no driver endpoint ----------
  getHistory: notSupported,
  getTripDetail: notSupported,

  // ---------- wallet ----------
  async getWallet() {
    const b = await http.get<Api.WalletBalance>(API_PATHS.walletBalance);
    const debt = toDebtState(b);
    return { balance: debt.balance, debt };
  },

  async getLedger({ page }) {
    // Cursor pages behind the screen's "load more": page n needs page n-1's cursor.
    if (page <= 1) ledgerPages = { cursors: [], items: [] };
    for (let i = ledgerPages.items.length; i < page; i++) {
      const cursor = i === 0 ? undefined : ledgerPages.cursors[i - 1];
      if (i > 0 && !cursor) break;
      const res = await http.get<Api.LedgerPage>(API_PATHS.walletLedger, { cursor, limit: 20 });
      ledgerPages.items[i] = res.data.map(toLedgerEntry);
      ledgerPages.cursors[i] = res.cursor;
    }
    const loaded = ledgerPages.items.length;
    const more = !!ledgerPages.cursors[loaded - 1];
    return { items: ledgerPages.items.flat(), page: loaded, pageCount: more ? loaded + 1 : loaded };
  },

  // Limits from the TopupRequest schema (100 000 – 1 000 000 000 tiyin);
  // providers from its enum. The presets are just quick-pick buttons.
  getTopupOptions: async () => ({ presets: [20_000, 50_000, 100_000, 200_000], min: 1_000, max: 10_000_000, providers: ["payme", "click"] }),

  async requestTopup(amount, provider) {
    const body: Api.TopupRequest = { amount: toTiyin(amount), provider };
    const res = await session.idempotency
      .run("walletTopup", body, (key) => http.post<Api.TopupSession>(API_PATHS.walletTopup, body, { idempotencyKey: key }))
      .catch((err) => Promise.reject(mapFieldError(err)));
    return settled("wallet_topup", "pending", { redirectUrl: safeRedirect(res.redirect_url) });
  },

  async linkCard(provider) {
    const res = await http.post<Api.CardLinkSession>(API_PATHS.walletCardLink, { provider });
    return settled("card_link", "pending", { redirectUrl: safeRedirect(res.redirect_url) });
  },

  // ---------- profile ----------
  getBonus: notSupported,

  async requestProfileChange(field, value) {
    if (field !== "name") return notSupported();
    try {
      await http.put<Api.DriverProfile>(API_PATHS.driverMe, splitName(value));
    } catch (err) {
      throw mapFieldError(err);
    }
    return settled("profile_change", "approved");
  },

  async getNotifications() {
    const page = await http.get<Api.NotificationPage>(API_PATHS.notifications, { limit: 50 });
    lastNotifications = page.data.map(toNotification);
    return lastNotifications;
  },

  async markAllNotificationsRead() {
    // No bulk endpoint: one PUT per unread item from the last fetched page.
    const unread = lastNotifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => http.put<void>(API_PATHS.notificationRead(n.id))));
    lastNotifications = lastNotifications.map((n) => ({ ...n, read: true }));
    summaryCache = null;
  },

  async getNotificationPrefs() {
    const profile = await http.get<Api.Profile>(API_PATHS.profile);
    return prefsFrom(profile.settings);
  },

  async setNotificationPrefs(prefs) {
    writeAsked(!!prefs.systemAsked);
    const saved = await http.put<Api.Settings>(API_PATHS.profileSettings, { notifications: { push: prefs.master, promo: prefs.news } });
    return prefsFrom(saved);
  },

  getHelpRequests: notSupported,
  submitHelpRequest: notSupported,
  getAppInfo: async () => ({ version: appVersion, build: "web" }),
  getCapabilities: notSupported,
  setCapabilities: notSupported,

  async getReviewStatus(reviewId) {
    if (reviewId === REGISTRATION_REVIEW_ID) {
      // Screens poll fast; ask the server at most every 10 s.
      const s = await driverStatus(10_000);
      const status = s.state === "active" ? "approved" : s.state === "rejected" || s.state === "blocked" ? "rejected" : "pending";
      return { id: reviewId, kind: "driver_registration", status, createdAt: 0, resolvesAt: 0 };
    }
    const r = reviews.get(reviewId);
    if (!r) throw new ApiError("NOT_FOUND");
    return r;
  },
};

/** Picked by the `@active-adapter` alias unless VITE_DEMO_MODE=true. */
export const adapter = httpAdapter;
