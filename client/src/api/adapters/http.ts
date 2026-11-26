// Real-backend adapter for the passenger app. Every method that has an
// endpoint in api/openapi.yml calls it through the shared session
// (shared/http); every method without one rejects with NOT_SUPPORTED and
// `capabilities` tells the screens to hide that feature. Shapes are
// converted in ../httpMapper.ts. Nothing here logs: no tokens, phones,
// codes, coordinates or URLs ever reach the console.
import { API_PATHS } from "@shared/api/openapi";
import type * as Api from "@shared/api/openapi";
import { ApiError } from "@shared/http/errors";
import { uuidV4 } from "@shared/http/uuid";
import { toLatLng } from "@shared/map/geo";
import type { ApiAdapter } from "../adapterTypes";
import type {
  Address,
  AddressDetails,
  AddressSearchResult,
  CarClass,
  CarClassId,
  ClientCapabilities,
  CreateOrderInput,
  DriverLocation,
  OrderEvent,
  OrderHistoryPage,
  OrderTiming,
  QuoteInput,
  ReviewKind,
  ReviewRequest,
  SavedAddressInfo,
  ServiceType,
  OrderMode,
  CargoInput,
} from "../types";
import { errorMessageKey, session } from "../httpSession";
import {
  orderCreateFrom,
  somFromTiyin,
  toApiCancel,
  toApiCarClass,
  toApiDetails,
  toApiPayment,
  toApiPhone,
  toApiRating,
  toApiSettings,
  toApiTiming,
  toUiCity,
  toUiDetails,
  toUiNotification,
  toUiOrder,
  toUiPopularRoute,
  toUiPrefs,
  toUiProfile,
  toUiQuote,
  toUiSeat,
  toUiVehicle,
  toUiWallet,
} from "../httpMapper";
import { layoutFor, passengerSeats, type SeatLayout } from "../seatLayout";
import { fetchSeatLayouts, sedanLayoutsFromSeatMap } from "./seatLayouts.http";

const { http } = session;

