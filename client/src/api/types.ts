import type {
  City,
  Driver,
  Order,
  OrderMode,
  OrderStatus,
  PaymentMethod,
} from "@/seed/generate";
import type { ReviewKind, ReviewRequest } from "@/mockDb/db";

export type { City, Driver, Order, OrderMode, OrderStatus, PaymentMethod, ReviewKind, ReviewRequest };

/** A route point the adapter handed out (search, saved, reverse, an order).
 * Screens keep only its id and look it up with api.addressById(). */
export type Address = {
  id: string;
  /** "" when the point isn't in a known city. */
  cityId: string;
  label: string;
  /** 0-100 position on the stylized map (sample data only: the map isn't
   * geographic, so a real point has none). */
  x?: number;
  y?: number;
  /** Where the point is on the real map (sample data: mock coordinates
   * around the city's centre). */
  lat?: number;
  lng?: number;
  /** Marketplace warehouse (Kargo "Marketpleysga" drop-offs only). */
  warehouse?: { marketplace: string };
};

export type ServiceType = "passenger" | "delivery";
/** How the passenger pays for a new order (design v2 Payment). The shared
 * seed's PaymentMethod (cash | card) stays as the stored order's field;
 * Payme and Click are paid in their apps. */
export type PayMethod = PaymentMethod | "payme" | "click";
/** Delivery is priced by the vehicle the client picks — no weight or volume. */
export type DeliveryVehicle = "spark" | "damas" | "labo" | "isuzu" | "isuzu2" | "fura";
export const DELIVERY_VEHICLES: DeliveryVehicle[] = ["spark", "damas", "labo", "isuzu", "isuzu2", "fura"];
/** What the delivery picker shows for one vehicle. Dimensions are the cargo
 * space in cm: width (along the vehicle) × depth × height. */
export type DeliveryVehicleSpec = {
  id: DeliveryVehicle;
  /** Size chip label — S, M, L, XL, XXL, 3XL. Not translated. */
  sizeLabel: string;
  descKey: string;
  dimensionsCm: { width: number; depth: number; height: number };
  maxWeightKg: number;
};
export type CargoTab = "city" | "intercity" | "marketplace";
export type CargoPricingMode = "route" | "hourly";
/** Everything Kargo prices on. Loaders, mode, hours and ride-along are
 * validated and priced by the adapter. */
export type CargoInput = {
  vehicle: DeliveryVehicle;
  note?: string;
  /** "Shahar ichi" / "Shaharlararo" / "Marketpleysga". */
  tab?: CargoTab;
  loaders?: number;
  pricingMode?: CargoPricingMode;
  /** Soatbay only. */
  hours?: number;
  /** "Men ham birga ketaman". */
  rideAlong?: boolean;
  /** "Sug'urta" (design v2 CargoTerms); terms and price come from the server. */
  insurance?: boolean;
};

export type CargoInfoTopic = "delivery" | "loaders" | "body" | "insurance";
/** Kargo limits and choices; the UI only renders them. */
export type CargoRules = {
  tabs: { id: CargoTab; labelKey: string }[];
  defaultTab: CargoTab;
  loaders: { counts: number[]; pricePerLoader: number; infoLines: { key: string; params?: Record<string, string | number> }[] };
  hours: { min: number; max: number };
  /** Pricing modes per tab, with a reason when one isn't offered. */
  pricingModes: Record<CargoTab, { id: CargoPricingMode; labelKey: string; available: boolean; reasonKey?: string }[]>;
  /** Extra drop-offs ("Yana manzil qo'shish") per tab. */
  maxExtraDropoffs: Record<CargoTab, number>;
  infoTopics: { id: CargoInfoTopic; labelKey: string }[];
  /** Whether cargo insurance can be added to the order. */
  insurance: { available: boolean };
};
export type CargoInfo = { titleKey: string; paragraphKeys: string[] };
export type RideAlong = { available: boolean; reasonKey?: string };
/** A person on a Kargo order: the sender may be "me". */
export type CargoContact = { name: string; phone: string };
/** Result of the adapter's readiness check for "Tasdiqlash". */
export type CargoCheck = { ready: boolean; issues: { field: string; messageKey: string }[] };
export type Warehouse = { address: Address; marketplace: string; distanceKm: number };

