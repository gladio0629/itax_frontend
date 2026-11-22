// Real-backend adapter for the driver app (api/openapi.yml). Same interface
// as the mock adapter; field conversions live in ../httpMapper.ts.
// Features with no endpoint in the contract are switched off in
// `capabilities` and reject with NOT_SUPPORTED instead of being faked
// (docs/backend-gaps/driver.md). Every verdict (next trip step, cancel
// allowed, prices, commission) is the server's; nothing is inferred here.
import { API_PATHS } from "@shared/api/openapi";
import type * as Api from "@shared/api/openapi";
import { ApiError } from "@shared/http/errors";
import type { ApiAdapter, ApiCapabilities, ServerEvent } from "../adapterTypes";
import type {
  AcceptedPage,
  CityRef,
  DocSlot,
  RegistrationSectionKey,
  RegistrationSectionStatus,
  DriverRoute,
  HomeSummary,
  LedgerEntry,
  NotificationItem,
  NotificationPrefs,
  ReviewKind,
  ReviewRequest,
  RoutesPage,
  Session,
  SessionStage,
  TopupOptions,
} from "../types";
import { session } from "../httpSession";
import {
  type ApiCargoCapabilities,
  CANCEL_REASON_KEY,
  type CityNames,
  mapFieldError,
  mapRoutesError,
  offerToRequest,
  reasonFromKey,
  REG_CAR_CLASSES,
  REG_CAR_COLORS,
  REG_CAR_BRANDS,
  REG_LICENSE_CATEGORIES,
  REG_CITIES,
  REG_SEAT_COUNTS,
  REJECT_REASON_KEY,
  safeRedirect,
  splitName,
  toApiCapabilities,
  toApiPhone,
  toApiPlate,
  toCapabilities,
  toDebtState,
  toSom,
  toDriverProfile,
  toLedgerEntry,
  toNotification,
  toRoutesInput,
  toRoutesPage,
  toTiyin,
  stepActionOf,
  tripToBooking,
  tripToDetail,
  tripToHistoryItem,
} from "../httpMapper";
import { version as appVersion } from "../../../package.json";

const { http } = session;

const notSupported = (): Promise<never> => Promise.reject(new ApiError("NOT_SUPPORTED"));