const capabilities: ClientCapabilities = {
  // Cities, place search / reverse, saved places, quote, seat map, vehicle
  // sizes and time ranges are in the contract: the order flow runs.
  ordering: true,
  // PATCH takes `to`, seats, time, payment and comment (not the pickup).
  orderDetails: true,
  repeatOrder: true,
  historyStatusFilter: false,
  tips: false,
  safety: false,
  popularRoutes: true,
  // No endpoint yet (docs/backend-gaps/client.md, Redesign v2).
  recentRoutes: false,
  promo: false,
  bonuses: false,
  help: false,
  savedCards: false,
  accounts: false,
  phoneChange: false,
  accountDeletion: false,
  notificationTopics: false,
  // Still open in the backend (docs/backend-gaps.md §0): the order can't
  // carry stops, options, luggage, a rider, route-point details or the
  // Kargo extras; no pickup ETA; and the map is stylized, not geographic.
  stops: false,
  orderOptions: false,
  rider: false,
  addressDetails: false,
  cargoExtras: false,
  mapPick: false,
  pickupEta: false,
  // OrderUpdate has `to` but no `from`.
  editPickup: false,
  // RatingInput carries one reason; a comment goes as the "custom" reason (5 stars).
  ratingNote: false,
  historySearch: false,
  // No payment page for an order yet: Payme / Click would end in "payment
  // comes later" with nothing after it (store release 1.1, 2026-11-26).
  appPayment: false,
  // GET /orders/seat-layouts isn't on the server (backend-gaps.md, miniven).
  seatLayouts: false,
  // OrderUpdate sets scheduled_* but can't clear them (updateOrder rejects "now").
  clearTime: false,
  // No saved cards and no charge path for an order yet: cash only in 1.1
  // (owner, 2026-11-26).
  cardPayment: false,
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

// ------------------------------------------------------- address registry
// The screens work with local address ids; the API with coordinates. Every
// point this adapter hands out (search, reverse, saved, an order's ends) is
// kept here, so a later quote/create/update can turn an id back into a
// GeoPoint. Ids: city:<uuid>, place:<uuid>, saved:<uuid>, pt:<lat>,<lng>.
// In memory only (a reload starts a new draft anyway).
type Point = { address: Address; lat: number; lng: number; area: string; details?: AddressDetails; savedId?: string };
const points = new Map<string, Point>();

function remember(p: Point): Address {
  // Screens get the coordinates with the address (for the map).
  p.address.lat = p.lat;
  p.address.lng = p.lng;
  points.set(p.address.id, p);
  return p.address;
}
function pointOf(id: string): Point {
  // No point picked yet: a rule the passenger fixes by picking one.
  if (!id) throw new ApiError("INVALID_ROUTE", "order.choosePlace");
  const p = points.get(id);
  if (!p) throw new ApiError("NOT_FOUND", errorMessageKey("NOT_FOUND"));
  return p;
}
const coordId = (lat: number, lng: number) => `pt:${lat.toFixed(6)},${lng.toFixed(6)}`;

function rememberPlace(pl: Api.Place): Address {
  return remember({
    address: { id: pl.kind === "city" ? `city:${pl.id}` : `place:${pl.id}`, cityId: pl.city_id, label: pl.name },
    lat: pl.lat,
    lng: pl.lng,
    area: pl.area,
  });
}
function rememberSaved(sp: Api.SavedPlace): Point {
  const p: Point = {
    // SavedPlace has no city id.
    address: { id: `saved:${sp.id}`, cityId: "", label: sp.name },
    lat: sp.lat,
    lng: sp.lng,
    area: sp.area,
    details: toUiDetails(sp.details),
    savedId: sp.id,
  };
  remember(p);
  return p;
}
/** An order's end, so tracking and Tafsilotlar can show and reuse it. */
function rememberGeo(g: Api.GeoPoint, cityId: string | null | undefined): string {
  const id = coordId(g.lat, g.lng);
  const label = g.address?.trim() || `${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}`;
  remember({ address: { id, cityId: cityId ?? "", label }, lat: g.lat, lng: g.lng, area: "" });
  return id;
}
function geoPoint(addressId: string): Api.GeoPoint {
  const p = pointOf(addressId);
  return { lat: p.lat, lng: p.lng, address: p.address.label.slice(0, 300) };
}

function mapOrder(o: Api.Order) {
  return toUiOrder(o, {
    rating: ratings.get(o.id),
    fromAddressId: rememberGeo(o.from, o.from_city_id),
    toAddressId: rememberGeo(o.to, o.to_city_id),
  });
}

// ---------------------------------------------------------------- errors
const TIMING_FIELD_KEY: Record<string, string> = {
  in_past: "order.timing.pastTime",
  too_far: "order.timing.tooFar",
  range_too_short: "order.timing.invalidRange",
  range_too_long: "order.timing.rangeTooLong",
  before_from: "order.timing.invalidRange",
};
/** Server refusals the passenger can fix → the UI's rule errors (code in
 * lib/apiError RULE_CODES + a translation key). Anything else unchanged. */
function ruleError(err: unknown): unknown {
  if (!(err instanceof ApiError)) return err;
  const init = { params: err.params, status: err.status };
  if (err.code === "VALIDATION_ERROR") {
    const fields = (err.params.fields ?? {}) as Record<string, unknown>;
    if (fields.to === "same_as_from") return new ApiError("INVALID_ROUTE", "order.error.samePoint", init);
    for (const f of ["scheduled_at", "scheduled_from", "scheduled_to"]) {
      const v = fields[f];
      if (typeof v === "string") return new ApiError("INVALID_TIMING", TIMING_FIELD_KEY[v] ?? "order.timing.invalidRange", init);
    }
  }
  if (err.code === "FORBIDDEN" && err.params.reason === "active_orders_limit") {
    return new ApiError("ACTIVE_ORDERS_LIMIT", "order.error.activeLimit", init);
  }
  return err;
}

const QUOTE_ERRORS = new Set(["QUOTE_NOT_FOUND", "QUOTE_EXPIRED", "QUOTE_ALREADY_USED", "QUOTE_MISMATCH"]);

// ----------------------------------------------------------------- quotes
const SEAT_IDS: readonly Api.SeatId[] = ["front", "back-left", "back-mid", "back-right"];
const isSeatId = (s: string): s is Api.SeatId => (SEAT_IDS as readonly string[]).includes(s);

type OrderShape = {
  serviceType: ServiceType;
  fromAddressId: string;
  toAddressId: string;
  mode: OrderMode;
  seatIds: string[];
  carClass?: CarClassId;
  cargo?: CargoInput;
  timing?: OrderTiming;
};

/** The one body builder for quote and create (create adds payment, comment
 * and quote_id), so a quote and its order always match. */
function quoteBody(input: OrderShape): Api.QuoteRequest {
  const body: Api.QuoteRequest = { type: input.serviceType, from: geoPoint(input.fromAddressId), to: geoPoint(input.toAddressId) };
  if (input.serviceType === "delivery") {
    if (!input.cargo) throw new ApiError("VALIDATION_ERROR", errorMessageKey("VALIDATION_ERROR"));
    body.vehicle_type = input.cargo.vehicle;
  } else if (input.mode === "seat" && input.carClass === "miniven") {
    // Minivan per seat (backend-gaps "client (miniven, 2026-11-24)"): its
    // seat ids from the seat layout, with the class.
    if (input.seatIds.length === 0) throw new ApiError("SEATS_REQUIRED", "order.seatsHint");
    body.seat_ids = input.seatIds as Api.SeatId[];
    body.car_class = toApiCarClass("miniven");
  } else if (input.mode === "seat") {
    // Per seat: the contract needs at least one seat (and no class).
    const ids = SEAT_IDS.filter((id) => input.seatIds.includes(id));
    if (ids.length === 0) throw new ApiError("SEATS_REQUIRED", "order.seatsHint");
    body.seat_ids = ids;
  } else {
    body.car_class = toApiCarClass(input.carClass ?? "standart");
  }
  return { ...body, ...toApiTiming(input.timing) };
}

/** Quotes by request body. Reused while comfortably valid (class cards and
 * the main quote ask for the same thing), so the server isn't asked for a
 * new persisted quote on every render; concurrent asks share one call. */
type CachedQuote = { quote: Api.Quote; expiresAt: number };
const quotes = new Map<string, CachedQuote>();
const quoteCalls = new Map<string, Promise<Api.Quote>>();
const QUOTE_REUSE_MS = 60_000;
/** The quote whose price getQuote last returned for a body — the price on
 * screen. createOrder uses exactly this one (a class card's re-fetch of the
 * same body can't swap the price behind the passenger's back). */
const shownQuotes = new Map<string, Api.Quote>();

function fetchQuote(body: Api.QuoteRequest, fresh = false): Promise<Api.Quote> {
  const key = JSON.stringify(body);
  const hit = quotes.get(key);
  if (!fresh && hit && hit.expiresAt - Date.now() > QUOTE_REUSE_MS) return Promise.resolve(hit.quote);
  const pending = quoteCalls.get(key);
  if (!fresh && pending) return pending;
  const call = http
    .post<Api.Quote>(API_PATHS.orderQuote, body)
    .then((q) => {
      quotes.set(key, { quote: q, expiresAt: Date.parse(q.expires_at) || 0 });
      return q;
    })
    .catch((err) => {
      throw ruleError(err);
    })
    .finally(() => {
      if (quoteCalls.get(key) === call) quoteCalls.delete(key);
    });
  quoteCalls.set(key, call);
  return call;
}

/** The quoted price can't be used (expired, used, changed): fetch a fresh
 * quote and reject with the new total, so the screen shows it and asks the
 * passenger to confirm. An order is never created at a price they haven't seen. */
async function renewQuote(body: Api.QuoteRequest, code: string, status: number): Promise<never> {
  const key = JSON.stringify(body);
  quotes.delete(key);
  shownQuotes.delete(key);
  const fresh = await fetchQuote(body, true);
  // The price the passenger is now asked to confirm.
  shownQuotes.set(key, fresh);
  throw new ApiError(code, errorMessageKey(code), { params: { total: somFromTiyin(fresh.price) }, status });
}

const CLASS_IDS: CarClassId[] = ["standart", "komfort", "biznes", "miniven"];

/** Minivan per seat: the server's quote for the picked minivan seats, or for
 * one free seat while none is picked (as the Standart card does). null when
 * the server has no minivan layout or can't price it. */
async function minivanSeatPrice(input: QuoteInput, layout: SeatLayout | null): Promise<number | null> {
  if (!layout) return null;
  const free = passengerSeats(layout).filter((s) => !s.taken).map((s) => s.id);
  const picked = input.seatIds.filter((id) => free.includes(id));
  const ids = picked.length ? picked : free.slice(0, 1);
  if (ids.length === 0) return null;
  try {
    const q = await fetchQuote(quoteBody({ ...input, serviceType: "passenger", carClass: "miniven", seatIds: ids }));
    return somFromTiyin(q.price);
  } catch {
    return null;
  }
}

// -------------------------------------------------------------- realtime
// websocket-events.md: every passenger frame that names an order means
// "re-read GET /orders/{order_id}". Unknown types are ignored.
const ORDER_EVENTS = new Set<string>([
  "order.created",
  "order.accepted",
  "order.arrived",
  "trip.started",
  "trip.completed",
  // Driver backed out: the order is searching again.
  "trip.cancelled",
  // Cancelled by an admin.
  "order.cancelled",
]);
const orderListeners = new Set<(e: OrderEvent) => void>();
session.realtime?.subscribe((event) => {
  if (!ORDER_EVENTS.has(event.type) || !event.order_id) return;
  for (const l of orderListeners) l({ orderId: event.order_id });
});

// The driver's GPS fix for the passenger's map: a "driver.location" frame
// with the order id and lat/lng. It is not an order change, so it never
// triggers a re-read. (Not sent by the backend yet — docs/backend-gaps.md.)
const driverLocationListeners = new Set<(e: DriverLocation) => void>();
session.realtime?.subscribe((event) => {
  if (event.type !== "driver.location" || !event.order_id) return;
  const fix = toLatLng(event.lat, event.lng);
  if (!fix) return;
  for (const l of driverLocationListeners) l({ orderId: event.order_id, kind: "position", lat: fix.lat, lng: fix.lng });
});

/** Only http(s) redirects to a payment provider page. */
function redirectTo(url: string) {
  const target = new URL(url, window.location.href);
  if (target.protocol !== "https:" && target.protocol !== "http:") throw new ApiError("UNKNOWN_ERROR", errorMessageKey("UNKNOWN_ERROR"));
  window.location.assign(target.toString());
}

/** The device position (asked only when the passenger taps "where am I"). */
function devicePosition(): Promise<{ lat: number; lng: number }> {
  const unavailable = () => new ApiError("LOCATION_UNAVAILABLE", errorMessageKey("LOCATION_UNAVAILABLE"));
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(unavailable());
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(unavailable()),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  });
}