export type SeatPosition = "front" | "back-left" | "back-mid" | "back-right";
export type Seat = {
  id: SeatPosition;
  position: SeatPosition;
  taken: boolean;
  price: number;
};

/** Quote/validation/error text is returned as a translation key + params,
 * never as localized text — the UI maps it through useT(). */
export type QuoteLine = {
  key: string;
  params?: Record<string, string | number>;
  amount: number;
};

export type RouteSuggestion = {
  fromCityId: string;
  toCityId: string;
  distanceKm: number;
  /** One seat, from the server; null when it couldn't be priced. */
  fromPrice: number | null;
  label: string;
};

/** "now" is "Haydovchi istagan" — the driver picks the moment, no input.
 * "scheduled" is "Siz istagan". `date` is an ISO date (YYYY-MM-DD); orders
 * saved before ISO dates may still carry "today"/"tomorrow". `dateEnd` is set
 * only for a date range (the passenger can travel any day in date…dateEnd). */
export type OrderTiming =
  | { timeMode: "now" }
  | {
      timeMode: "scheduled";
      date: "today" | "tomorrow" | string;
      dateEnd?: string;
      timeKind: "exact" | "range";
      time?: string;
      timeRange?: { from: string; to: string };
    };

/** Booking-window rules the time picker clamps to. The adapter owns them
 * (and re-validates on create/update); the UI never hardcodes the numbers. */
export type SchedulingRules = {
  /** Days that can be booked, counting today (21 = today … today+20). */
  bookableDays: number;
  /** Longest date range, in days between the first and last day. */
  maxRangeDays: number;
  /** Shortest "dan"→"gacha" window, in minutes. */
  minRangeMinutes: number;
  /** Wheel granularity, in minutes. */
  stepMinutes: number;
};

/** "Tafsilotlar" for one route point. Every field is optional free text —
 * the adapter trims, drops empty fields and enforces the lengths in
 * OrderDetailsRules. */
export type AddressDetails = {
  /** Podyezd */
  entrance?: string;
  /** Qavat */
  floor?: string;
  /** Kvartira */
  apartment?: string;
  /** Domofon kodi — the UI never shows it unmasked outside its own input. */
  intercom?: string;
  /** Izoh */
  note?: string;
};

/** One intermediate stop between Qayerdan and Qayerga. */
export type RouteStop = {
  addressId: string;
  details?: AddressDetails;
};

export type CarClassId = "standart" | "komfort" | "biznes" | "miniven";
/** One "Klass" card. `price` is the adapter's total for the current order
 * with this class. */
export type CarClass = {
  id: CarClassId;
  nameKey: string;
  seats: number;
  price: number;
  available: boolean;
  reasonKey?: string;
  /** Minutes until a car of this class could arrive. */
  etaMinutes?: number;
};

/** "Kim ketadi?" — the passenger, or someone the passenger orders for. */
export type Rider = { kind: "me" } | { kind: "other"; name: string; phone: string };

/** "Bagaj" stepper bounds for a route; null when it isn't offered. */
export type LuggageRules = { min: number; max: number } | null;

export type PromoResult = {
  valid: boolean;
  discountPct: number;
  /** Legacy Uzbek text; the UI shows messageKey. */
  message: string;
  messageKey: string;
  /** The normalized code to put on the order. */
  code: string;
};

export type TipOptions = {
  allowed: boolean;
  /** Chip amounts, 0 = no tip. */
  presets: number[];
  min: number;
  max: number;
  sent?: { amount: number; reviewId: string; status: "pending" | "approved" | "rejected" };
};