const capabilities: ApiCapabilities = {
  routes: true,
  rejectRequest: true,
  // GET /trips/offers has no query params.
  feedFilters: false,
  seatSummary: false,
  arrivedStep: true,
  cancelBooking: true,
  tripChat: false,
  // Trip has final_price and commission, but no commission % or bonus.
  tripSummary: false,
  history: true,
  // GET /trips/history has only cursor/limit and no total.
  historyFilters: false,
  profileMatching: false,
  bonus: false,
  help: false,
  // The contract's capabilities are wishes (removed 2026-11-22); the cargo sizes endpoint isn't there yet.
  driverCapabilities: false,
  profileChangePhone: false,
  profileChangeCar: false,
  requestAlerts: false,
  ledgerFilters: false,
  notificationCategories: false,
  locationReporting: true,
  // No endpoints yet (docs/backend-gaps/driver.md, "Redesign v2").
  ratePassenger: false,
  sos: false,
  // No account-deletion endpoint yet: Sozlamalar links to the site's page instead.
  deleteAccount: false,
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
/** The last GET /trips answer (active trips with their order). A read cache
 * only: the step a button sends is the one the screen showed from it. */
let activeTrips = new Map<string, Api.TripWithOrder>();
/** Per trip id, the server action behind the step button getAccepted last returned. */
let shownSteps = new Map<string, Api.TripAction>();
/** Registration step reached in this tab (no GET for progress). */
let registrationStage: SessionStage | null = null;
let lastNotifications: NotificationItem[] = [];
let statusCache: { at: number; value: Api.DriverStatus } | null = null;
let ledgerPages: { cursors: (string | null)[]; items: LedgerEntry[][] } = { cursors: [], items: [] };
let historyPages: { cursors: (string | null)[]; items: Api.TripWithOrder[][] } = { cursors: [], items: [] };
let summaryCache: { at: number; value: HomeSummary } | null = null;
/** The driver's car from the last GET /drivers/me (shown read-only in "Imkoniyatlarim"). */
let lastCar: Api.Car | undefined;

function clearTabState() {
  otpPhones.clear();
  activeTrips = new Map();
  shownSteps = new Map();
  reviews.clear();
  registrationStage = null;
  lastNotifications = [];
  statusCache = null;
  summaryCache = null;
  ledgerPages = { cursors: [], items: [] };
  historyPages = { cursors: [], items: [] };
  lastCar = undefined;
}

// ----------------------------------------------------- events & session end
const eventListeners = new Set<(e: ServerEvent) => void>();
const endListeners = new Set<() => void>();
const emit = (e: ServerEvent) => eventListeners.forEach((l) => l(e));

session.onEnd((reason) => {
  clearTabState();
  if (reason !== "logout") endListeners.forEach((l) => l());
});

// onlyback/docs/websocket-events.md, "What the app should do" (driver rows).
// Order status events go to the passenger only; unknown types are ignored.
session.realtime?.subscribe((event) => {
  switch (event.type) {
    case "offer.created":
      emit({ type: "feed" });
      break;
    case "trip.cancelled":
      // An operator cancelled the order this driver had: re-read GET /trips.
      activeTrips.delete(event.id);
      shownSteps.delete(event.id);
      historyPages = { cursors: [], items: [] };
      summaryCache = null;
      emit({ type: "trips", noticeKey: "trip.cancelledByOperator" });
      break;
    case "wallet.limit_reached":
      summaryCache = null;
      emit({ type: "wallet" });
      break;
    case "driver.approved":
      statusCache = null;
      emit({ type: "session" });
      break;
    default:
      break;
  }
});

// ------------------------------------------------------------------ cities
// GET /api/v1/cities is public; read once per tab (a failed read is retried next time).
let citiesPromise: Promise<Api.City[]> | null = null;
function cityCatalogue(): Promise<Api.City[]> {
  citiesPromise ??= http.request<Api.CityList>("GET", API_PATHS.cities, { auth: false }).then(
    (r) => r.data,
    (err) => {
      citiesPromise = null;
      throw err;
    }
  );
  return citiesPromise;
}
const cityRefs = async (): Promise<CityRef[]> => (await cityCatalogue()).map((c) => ({ id: c.id, name: c.name }));
/** For display only: without the catalogue, places fall back to their address line. */
async function cityNames(): Promise<CityNames> {
  try {
    return new Map((await cityCatalogue()).map((c) => [c.id, c.name]));
  } catch {
    return new Map();
  }
}

// ------------------------------------------------------------------- trips
async function readActiveTrips(): Promise<Api.TripWithOrder[]> {
  const page = await http.get<Api.TripPage>(API_PATHS.trips, { status: "assigned,in_progress", limit: 50 });
  activeTrips = new Map(page.data.map((t) => [t.id, t]));
  return page.data;
}

/** 403 `trip_started` gets its own message; other errors pass through. */
function mapTripError(err: unknown): unknown {
  if (err instanceof ApiError && err.code === "FORBIDDEN" && err.params.reason === "trip_started") {
    return new ApiError("TRIP_STARTED", "TRIP_STARTED", { params: err.params, status: err.status });
  }
  return mapFieldError(err);
}

/** Cursor pages of GET /trips/history behind "load more". */
async function loadHistory(pages: number): Promise<void> {
  for (let i = historyPages.items.length; i < pages; i++) {
    const cursor = i === 0 ? undefined : historyPages.cursors[i - 1];
    if (i > 0 && !cursor) break;
    const res = await http.get<Api.TripPage>(API_PATHS.tripsHistory, { cursor, limit: 20 });
    historyPages.items[i] = res.data;
    historyPages.cursors[i] = res.cursor;
  }
}
const historyMore = () => !!historyPages.cursors[historyPages.items.length - 1];

// ------------------------------------------------------------------ routes
async function readRoutes(): Promise<RoutesPage> {
  const [r, cities] = await Promise.all([http.get<Api.DriverRoutes>(API_PATHS.driverRoutes), cityRefs()]);
  return toRoutesPage(r, cities);
}

/** PUT replaces the whole set and issues new ids: always answer with its response. */
async function putRoutes(routes: DriverRoute[], cities: CityRef[]): Promise<RoutesPage> {
  try {
    return toRoutesPage(await http.put<Api.DriverRoutes>(API_PATHS.driverRoutes, toRoutesInput(routes)), cities);
  } catch (err) {
    throw mapRoutesError(err);
  }
}

/** Fresh list, then the route the screen pointed at (ids change on every PUT). */
async function routesWith(routeId: string): Promise<{ page: RoutesPage; index: number }> {
  const page = await readRoutes();
  const index = page.routes.findIndex((r) => r.id === routeId);
  if (index < 0) throw new ApiError("ROUTE_NOT_FOUND");
  return { page, index };
}

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
  // The server's steps are personal → car → documents → terms; the screens go
  // personal → license → car → selfie (the licence photos and details are
  // sent with the later steps, see saveLicense).
  return state.current_step <= 1 ? "personal" : state.current_step === 2 ? "car" : "selfie";
}

