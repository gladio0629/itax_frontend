// Real-backend adapter for the passenger app. Every method that has an
// endpoint in api/openapi.yml calls it through the shared session
// (shared/http); every method without one rejects with NOT_SUPPORTED and
// `capabilities` tells the screens to hide that feature. Shapes are
// converted in ../httpMapper.ts. Nothing here logs: no tokens, phones,
// codes or URLs ever reach the console.
import { API_PATHS } from "@shared/api/openapi";
import type * as Api from "@shared/api/openapi";
import { ApiError } from "@shared/http/errors";
import { uuidV4 } from "@shared/http/uuid";
import type { ApiAdapter } from "../adapterTypes";
import type { ClientCapabilities, OrderEvent, OrderHistoryPage, ReviewKind, ReviewRequest } from "../types";
import { errorMessageKey, session } from "../httpSession";
import {
  orderCreateFrom,
  toApiCancel,
  toApiPhone,
  toApiRating,
  toApiSettings,
  toUiNotification,
  toUiOrder,
  toUiPrefs,
  toUiProfile,
  toUiWallet,
} from "../httpMapper";

const { http } = session;

const capabilities: ClientCapabilities = {
  // No cities, address search / reverse geocoding, quote, classes, seat map,
  // options, stops or cargo endpoints: the order-building flow can't run.
  ordering: false,
  orderDetails: false,
  repeatOrder: true,
  historyStatusFilter: false,
  tips: false,
  safety: false,
  popularRoutes: false,
  promo: false,
  bonuses: false,
  help: false,
  savedCards: false,
  accounts: false,
  phoneChange: false,
  accountDeletion: false,
  notificationTopics: false,
};

function unsupported(): Promise<never> {
  return Promise.reject(new ApiError("NOT_SUPPORTED", errorMessageKey("NOT_SUPPORTED")));
}

// ------------------------------------------------------------ local state
// Settled "review" results: the UI's review step is instant against a real
// backend (the server already decided).
const reviews = new Map<string, ReviewRequest>();
function settled(kind: ReviewKind, status: ReviewRequest["status"] = "approved"): ReviewRequest {
  const now = Date.now();
  const review: ReviewRequest = { id: uuidV4(), kind, status, createdAt: now, resolvesAt: now };
  reviews.set(review.id, review);
  return review;
}

/** otp/request has no request id: remember the phone for otp/verify. */
const otpPhones = new Map<string, string>();

/** Stars the passenger gave in this session (Order has no rating field). */
const ratings = new Map<string, number>();

/** History pages: the UI pages by number, the API by opaque cursor. */
const historyCursors = new Map<number, string>();
const HISTORY_LIMIT = 20;

const orderListeners = new Set<(e: OrderEvent) => void>();
session.realtime?.subscribe((event) => {
  if (!event.type.startsWith("order.") && !event.type.startsWith("trip.")) return;
  const orderId = event.order_id ?? (event.type.startsWith("order.") ? event.id : "");
  if (!orderId) return;
  for (const l of orderListeners) l({ orderId });
});

/** Only http(s) redirects to a payment provider page. */
function redirectTo(url: string) {
  const target = new URL(url, window.location.href);
  if (target.protocol !== "https:" && target.protocol !== "http:") throw new ApiError("UNKNOWN_ERROR", errorMessageKey("UNKNOWN_ERROR"));
  window.location.assign(target.toString());
}

async function getOrder(orderId: string) {
  const order = await http.get<Api.Order>(API_PATHS.order(orderId));
  return toUiOrder(order, { rating: ratings.get(orderId) });
}

async function createOrderBody(body: Api.OrderCreate) {
  const order = await session.idempotency.run("orderCreate", body, (key) =>
    http.post<Api.Order>(API_PATHS.orders, body, { idempotencyKey: key })
  );
  return toUiOrder(order);
}