async function getOrder(orderId: string) {
  return mapOrder(await http.get<Api.Order>(API_PATHS.order(orderId)));
}

async function createOrderBody(body: Api.OrderCreate) {
  const order = await session.idempotency.run("orderCreate", body, (key) =>
    http.post<Api.Order>(API_PATHS.orders, body, { idempotencyKey: key })
  );
  return mapOrder(order);
}

// `excludeCityId` (the sample data's "drop-off in another city" rule) isn't
// applied: the backend accepts in-city trips and decides itself (it rejects
// only from = to, shown as order.error.samePoint).
async function searchPlaces(query: string, near: Point | undefined, onlyCityId?: string): Promise<Api.Place[]> {
  const q = query.trim();
  // The contract's minimum query length.
  if (q.length < 2) return [];
  const res = await http.get<Api.PlaceList>(API_PATHS.placesSearch, {
    q: q.slice(0, 100),
    near_lat: near?.lat,
    near_lng: near?.lng,
    city_id: onlyCityId || undefined,
  });
  return res.data;
}

function savedInfo(p: Point): SavedAddressInfo {
  // No distance / ETA for saved places in the contract.
  // The contract keeps the name (shown as the label) but no kind yet
  // (docs/backend-gaps/client.md, Redesign v2).
  return { address: p.address, area: p.area || undefined, details: p.details };
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
  onDriverLocation: (orderId, listener) => {
    const forOrder = (e: DriverLocation) => {
      if (e.orderId === orderId) listener(e);
    };
    driverLocationListeners.add(forOrder);
    return () => driverLocationListeners.delete(forOrder);
  },

  // ----------------------------------------------------------------- auth
  requestOtp: async (phone) => {
    const apiPhone = toApiPhone(phone);
    const res = await http.post<Api.OtpRequestResult>(API_PATHS.otpRequest, { phone: apiPhone }, { auth: false });
    const requestId = uuidV4();
    otpPhones.set(requestId, apiPhone);
    return { requestId, resendAfterSec: res.resend_after, codeLength: res.code_length };
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

  // -------------------------------------------------------------- places
  addressById: (id) => points.get(id)?.address,
  // No default pickup: the passenger picks one or taps "where am I".
  defaultPickupId: () => "",
  simulatedPosition: () => null,
  locateMe: async () => {
    const pos = await devicePosition();
    const place = await http.get<Api.Place>(API_PATHS.placesReverse, { lat: pos.lat, lng: pos.lng });
    // Reverse is for the name only: the order keeps the device's coordinates.
    return remember({ address: { id: coordId(pos.lat, pos.lng), cityId: place.city_id, label: place.name }, lat: pos.lat, lng: pos.lng, area: place.area });
  },
  getCities: async () => (await http.get<Api.CityList>(API_PATHS.cities)).data.map(toUiCity),
  getPopularRoutes: async () => (await http.get<Api.PopularRouteList>(API_PATHS.routesPopular)).data.map(toUiPopularRoute),
  searchAddresses: async ({ query, fromAddressId, onlyCityId }) => {
    const near = fromAddressId ? points.get(fromAddressId) : undefined;
    const found = await searchPlaces(query, near, onlyCityId);
    return found.map(
      (pl): AddressSearchResult => ({
        address: rememberPlace(pl),
        area: pl.area,
        distanceKm: near && pl.distance_m != null ? Math.round(pl.distance_m / 100) / 10 : undefined,
        entrance: pl.entrance ?? undefined,
      })
    );
  },
  getAddressSuggestions: async (query, _excludeCityId, onlyCityId) => (await searchPlaces(query, undefined, onlyCityId)).map(rememberPlace),
  getSavedAddresses: async () => {
    const res = await http.get<Api.SavedPlaceList>(API_PATHS.placesSaved);
    return res.data.map((sp) => savedInfo(rememberSaved(sp)));
  },
  getSavedAddressDetails: async (addressId) => points.get(addressId)?.details ?? null,
  // `kind` isn't in SavedPlaceCreate yet (unknown fields are rejected): not sent.
  saveAddress: async ({ addressId, name, details }) => {
    const p = pointOf(addressId);
    const body: Api.SavedPlaceCreate = { name: (name ?? p.address.label).trim().slice(0, 100), lat: p.lat, lng: p.lng };
    if (p.area) body.area = p.area.slice(0, 200);
    const d = toApiDetails(details);
    if (d) body.details = d;
    return savedInfo(rememberSaved(await http.post<Api.SavedPlace>(API_PATHS.placesSaved, body)));
  },
  removeSavedAddress: async (addressId) => {
    const savedId = points.get(addressId)?.savedId;
    if (!savedId) throw new ApiError("NOT_FOUND", errorMessageKey("NOT_FOUND"));
    await http.delete<void>(API_PATHS.placeSaved(savedId));
    points.delete(addressId);
  },
  getDeliveryVehicles: async () => (await http.get<Api.DeliveryVehicleList>(API_PATHS.deliveryVehicles)).data.map(toUiVehicle),

  // ---------------------------------------------------------- order flow
  getSeatMap: async ({ fromAddressId, toAddressId }) => {
    const from = pointOf(fromAddressId);
    const to = pointOf(toAddressId);
    const res = await http.get<Api.SeatMap>(API_PATHS.orderSeatMap, { from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng });
    return res.seats.map(toUiSeat);
  },
  getSeatLayouts: async (route) => {
    // Not on the server yet, and the path would be read as /orders/{id}
    // there (a 4xx that isn't 404): use the seat map until it ships.
    if (!capabilities.seatLayouts) return sedanLayoutsFromSeatMap(await httpAdapter.getSeatMap(route));
    try {
      return await fetchSeatLayouts(geoPoint(route.fromAddressId), geoPoint(route.toAddressId));
    } catch (err) {
      // Endpoint not deployed yet: keep the sedan map from seat-map.
      if (!(err instanceof ApiError) || err.status !== 404) throw err;
      return sedanLayoutsFromSeatMap(await httpAdapter.getSeatMap(route));
    }
  },
  getQuote: async (input: QuoteInput) => {
    if (input.stops?.length || input.promoCode) return unsupported();
    const body = quoteBody(input);
    const q = await fetchQuote(body);
    shownQuotes.set(JSON.stringify(body), q);
    return toUiQuote(q);
  },
  // One server quote per class (whole car). Per seat the contract takes no
  // class: only Standart is offered, at the seat price.
  getCarClasses: async (input) => {
    // "N o'rin" per class from the server's seat layouts.
    const layouts = await httpAdapter.getSeatLayouts(input).catch((): SeatLayout[] => []);
    const seatsOf = (id: CarClassId) => layoutFor(layouts, id)?.passengerSeats ?? 0;
    if (input.mode === "seat") {
      let price: number;
      if (input.seatIds.some(isSeatId)) {
        price = somFromTiyin((await fetchQuote(quoteBody({ ...input, serviceType: "passenger" }))).price);
      } else {
        // No seat picked yet: the server's price of one seat (seat map).
        const seats = await httpAdapter.getSeatMap(input);
        price = seats[0]?.price ?? 0;
      }
      const van = await minivanSeatPrice(input, layoutFor(layouts, "miniven"));
      return CLASS_IDS.map(
        (id): CarClass =>
          id === "standart"
            ? { id, nameKey: `class.${id}`, seats: seatsOf(id), price, available: true }
            : id === "miniven" && van != null
              ? { id, nameKey: `class.${id}`, seats: seatsOf(id), price: van, available: true }
              : { id, nameKey: `class.${id}`, seats: seatsOf(id), price: 0, available: false, reasonKey: "class.reason.wholeCarOnly" }
      );
    }
    const results = await Promise.allSettled(
      CLASS_IDS.map((id) => fetchQuote(quoteBody({ ...input, serviceType: "passenger", mode: "car", carClass: id })))
    );
    if (results.every((r) => r.status === "rejected")) throw (results[0] as PromiseRejectedResult).reason;
    return CLASS_IDS.map((id, i): CarClass => {
      const r = results[i];
      return r.status === "fulfilled"
        ? { id, nameKey: `class.${id}`, seats: seatsOf(id), price: somFromTiyin(r.value.price), available: true }
        : { id, nameKey: `class.${id}`, seats: seatsOf(id), price: 0, available: false, reasonKey: "class.reason.unavailable" };
    });
  },
  // Inside the server's limits (from in the future, window ≥ 15 min and
  // ≤ 7 days, end ≤ 30 days ahead) and the same numbers the UI texts name.
  getSchedulingRules: async () => ({ bookableDays: 21, maxRangeDays: 3, minRangeMinutes: 30, stepMinutes: 5 }),
  // The contract's lengths (comment 200, PlaceDetails 20/200); no stops.
  getOrderDetailsRules: async () => ({
    maxStops: 0,
    commentMaxLength: 200,
    addressFieldMaxLength: 20,
    intercomMaxLength: 20,
    addressNoteMaxLength: 200,
    riderNameMaxLength: 100,
  }),
  // The order can't carry options, so none are offered.
  getLuggageRules: async () => null,

  // --------------------------------------------------------------- orders
  createOrder: async (input: CreateOrderInput) => {
    // Extras the order can't carry yet are never dropped silently.
    const hasDetails = [input.fromDetails, input.toDetails].some((d) => d && Object.values(d).some((v) => v?.trim()));
    if (input.stops?.length || input.promoCode || input.rider?.kind === "other" || (input.luggage ?? 0) > 0 || hasDetails) {
      return unsupported();
    }
    const q = quoteBody(input);
    const key = JSON.stringify(q);
    const shown = shownQuotes.get(key);
    // The price on screen came from this quote; without it, ask again.
    if (!shown || (Date.parse(shown.expires_at) || 0) <= Date.now()) return renewQuote(q, "QUOTE_EXPIRED", 409);
    const body: Api.OrderCreate = { ...q, payment_method: toApiPayment(input.paymentMethod), quote_id: shown.quote_id };
    // Dostavka's "Izoh" is the cargo note.
    const comment = (input.serviceType === "delivery" ? input.cargo?.note : input.comment)?.trim();
    if (comment) body.comment = comment.slice(0, 200);
    try {
      const order = await createOrderBody(body);
      quotes.delete(key);
      shownQuotes.delete(key);
      return order;
    } catch (err) {
      if (err instanceof ApiError && QUOTE_ERRORS.has(err.code)) return renewQuote(q, err.code, err.status);
      throw ruleError(err);
    }
  },
  // "Search again": the server prices it at the current tariff (no quote).
  repeatOrder: async (orderId, _fallback, changes) => {
    const previous = await http.get<Api.Order>(API_PATHS.order(orderId));
    const body = orderCreateFrom(previous);
    try {
      return await createOrderBody(changes?.timing ? { ...body, ...toApiTiming(changes.timing) } : body);
    } catch (err) {
      throw ruleError(err);
    }
  },
  getOrder,
  updateOrder: async (orderId, patch) => {
    const supported = new Set(["comment", "paymentMethod", "toAddressId", "mode", "seatIds", "timing"]);
    if (Object.keys(patch).some((k) => !supported.has(k))) return unsupported();
    const body: Api.OrderUpdate = {};
    if (patch.comment !== undefined) body.comment = patch.comment.trim().slice(0, 200);
    if (patch.paymentMethod !== undefined) body.payment_method = toApiPayment(patch.paymentMethod);
    if (patch.toAddressId !== undefined) body.to = geoPoint(patch.toAddressId);
    if (patch.mode === "seat" || (patch.mode === undefined && patch.seatIds)) {
      // Minivan seat ids (seat layout) go as they are; the server checks them
      // against the order's class.
      const given = patch.seatIds ?? [];
      const ids = given.some((id) => !isSeatId(id)) ? (given as Api.SeatId[]) : SEAT_IDS.filter((id) => given.includes(id));
      if (ids.length === 0) throw new ApiError("SEATS_REQUIRED", "order.seatsHint");
      body.seat_ids = ids;
    } else if (patch.mode === "car") {
      const current = await http.get<Api.Order>(API_PATHS.order(orderId));
      body.car_class = current.car_class ?? toApiCarClass("standart");
    }
    if (patch.timing) {
      // OrderUpdate can't clear a time back to "now".
      if (patch.timing.timeMode !== "scheduled") return unsupported();
      Object.assign(body, toApiTiming(patch.timing));
    }
    if (Object.keys(body).length === 0) return getOrder(orderId);
    try {
      return mapOrder(await http.patch<Api.Order>(API_PATHS.order(orderId), body));
    } catch (err) {
      throw ruleError(err);
    }
  },
  cancelOrder: async (orderId, reason) => mapOrder(await http.post<Api.Order>(API_PATHS.orderCancel(orderId), toApiCancel(reason))),
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
    return { orders: res.data.map(mapOrder), nextCursor };
  },

  // No "active order" endpoint: the newest live one on the first history page.
  getActiveOrder: async () => {
    const res = await http.get<Api.OrderPage>(API_PATHS.orderHistory, { limit: HISTORY_LIMIT });
    const live = res.data.map(mapOrder).find((o) => o.status === "searching" || o.status === "accepted" || o.status === "in_progress");
    return live ?? null;
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
  // Not used by any screen; no endpoint for recent addresses/routes.
  getRecentRoutes: unsupported,
  getRecentAddresses: unsupported,
  // The map is stylized (no geography): no pin picking (capabilities.mapPick).
  reverseGeocode: unsupported,
  getPickupEta: unsupported,
  // Route-point details aren't on the order (capabilities.addressDetails).
  saveAddressDetails: unsupported,
  validateRider: unsupported,
  getTipOptions: unsupported,
  sendTip: unsupported,
  getTripShareLink: unsupported,
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