/** A mock "follow my trip" link plus the share text (as a translation key). */
export type TripShare = { url: string; textKey: string; params: Record<string, string | number> };

/** Limits for the order-details inputs. The adapter owns them and
 * re-validates on quote/create/update; the UI only reads them for
 * maxLength attributes, counters and hiding "To'xtash qo'shish". */
export type OrderDetailsRules = {
  maxStops: number;
  commentMaxLength: number;
  /** Podyezd, Qavat, Kvartira. */
  addressFieldMaxLength: number;
  intercomMaxLength: number;
  addressNoteMaxLength: number;
  riderNameMaxLength: number;
};

export type QuoteInput = {
  serviceType: ServiceType;
  fromAddressId: string;
  toAddressId: string;
  /** Intermediate stops' address ids, in route order. */
  stops?: string[];
  mode: OrderMode;
  seatIds: string[];
  cargo?: CargoInput;
  carClass?: CarClassId;
  /** Only a code applyPromoCode() accepted. */
  promoCode?: string;
  /** The requested time (the real backend prices with it). */
  timing?: OrderTiming;
};

export type Quote = {
  distanceKm: number;
  lines: QuoteLine[];
  total: number;
  currency: "som";
  /** Pickup ETA, when the adapter knows one. */
  etaMinutes?: number;
  durationMinutes: number;
  /** When the trip would end (ms): pickup ETA + trip duration from now. */
  arrivalAt?: number;
};

export type CreateOrderInput = {
  serviceType: ServiceType;
  fromAddressId: string;
  toAddressId: string;
  mode: OrderMode;
  seatIds: string[];
  cargo?: CargoInput;
  paymentMethod: PayMethod;
  timing: OrderTiming;
  promoCode?: string;
  fromDetails?: AddressDetails;
  toDetails?: AddressDetails;
  stops?: RouteStop[];
  /** "Haydovchiga izoh". */
  comment?: string;
  carClass?: CarClassId;
  /** Bags, within getLuggageRules(). */
  luggage?: number;
  rider?: Rider;
  /** Kargo: "Jo'natuvchi" (default me) and "Qabul qiluvchi". */
  sender?: Rider;
  receiver?: CargoContact;
};

/** Everything about an order that isn't on the shared Order type (which
 * can't change — see seed/generate.ts) but that Tafsilotlar needs to show
 * and edit: the addresses actually picked and the requested timing. */
export type OrderExtras = {
  /** Payme / Click when chosen (the order's own field keeps cash | card). */
  payMethod?: PayMethod;
  fromAddressId: string;
  toAddressId: string;
  timing: OrderTiming;
  serviceType?: ServiceType;
  cargo?: CargoInput;
  fromDetails?: AddressDetails;
  toDetails?: AddressDetails;
  stops?: RouteStop[];
  comment?: string;
  carClass?: CarClassId;
  luggage?: number;
  rider?: Rider;
  promoCode?: string;
  sender?: Rider;
  receiver?: CargoContact;
};

export type UpdateOrderInput = Partial<{
  fromAddressId: string;
  toAddressId: string;
  mode: OrderMode;
  seatIds: string[];
  cargo: CargoInput;
  paymentMethod: PayMethod;
  timing: OrderTiming;
  fromDetails: AddressDetails;
  toDetails: AddressDetails;
  stops: RouteStop[];
  comment: string;
}>;

/** One search result: the point, its area (shown as a subtitle), distance
 * from the pickup, and — for entrance variants — the entrance the adapter
 * knows for that point ("…, 1-podyezd"). */
export type AddressSearchResult = {
  address: Address;
  area: string;
  /** From the pickup, when known. */
  distanceKm?: number;
  entrance?: string;
};

/** What a saved place is for (design v2 "Uy / Ish / Boshqa"). */
export type SavedPlaceKind = "home" | "work" | "other";