async function currentSession(): Promise<Session> {
  if (!session.hasSession()) return { stage: "signed_out" };
  if (!(await session.resume())) return { stage: "signed_out" };
  const status = await driverStatus();
  switch (status.state) {
    case "active":
      // Routes are optional on the server (0..10), so an active driver goes straight in;
      // Yo'nalishlarim is edited from the profile.
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

const DOC_KIND: Record<DocSlot, Exclude<Api.DocumentKind, "avatar">> = {
  license_front: "license_front",
  license_back: "license_back",
  tech_passport_front: "tech_passport_front",
  tech_passport_back: "tech_passport_back",
  car_photo: "car_photo",
  selfie: "selfie",
};
/** Uploaded document ids kept until registration step 3 sends them all
 * (licence → car → selfie screens; the server takes documents in one step).
 * Memory only: a reload restarts registration at step 1, as before. */
const pendingDocs = new Map<DocSlot, string>();

/**
 * Calls an endpoint the backend doesn't have yet (docs/backend-gaps/driver.md,
 * "Redesign v2"). Only "route missing" (404 / 405 / 501) is swallowed and
 * gives `fallback`; validation errors, 5xx and network errors still throw.
 */
async function optionalEndpoint<T>(call: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) return fallback;
    throw mapFieldError(err);
  }
}
const OPT = {
  referral: "/api/v1/drivers/registration/referral",
  license: "/api/v1/drivers/registration/license",
  serviceTypes: "/api/v1/drivers/me/service-types",
  review: "/api/v1/drivers/registration/review",
  topupOptions: "/api/v1/wallet/topup/options",
  cargoCapabilities: "/api/v1/drivers/me/cargo-capabilities",
  account: "/api/v1/drivers/me",
} as const;
type ApiRegistrationReview = {
  sections: { key: RegistrationSectionKey; status: RegistrationSectionStatus }[];
  eta_minutes?: number;
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // UploadUrlRequest.size_bytes maximum

// -------------------------------------------------------------- summaries

async function homeSummary(): Promise<HomeSummary> {
  if (summaryCache && Date.now() - summaryCache.at < 5000) return summaryCache.value;
  const [balance, notifications] = await Promise.all([
    http.get<Api.WalletBalance>(API_PATHS.walletBalance),
    http.get<Api.NotificationPage>(API_PATHS.notifications, { limit: 50 }),
    // Active trips drive GPS reporting; a failed read keeps the last answer.
    readActiveTrips().catch(() => null),
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
    tripActive: activeTrips.size > 0,
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
  // OtpVerify.code: ^[0-9]{4,6}$ — the contract doesn't say which length the SMS uses.
  otpLength: { min: 4, max: 6 },
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
    // Step 1 `city` is a free string: the catalogue's names (static list if it can't be read).
    cities: await cityCatalogue().then(
      (list) => list.map((c) => ({ id: c.name, name: c.name })),
      () => REG_CITIES
    ),
    // No options endpoint yet (backend-gaps): static choices, the server validates them.
    carBrands: REG_CAR_BRANDS,
    carColors: REG_CAR_COLORS,
    years: Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i),
    seatCounts: REG_SEAT_COUNTS,
    carClasses: REG_CAR_CLASSES,
    serviceTypes: ["passengers", "delivery"],
    licenseCategories: REG_LICENSE_CATEGORIES,
    platePattern: "01 A 123 BC",
    realDocuments: true,
  }),

  async requestOtp(phone) {
    const apiPhone = toApiPhone(phone);
    try {
      const res = await http.post<Api.OtpRequestResult>(API_PATHS.otpRequest, { phone: apiPhone }, { auth: false });
      const requestId = `otp${++reviewSeq}`;
      otpPhones.set(requestId, apiPhone);
      const len = res.code_length;
      return { requestId, resendInSec: res.resend_after, codeLength: Number.isInteger(len) && len! > 0 && len! <= 12 ? len : undefined };
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

  async savePersonal({ firstName, lastName, birthDate, cityId, referralCode }) {
    // Option ids are the city names (RegistrationStep1.city is a string).
    const city = cityId.trim();
    if (!city) throw new ApiError("CITY_REQUIRED");
    if (!firstName.trim() || !lastName.trim()) throw new ApiError("NAME_INVALID");
    const next = await registrationStep(1, { first_name: firstName.trim(), last_name: lastName.trim(), birth_date: birthDate, city });
    const code = referralCode?.trim();
    if (code) await optionalEndpoint(() => http.post(OPT.referral, { code }), undefined);
    if (next.stage === "review" || next.stage === "active" || next.stage === "blocked") return next;
    registrationStage = "license";
    return { stage: "license" };
  },

  async saveLicense({ number, issuedAt, expiresAt, categories, frontRef, backRef }) {
    if (!frontRef || !backRef) throw new ApiError("DOCS_REQUIRED");
    await optionalEndpoint(
      () => http.post(OPT.license, { number: number.trim(), issued_at: issuedAt, expires_at: expiresAt, categories }),
      undefined
    );
    pendingDocs.set("license_front", frontRef);
    pendingDocs.set("license_back", backRef);
    registrationStage = "car";
    return { stage: "car" };
  },

  async saveCar({ brand, model, plate, year, seats, colorKey, carClass, serviceTypes, techPassportFrontRef, techPassportBackRef, carPhotoRef }) {
    if (!techPassportFrontRef || !techPassportBackRef || !carPhotoRef) throw new ApiError("DOCS_REQUIRED");
    // Car fields only: the contract rejects unknown keys.
    const car: Partial<Api.Car> = {
      brand,
      model,
      year,
      color: colorKey || undefined,
      plate_number: toApiPlate(plate) || undefined,
      car_class: carClass,
      seats,
    };
    const next = await registrationStep(2, { car });
    await optionalEndpoint(() => http.put(OPT.serviceTypes, { service_types: serviceTypes }), undefined);
    pendingDocs.set("tech_passport_front", techPassportFrontRef);
    pendingDocs.set("tech_passport_back", techPassportBackRef);
    pendingDocs.set("car_photo", carPhotoRef);
    if (next.stage === "review" || next.stage === "active" || next.stage === "blocked") return next;
    registrationStage = "selfie";
    return { stage: "selfie" };
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

  async submitRegistration({ selfieRef, acceptTerms }) {
    if (!acceptTerms) throw new ApiError("TERMS_REQUIRED");
    if (!selfieRef) throw new ApiError("SELFIE_REQUIRED");
    pendingDocs.set("selfie", selfieRef);
    const documents = [...pendingDocs].map(([slot, id]) => ({ kind: DOC_KIND[slot], document_id: id }));
    await registrationStep(3, { documents });
    await registrationStep(4, { accept_terms: true });
    pendingDocs.clear();
    return { ...settled("driver_registration", "pending"), id: REGISTRATION_REVIEW_ID };
  },

  getRegistrationReview: () =>
    optionalEndpoint(
      () =>
        http.get<ApiRegistrationReview>(OPT.review).then((r) => ({
          sections: r.sections,
          etaMinutes: typeof r.eta_minutes === "number" ? r.eta_minutes : undefined,
        })),
      null
    ),

  async deleteAccount() {
    await http.delete(OPT.account);
    await session.logout().catch(() => {});
    return { stage: "signed_out" };
  },

  async logout() {
    await session.logout();
    return { stage: "signed_out" };
  },

  reportLocation: (lat, lng) => http.post<void>(API_PATHS.locationUpdate, { lat, lng }),
  // The real position is the device's GPS.
  simulatedPosition: () => null,

  // ---------- Yo'nalishlarim: GET/PUT /drivers/me/routes (whole set) ----------
  getRoutes: () => readRoutes(),

  async addRoute(aCityId, bCityId) {
    const page = await readRoutes();
    const ref = (id: string): CityRef => page.cities.find((c) => c.id === id) ?? { id, name: "" };
    // A new pair starts as "both ways", like the sample data; the switch changes it.
    return putRoutes([...page.routes, { id: "", a: ref(aCityId), b: ref(bCityId), bothWays: true }], page.cities);
  },

  async setRouteBothWays(routeId, bothWays) {
    const { page, index } = await routesWith(routeId);
    return putRoutes(
      page.routes.map((r, i) => (i === index ? { ...r, bothWays } : r)),
      page.cities
    );
  },

  async removeRoute(routeId) {
    const { page, index } = await routesWith(routeId);
    return putRoutes(
      page.routes.filter((_, i) => i !== index),
      page.cities
    );
  },

  async completeRoutesSetup() {
    return currentSession();
  },

  // ---------- home ----------
  async getProfile() {
    const me = await http.get<Api.DriverProfile>(API_PATHS.driverMe);
    lastCar = me.car;
    return toDriverProfile(me);
  },
  getHomeSummary: () => homeSummary(),

  async getFeed() {
    const [page, cities] = await Promise.all([http.get<Api.OfferPage>(API_PATHS.tripOffers, { limit: 50 }), cityNames()]);
    return { items: page.data.map((o) => offerToRequest(o, cities)), seats: null, directions: [], dates: [] };
  },
  markFeedSeen: async () => {},
  getRejectReasons: async () => Object.values(REJECT_REASON_KEY).map((key) => ({ key })),

  async rejectRequest(requestId, reasonKey) {
    const reason = reasonFromKey(REJECT_REASON_KEY, reasonKey);
    if (reasonKey && !reason) throw new ApiError("VALUE_REQUIRED");
    const body: Api.OfferReject = reason ? { reason } : {};
    try {
      await http.post<void>(API_PATHS.tripOfferReject(requestId), body);
    } catch (err) {
      throw mapFieldError(err);
    }
  },

  async acceptRequest(requestId) {
    try {
      await http.post<Api.Trip>(API_PATHS.tripOfferAccept(requestId));
    } catch (err) {
      if (err instanceof ApiError && err.code === "ORDER_ALREADY_TAKEN") return settled("request_accept", "rejected", { resultKey: "request.taken" });
      throw err;
    }
    summaryCache = null;
    return settled("request_accept", "approved");
  },
  takeRequestAlerts: async () => [],

  // ---------- accepted trips: GET /trips (assigned, in_progress) ----------
  async getAccepted(): Promise<AcceptedPage> {
    const [trips, cities] = await Promise.all([readActiveTrips(), cityNames()]);
    const bookings = trips.map((t) => tripToBooking(t, cities));
    shownSteps = new Map();
    for (const t of trips) {
      const step = stepActionOf(t);
      if (step) shownSteps.set(t.id, step);
    }
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
    // Exactly the step the card showed (from the last getAccepted), never a newer guess.
    const action = shownSteps.get(bookingId);
    const trip = activeTrips.get(bookingId);
    if (!action || !trip) throw new ApiError("TRIP_NOT_FOUND");
    const path =
      action === "arrive" ? API_PATHS.tripArrive : action === "start" ? API_PATHS.tripStart : action === "complete" ? API_PATHS.tripComplete : null;
    if (!path) throw new ApiError("FORBIDDEN");
    let next: Api.Trip;
    try {
      next = await http.post<Api.Trip>(path(bookingId));
    } catch (err) {
      throw mapTripError(err);
    }
    // Sent once: the next step comes from the re-read list.
    shownSteps.delete(bookingId);
    if (next.status === "assigned" || next.status === "in_progress") activeTrips.set(bookingId, { ...trip, ...next, order: trip.order });
    else activeTrips.delete(bookingId);
    if (next.status === "completed") historyPages = { cursors: [], items: [] };
    summaryCache = null;
    return settled("trip_step", "approved");
  },

  getCancelReasons: async () => Object.values(CANCEL_REASON_KEY).map((key) => ({ key })),

  async cancelBooking(bookingId, reasonKey) {
    const reason = reasonFromKey(CANCEL_REASON_KEY, reasonKey);
    if (!reason) throw new ApiError("VALUE_REQUIRED");
    const body: Api.TripCancel = { reason };
    try {
      await http.post<Api.Trip>(API_PATHS.tripCancel(bookingId), body);
    } catch (err) {
      throw mapTripError(err);
    }
    activeTrips.delete(bookingId);
    shownSteps.delete(bookingId);
    historyPages = { cursors: [], items: [] };
    summaryCache = null;
  },
  getTripSummary: notSupported,

  // No single-item GETs: read the list the screens already use and pick the item.
  async getRequest(requestId) {
    const page = await httpAdapter.getFeed({ direction: "all", date: "today", type: "all" });
    const r = page.items.find((x) => x.id === requestId);
    if (!r) throw new ApiError("REQUEST_NOT_FOUND");
    return r;
  },
  async getBooking(bookingId) {
    const page = await httpAdapter.getAccepted();
    const b = page.days.flatMap((d) => d.trips.flatMap((tr) => tr.bookings)).find((x) => x.id === bookingId);
    if (!b) throw new ApiError("TRIP_NOT_FOUND");
    return b;
  },
  ratePassenger: notSupported,
  sendSos: notSupported,
  getTripChat: notSupported,
  sendTripMessage: notSupported,

  // ---------- history: GET /trips/history (cursor) ----------
  async getHistory({ page = 1 }) {
    if (page <= 1) historyPages = { cursors: [], items: [] };
    const [, cities] = await Promise.all([loadHistory(Math.max(1, page)), cityNames()]);
    return {
      items: historyPages.items.flat().map((t) => tripToHistoryItem(t, cities)),
      filterOptions: { minEarnings: [], ranges: [] },
      hasMore: historyMore(),
    };
  },

  async getTripDetail(id) {
    // No GET /trips/{id}: look in the loaded history pages, then page on (bounded).
    const MAX_PAGES = 10;
    const find = () => historyPages.items.flat().find((t) => t.id === id);
    let trip = find();
    while (!trip && (historyPages.items.length === 0 || historyMore()) && historyPages.items.length < MAX_PAGES) {
      await loadHistory(historyPages.items.length + 1);
      trip = find();
    }
    if (!trip) throw new ApiError("TRIP_NOT_FOUND");
    return tripToDetail(trip, await cityNames());
  },

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
  // GET /api/v1/wallet/topup/options is not in the contract yet (backend-gaps/driver.md, "Redesign v2"):
  // until then no presets and no limits here — the amount is typed and the server validates it.
  getTopupOptions: () =>
    optionalEndpoint<TopupOptions>(
      () =>
        http.get<{ presets: number[]; min?: number; max?: number; providers?: Api.PayProvider[] }>(OPT.topupOptions).then((r) => ({
          presets: (r.presets ?? []).map(toSom),
          min: r.min != null ? toSom(r.min) : undefined,
          max: r.max != null ? toSom(r.max) : undefined,
          providers: r.providers?.length ? r.providers : ["payme", "click"],
        })),
      // The contract's PayProvider values.
      { presets: [], providers: ["payme", "click"] }
    ),

  async requestTopup(amount, provider, cardId) {
    // The contract's TopupRequest has no saved card yet.
    if (cardId) return notSupported();
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
  async getCapabilities() {
    const [caps, me] = await Promise.all([
      http.get<ApiCargoCapabilities>(OPT.cargoCapabilities),
      http.get<Api.DriverProfile>(API_PATHS.driverMe),
    ]);
    lastCar = me.car;
    return toCapabilities(caps, me.car);
  },

  async setCapabilities(input) {
    let saved: ApiCargoCapabilities;
    try {
      saved = await http.put<ApiCargoCapabilities>(OPT.cargoCapabilities, toApiCapabilities(input));
    } catch (err) {
      throw mapFieldError(err);
    }
    return toCapabilities(saved, lastCar);
  },

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