export const httpAdapter: ApiAdapter = {
  capabilities,
  // OtpVerify.code: ^[0-9]{4,6}$ — the contract doesn't say which length the SMS uses.
  otpLength: { min: 4, max: 6 },

  // -------------------------------------------------------------- session
  hasSession: () => session.hasSession(),
  resumeSession: async () => {
    try {
      await session.resume();
    } catch {
      /* offline: stay signed in, the next call retries the refresh */
    }
  },
  logout: () => session.logout(),
  onSessionEnd: (listener) => session.onEnd(() => listener()),
  onOrderEvent: (listener) => {
    orderListeners.add(listener);
    return () => orderListeners.delete(listener);
  },

  // ----------------------------------------------------------------- auth
  requestOtp: async (phone) => {
    const apiPhone = toApiPhone(phone);
    const res = await http.post<Api.OtpRequestResult>(API_PATHS.otpRequest, { phone: apiPhone }, { auth: false });
    const requestId = uuidV4();
    otpPhones.set(requestId, apiPhone);
    return { requestId, resendAfterSec: res.resend_after };
  },
  verifyOtp: async (requestId, code) => {
    const phone = otpPhones.get(requestId);
    if (!phone) throw new ApiError("AUTH_OTP_EXPIRED", errorMessageKey("AUTH_OTP_EXPIRED"));
    const pair = await http.post<Api.TokenPair>(API_PATHS.otpVerify, { phone, code }, { auth: false });
    otpPhones.delete(requestId);
    session.signIn(pair);
    return settled("otp_verify");
  },
  getReviewStatus: async (reviewId) => {
    const review = reviews.get(reviewId);
    if (!review) throw new ApiError("NOT_FOUND", errorMessageKey("NOT_FOUND"));
    return review;
  },

  // --------------------------------------------------------------- orders
  // createOrder needs GeoPoints; the UI only has local address ids and the
  // contract has no geocoding to turn a picked place into lat/lng.
  createOrder: () => unsupported(),
  repeatOrder: async (orderId) => {
    const previous = await http.get<Api.Order>(API_PATHS.order(orderId));
    return createOrderBody(orderCreateFrom(previous));
  },
  getOrder,
  updateOrder: async (orderId, patch) => {
    const body: Api.OrderUpdate = {};
    if (patch.comment !== undefined) body.comment = patch.comment;
    if (patch.paymentMethod !== undefined) body.payment_method = patch.paymentMethod;
    const other = Object.keys(patch).filter((k) => k !== "comment" && k !== "paymentMethod");
    if (other.length > 0 || Object.keys(body).length === 0) return unsupported();
    const order = await http.patch<Api.Order>(API_PATHS.order(orderId), body);
    return toUiOrder(order, { rating: ratings.get(orderId) });
  },
  cancelOrder: async (orderId, reason) => {
    const order = await http.post<Api.Order>(API_PATHS.orderCancel(orderId), toApiCancel(reason));
    return toUiOrder(order, { rating: ratings.get(orderId) });
  },
  rateOrder: async (orderId, stars, reasons, note) => {
    const body = toApiRating(stars, reasons, note);
    try {
      await http.post<Api.Rating>(API_PATHS.orderRate(orderId), body);
    } catch (err) {
      // Already rated: the contract changes a rating with PUT.
      if (!(err instanceof ApiError && err.code === "FORBIDDEN" && err.params.reason === "already_rated")) throw err;
      await http.put<Api.Rating>(API_PATHS.orderRate(orderId), body);
    }
    ratings.set(orderId, stars);
    return getOrder(orderId);
  },
  getOrderHistory: async (params) => {
    const page = params?.cursor ?? 0;
    if (page === 0) historyCursors.clear();
    const cursor = page > 0 ? historyCursors.get(page) : undefined;
    // A page we never got a cursor for can't be fetched: end of list.
    if (page > 0 && !cursor) return { orders: [], nextCursor: null };
    const res = await http.get<Api.OrderPage>(API_PATHS.orderHistory, { cursor, limit: HISTORY_LIMIT });
    let nextCursor: OrderHistoryPage["nextCursor"] = null;
    if (res.cursor) {
      historyCursors.set(page + 1, res.cursor);
      nextCursor = page + 1;
    }
    return { orders: res.data.map((o) => toUiOrder(o, { rating: ratings.get(o.id) })), nextCursor };
  },

  // -------------------------------------------------------- notifications
  getNotifications: async () => {
    const res = await http.get<Api.NotificationPage>(API_PATHS.notifications, { limit: 50 });
    return res.data.map(toUiNotification);
  },
  markNotificationRead: async (id) => {
    await http.put<void>(API_PATHS.notificationRead(id));
  },

  // -------------------------------------------------------------- profile
  getProfile: async () => toUiProfile(await http.get<Api.Profile>(API_PATHS.profile)),
  updateProfileName: async (firstName, lastName) => {
    const body: Api.ProfileUpdate = {};
    if (firstName.trim()) body.first_name = firstName.trim();
    if (lastName.trim()) body.last_name = lastName.trim();
    return toUiProfile(await http.put<Api.Profile>(API_PATHS.profile, body));
  },
  getNotificationPrefs: async () => toUiPrefs((await http.get<Api.Profile>(API_PATHS.profile)).settings ?? {}),
  setNotificationPrefs: async (patch) => {
    const current = (await http.get<Api.Profile>(API_PATHS.profile)).settings ?? {};
    const saved = await http.put<Api.Settings>(API_PATHS.profileSettings, toApiSettings(current, patch));
    return toUiPrefs(saved);
  },

  // --------------------------------------------------------------- wallet
  getWallet: async () => {
    const [balance, ledger] = await Promise.all([
      http.get<Api.WalletBalance>(API_PATHS.walletBalance),
      http.get<Api.LedgerPage>(API_PATHS.walletLedger, { limit: 50 }),
    ]);
    return toUiWallet(balance, ledger.data);
  },
  linkCard: async ({ provider }) => {
    if (!provider) throw new ApiError("VALIDATION_ERROR", errorMessageKey("VALIDATION_ERROR"), { params: { fields: { provider: "required" } } });
    const res = await http.post<Api.CardLinkSession>(API_PATHS.walletCardLink, { provider });
    redirectTo(res.redirect_url);
    return settled("card_link");
  },

  // ------------------------------------- no endpoint in api/openapi.yml
  getCities: unsupported,
  getPopularRoutes: unsupported,
  getRecentRoutes: unsupported,
  getAddressSuggestions: unsupported,
  searchAddresses: unsupported,
  getRecentAddresses: unsupported,
  getSavedAddresses: unsupported,
  reverseGeocode: unsupported,
  getPickupEta: unsupported,
  getSeatMap: unsupported,
  getQuote: unsupported,
  getDeliveryVehicles: unsupported,
  getSchedulingRules: unsupported,
  getOrderDetailsRules: unsupported,
  getOrderOptions: unsupported,
  getCommentHints: unsupported,
  getSavedAddressDetails: unsupported,
  saveAddressDetails: unsupported,
  getCarClasses: unsupported,
  getLuggageRules: unsupported,
  validateRider: unsupported,
  getTipOptions: unsupported,
  sendTip: unsupported,
  getTripShareLink: unsupported,
  getEmergencyContacts: unsupported,
  addEmergencyContact: unsupported,
  removeEmergencyContact: unsupported,
  getSupportContact: unsupported,
  getCargoRules: unsupported,
  getMarketplaceWarehouses: unsupported,
  getCargoInfo: unsupported,
  getRideAlong: unsupported,
  checkCargo: unsupported,
  getSavedCards: unsupported,
  applyPromoCode: unsupported,
  getBonusSummary: unsupported,
  getBonusSources: unsupported,
  getBonusHistory: unsupported,
  requestBonusWithdraw: unsupported,
  getAccounts: unsupported,
  switchAccount: unsupported,
  addAccount: unsupported,
  deleteAccount: unsupported,
  requestAccountDeletion: unsupported,
  requestPhoneChange: unsupported,
  confirmPhoneChange: unsupported,
  submitHelpRequest: unsupported,
  getHelpRequests: unsupported,
  submitSupportTicket: unsupported,
};

/** Picked by the `@active-adapter` alias unless VITE_DEMO_MODE=true. */
export const adapter = httpAdapter;