export type SavedAddressInfo = {
  address: Address;
  /** The passenger's name for it ("Uy", "Ish", …); unset: use address.label. */
  name?: string;
  /** Unset when the source doesn't keep a kind (current backend). */
  kind?: SavedPlaceKind;
  /** Area line under the name (region). */
  area?: string;
  /** Tafsilotlar remembered for this saved address. */
  details?: AddressDetails;
  /** From the pickup, when the adapter knows them. */
  distanceKm?: number;
  etaMinutes?: number;
};

export type OrderWithDetails = Order & {
  driver?: Driver;
  fromCity: City;
  toCity: City;
  ratingEditable: boolean;
  lockedReasonKey?: string;
  extras?: OrderExtras;
  /** Whether updateOrder() will currently accept changes (false once the
   * trip is in_progress or later). */
  editable: boolean;
  /** Server verdict: the passenger may cancel now. Unset = no verdict
   * (sample data: cancel is offered while searching or accepted). */
  canCancel?: boolean;
  /** The driver pressed "arrived" (status stays "accepted" in the UI). */
  driverArrived?: boolean;
  /** The server's price breakdown (sums to `price`), when it sends one. */
  priceLines?: QuoteLine[];
  /** Payme / Click: the provider page to pay on, when the server gives one. */
  paymentUrl?: string;
  /** A number the passenger can call for this trip (the driver's, or a relay). */
  driverPhone?: string;
  /** Minutes until the driver reaches the pickup (accepted, not arrived yet). */
  driverEtaMinutes?: number;
  /** After the driver arrived (`startedAt`, ms): free waiting ends at
   * `freeUntil`, then each minute costs `pricePerMinute` so'm. */
  waiting?: { startedAt: number; freeUntil: number; pricePerMinute: number };
  /** During the trip: kilometres driven and left, and the expected arrival (ms). */
  tripProgress?: { doneKm: number; leftKm: number; arrivalAt: number };
};

export type OrderHistoryPage = {
  orders: OrderWithDetails[];
  nextCursor: number | null;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  kind: "order" | "wallet" | "promo" | "system";
  /** Server notifications carry translation keys + params instead of text;
   * the screen translates them (or falls back to a generic title per kind). */
  titleKey?: string;
  bodyKey?: string;
  params?: Record<string, string | number>;
};

// Passenger wallet — distinct from the driver app's WalletEntry (which is
// seeded per-driver in seed/generate.ts and carries commission/debt
// concepts that don't apply to passengers). This type is client-only.
export type PassengerWalletEntryType = "topup" | "trip_payment" | "refund" | "bonus" | "commission" | "correction";

export type PassengerWalletEntry = {
  id: string;
  type: PassengerWalletEntryType;
  amount: number; // positive = credit to wallet, negative = debit
  createdAt: number;
  balanceAfter: number;
  orderId?: string;
};

export type WalletSummary = {
  balance: number;
  lowBalance: boolean;
  entries: PassengerWalletEntry[];
};

export type SavedCard = {
  id: string;
  label: string;
  last4: string;
  brand: "uzcard" | "humo" | "visa";
};

export type Profile = {
  id: string;
  name: string;
  /** Set when the source keeps them apart (the API does). */
  firstName?: string;
  lastName?: string;
  phoneMasked: string;
  avatarSeed: string;
  rating: number;
  totalTrips: number;
};

/** What the active adapter can do. The sample-data adapter does everything;
 * the http adapter only what api/openapi.yml has endpoints for. Screens hide
 * or disable a feature whose flag is false (no faked data, no broken screen). */
export type ClientCapabilities = {
  /** Quote, cities, address search/reverse geocoding, saved addresses, seat
   * map, classes, options, stops, cargo: the whole order-building flow. */
  ordering: boolean;
  /** "Tafsilotlar" editing of a live order (addresses, stops, seats, options). */
  orderDetails: boolean;
  /** Re-run "search again" for a no-driver order. */
  repeatOrder: boolean;
  /** Server-side status filter on the order history. */
  historyStatusFilter: boolean;
  tips: boolean;
  /** Trip share link and support phone (SOS). */
  safety: boolean;
  popularRoutes: boolean;
  /** "Oxirgi yo'nalishlar" on Home (the passenger's own last routes). */
  recentRoutes: boolean;
  promo: boolean;
  bonuses: boolean;
  help: boolean;
  /** List of linked cards (linking itself is walletCardLink). */
  savedCards: boolean;
  /** Several accounts on one device. */
  accounts: boolean;
  phoneChange: boolean;
  accountDeletion: boolean;
  /** Separate "order status" and "bonus" notification switches. */
  notificationTopics: boolean;
  /** Intermediate stops (Taksi) and extra drop-offs (Kargo). */
  stops: boolean;
  /** The luggage stepper ("Bagaj soni"). Wishes were removed (2026-11-22). */
  orderOptions: boolean;
  /** "Kim ketadi?" — ordering for someone else. */
  rider: boolean;
  /** Tafsilotlar (Podyezd, Qavat…) on a route point of the order. */
  addressDetails: boolean;
  /** Kargo tabs, loaders, hourly mode, ride-along, sender/receiver,
   * marketplace warehouses and the info sheets. */
  cargoExtras: boolean;
  /** Picking a point on the map (the map must be geographic for that). */
  mapPick: boolean;
  /** Pickup ETA on Home and per class. */
  pickupEta: boolean;
  /** Tafsilotlar may change the pickup of a live order (else only the drop-off). */
  editPickup: boolean;
  /** A comment with any rating, next to the reasons. Off: only with 5 stars,
   * sent in place of a reason (the contract keeps one reason). */
  ratingNote: boolean;
};

/** A live order change pushed by the server (WebSocket) — screens refetch. */
export type OrderEvent = { orderId: string };

/** Where the driver of an order is, for the map.
 * - "position": a GPS fix pushed by the server.
 * - "progress": the sample data has no GPS — it says how far along the leg
 *   the car is (0…1) and where the driver set off from; the screen places
 *   the car on the route it has drawn. */
export type DriverLocation =
  | { orderId: string; kind: "position"; lat: number; lng: number }
  | { orderId: string; kind: "progress"; leg: "to_pickup" | "trip"; fraction: number; start: { lat: number; lng: number } };

export type OtpRequestResult = {
  requestId: string;
  /** Sample-data adapter only: the code to autofill. A real backend never
   * returns it (the code arrives by SMS). */
  testCode?: string;
  /** Seconds until "resend" is allowed (server's resend_after). */
  resendAfterSec?: number;
  /** Digits in the code the server sent (server's code_length), when it says. */
  codeLength?: number;
};

export type NotificationPrefs = {
  master: boolean;
  orderStatus: boolean;
  news: boolean;
  bonus: boolean;
};

export type AccountSummary = {
  id: string;
  name: string;
  phoneMasked: string;
  avatarSeed: string;
  active: boolean;
};

export type HelpTopic = "order" | "payment" | "app" | "other";

export type HelpRequest = {
  id: string;
  topicKey: string;
  message?: string;
  status: "pending" | "in_review" | "resolved";
  createdAt: number;
};

export type BonusSummary = {
  balance: number;
  minWithdraw: number;
  monthlyMax: number;
  monthlyWithdrawn: number;
  canWithdraw: boolean;
  /** 0-1 progress toward minWithdraw (capped at 1). */
  progress: number;
};

export type BonusAction = "goto_order" | "invite" | "rate_trip";
export type BonusSourceIcon = "order" | "invite" | "rate";

export type BonusSource = {
  id: string;
  icon: BonusSourceIcon;
  titleKey: string;
  descriptionKey: string;
  amountThisMonth: number;
  action: BonusAction;
};

export type BonusHistoryEntry = {
  id: string;
  sourceId: string;
  type: "earn" | "withdraw";
  amount: number;
  createdAt: number;
};

export type BonusHistoryPage = {
  entries: BonusHistoryEntry[];
  nextCursor: number | null;
};
