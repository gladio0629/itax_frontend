// Hand-written types for api/openapi.yml (IZGO Taxi Platform API 0.1.0).
// The YAML is the only source of truth: field names, enums and nullability
// below mirror it one to one. Do not add fields that the contract doesn't
// declare. Money is an integer in tiyin (1 UZS = 100 tiyin). IDs are UUIDs.

export type Uuid = string;
/** ISO 8601 date-time. */
export type DateTime = string;
/** ISO 8601 date (YYYY-MM-DD). */
export type DateOnly = string;
/** Integer, tiyin. */
export type Money = number;
/** +998 followed by 9 digits. */
export type Phone = string;

// ------------------------------------------------------------------ common
export type ApiErrorBody = { error: { key: string; params: Record<string, unknown> } };

export type GeoPoint = { lat: number; lng: number; address?: string };

export type CursorPage<T> = { data: T[]; cursor: string | null };

/** `?cursor=&limit=` (limit 1–100, default 20). */
export type PageQuery = { cursor?: string; limit?: number };

// -------------------------------------------------------------------- auth
export type OtpRequest = { phone: Phone };
export type OtpRequestResult = { expires_in: number; resend_after: number };
export type OtpVerify = { phone: Phone; code: string };
export type RefreshRequest = { refresh_token: string };
export type TokenPair = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
  is_new_user?: boolean;
};

export type AdminLoginEmail = { email: string };
export type AdminLoginChallenge = { challenge_id: Uuid; expires_in: number };
/** Either { challenge_id, email_code, phone } or { phone } (operator without email). */
export type AdminLoginSms = { phone: Phone; challenge_id?: Uuid; email_code?: string };
export type AdminLoginVerify = { challenge_id: Uuid; sms_code: string };
export type AdminToken = { access_token: string; expires_in: number; token_type: "Bearer" };

// ------------------------------------------------------------------ driver
export type DriverState = "draft" | "pending_review" | "active" | "rejected" | "blocked";
export type CarClass = "economy" | "comfort" | "business" | "minivan";
export type Car = {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate_number: string;
  car_class: CarClass;
  seats: number;
};
export type DriverProfile = {
  id: Uuid;
  user_id: Uuid;
  phone: Phone;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  car?: Car;
  state: DriverState;
  rating: number;
  trips_count?: number;
};
export type DriverProfileUpdate = { first_name?: string; last_name?: string; avatar_document_id?: Uuid };

export type RegistrationStep1 = { first_name: string; last_name: string; birth_date: DateOnly; city: string };
export type RegistrationStep2 = { car: Car };
export type DocumentKind =
  | "license_front"
  | "license_back"
  | "tech_passport_front"
  | "tech_passport_back"
  | "passport"
  | "selfie"
  | "car_photo"
  | "avatar";
export type RegistrationStep3 = { documents: { kind: Exclude<DocumentKind, "avatar">; document_id: Uuid }[] };
export type RegistrationStep4 = { accept_terms: true };
export type RegistrationState = { current_step: number; completed_steps: number[]; state: DriverState };

export type UploadUrlRequest = { kind: DocumentKind; content_type: "image/jpeg" | "image/png"; size_bytes: number };
export type UploadUrl = {
  document_id: Uuid;
  upload_url: string;
  method: "PUT";
  headers?: Record<string, string>;
  expires_at: DateTime;
};
export type LocationUpdate = { lat: number; lng: number };
export type DriverStatus = { state: DriverState; reason?: string | null; updated_at: DateTime };

// ------------------------------------------------------------------ orders
export type OrderType = "passenger" | "delivery";
export type PaymentMethod = "cash" | "card" | "wallet" | "payme" | "click";
export type VehicleType = "spark" | "damas" | "labo" | "isuzu" | "isuzu2" | "fura";
export type OrderStatus = "searching" | "accepted" | "arrived" | "in_progress" | "completed" | "cancelled" | "expired";

/** passenger: `seats` OR `car_class`; delivery: `vehicle_type` only. */
export type OrderCreate = {
  type: OrderType;
  seats?: number;
  car_class?: CarClass;
  vehicle_type?: VehicleType;
  from: GeoPoint;
  to: GeoPoint;
  scheduled_at?: DateTime;
  payment_method: PaymentMethod;
  comment?: string;
};
export type OrderUpdate = {
  seats?: number;
  car_class?: CarClass;
  vehicle_type?: VehicleType;
  to?: GeoPoint;
  scheduled_at?: DateTime;
  payment_method?: PaymentMethod;
  comment?: string;
};
export type OrderCancelReason = "changed_plans" | "long_wait" | "driver_asked" | "wrong_address" | "other";
export type OrderCancel = { reason?: OrderCancelReason; comment?: string };
export type OrderDriver = { id?: Uuid; first_name?: string; rating?: number; car?: Car };
export type Order = {
  id: Uuid;
  type: OrderType;
  seats?: number;
  car_class?: CarClass;
  vehicle_type?: VehicleType;
  from: GeoPoint;
  to: GeoPoint;
  scheduled_at?: DateTime | null;
  payment_method: PaymentMethod;
  comment?: string | null;
  status: OrderStatus;
  price: Money;
  distance_m?: number;
  duration_s?: number;
  driver?: OrderDriver | null;
  trip_id?: Uuid | null;
  created_at: DateTime;
};
export type OrderPage = CursorPage<Order>;

// ----------------------------------------------------------------- ratings
export type RatingReasonKind = "polite" | "good_talk" | "comfort" | "just_because" | "custom";
/** `reason` only (and required) when stars = 5; `custom_text` only for kind custom. */
export type RatingInput = { stars: number; reason?: { kind: RatingReasonKind; custom_text?: string } };
export type Rating = {
  order_id: Uuid;
  stars: number;
  reason?: { kind?: RatingReasonKind; custom_text?: string | null } | null;
  created_at: DateTime;
  updated_at?: DateTime | null;
};

// ------------------------------------------------------------------- trips
export type Offer = {
  id: Uuid;
  order_id: Uuid;
  type: OrderType;
  seats?: number;
  car_class?: CarClass;
  vehicle_type?: VehicleType;
  from: GeoPoint;
  to: GeoPoint;
  price: Money;
  commission?: Money;
  distance_m?: number;
  pickup_eta_s?: number;
  expires_at: DateTime;
};
export type OfferPage = CursorPage<Offer>;
export type TripStatus = "assigned" | "in_progress" | "completed" | "cancelled";
export type Trip = {
  id: Uuid;
  order_id: Uuid;
  driver_id: Uuid;
  status: TripStatus;
  started_at?: DateTime | null;
  completed_at?: DateTime | null;
  final_price?: Money | null;
  commission?: Money | null;
  distance_m?: number | null;
};

// ------------------------------------------------------------------ wallet
export type WalletBalance = {
  wallet_id: Uuid;
  balance: Money;
  debt: Money;
  debt_limit: Money;
  limit_reached: boolean;
  debt_status?: "ok" | "approaching" | "at_limit";
  currency: "UZS";
};
export type LedgerKind = "trip_payment" | "commission" | "topup" | "correction" | "bonus";
export type LedgerEntry = {
  id: Uuid;
  wallet_id: Uuid;
  kind: LedgerKind;
  amount: Money;
  balance_after: Money;
  reference_id?: Uuid | null;
  created_at: DateTime;
};
export type LedgerPage = CursorPage<LedgerEntry>;
export type PayProvider = "payme" | "click";
/** amount: 100000…1000000000 tiyin. */
export type TopupRequest = { amount: Money; provider: PayProvider };
export type TopupSession = {
  payment_id: Uuid;
  status: "pending" | "paid" | "failed";
  redirect_url: string;
  expires_at?: DateTime;
};
export type CardLinkRequest = { provider: PayProvider };
export type CardLinkSession = { link_id: Uuid; redirect_url: string; expires_at: DateTime };

// ----------------------------------------------------------- notifications
export type NotificationKind = "order" | "trip" | "wallet" | "driver" | "system" | "promo";
export type Notification = {
  id: Uuid;
  kind: NotificationKind;
  title_key: string;
  body_key?: string;
  params: Record<string, unknown>;
  read: boolean;
  created_at: DateTime;
};
export type NotificationPage = CursorPage<Notification>;

/** WebSocket /ws server → client message. All values are strings. */
export type RealtimeEventType =
  | "order.created"
  | "offer.created"
  | "order.accepted"
  | "trip.completed"
  | "wallet.limit_reached"
  | "driver.approved";
export type RealtimeEvent = { type: RealtimeEventType; id: string; status?: string; order_id?: string };

// ----------------------------------------------------------------- profile
export type Settings = {
  language?: "uz" | "ru" | "en";
  theme?: "light" | "dark" | "system";
  notifications?: { push?: boolean; sms?: boolean; promo?: boolean };
};
export type Profile = {
  id: Uuid;
  phone: Phone;
  first_name?: string | null;
  last_name?: string | null;
  role: "passenger" | "driver";
  rating?: number | null;
  settings: Settings;
  created_at?: DateTime;
};
export type ProfileUpdate = { first_name?: string; last_name?: string };

// ------------------------------------------------------------------- admin
export type StaffRole = "superadmin" | "owner" | "manager" | "marketer" | "operator";
export type AdminSection = "staff" | "drivers" | "passengers" | "orders" | "wallet" | "tariffs" | "operator" | "stats";
export type AdminMe = {
  id: Uuid;
  email: string;
  full_name?: string;
  role: StaffRole;
  sections: AdminSection[];
  creatable_roles: StaffRole[];
};
export type StaffState = "active" | "blocked" | "archived";
export type Staff = {
  id: Uuid;
  email: string | null;
  phone: Phone;
  full_name: string;
  role: StaffRole;
  state: StaffState;
  created_at: DateTime;
};
/** email required unless role = operator. */
export type StaffCreate = { email?: string | null; phone: Phone; full_name: string; role: StaffRole };
export type StaffUpdate = { phone?: Phone; full_name?: string; role?: StaffRole; state?: "active" | "blocked" };
export type StaffPage = CursorPage<Staff>;
export type StaffQuery = PageQuery & { role?: StaffRole };

export type AccountState = "active" | "blocked" | "archived";
export type AdminPersonCreate = { phone: Phone; first_name: string; last_name: string };
/** state_reason required when state = blocked. */
export type AdminPersonUpdate = { first_name?: string; last_name?: string; state?: AccountState; state_reason?: string };
export type AdminDriver = {
  id: Uuid;
  phone: Phone;
  first_name: string;
  last_name: string;
  state: AccountState;
  state_reason?: string | null;
  driver_state: DriverState;
  car?: Car;
  rating?: number;
  trips_count?: number;
  wallet_balance?: Money;
  created_at: DateTime;
};
export type AdminDriverPage = CursorPage<AdminDriver>;
export type AdminPassenger = {
  id: Uuid;
  phone: Phone;
  first_name?: string | null;
  last_name?: string | null;
  state: AccountState;
  state_reason?: string | null;
  rating?: number | null;
  orders_count?: number;
  created_at: DateTime;
};
export type AdminPassengerPage = CursorPage<AdminPassenger>;
export type PersonQuery = PageQuery & { state?: AccountState; q?: string };
export type AdminOrdersQuery = PageQuery & { status?: OrderStatus; from_date?: DateOnly; to_date?: DateOnly };
export type AdminLedgerQuery = PageQuery & { wallet_id?: Uuid; driver_id?: Uuid };

export type ApprovalStatus = "pending_approval" | "approved" | "rejected";
/** amount ≠ 0, signed tiyin; reason 5–500 chars. */
export type CorrectionCreate = { wallet_id: Uuid; amount: Money; reason: string };
export type Correction = {
  id: Uuid;
  wallet_id: Uuid;
  amount: Money;
  reason: string;
  approval_status: ApprovalStatus;
  created_by: Uuid;
  approved_by?: Uuid | null;
  reject_reason?: string | null;
  created_at: DateTime;
};
/** reason 3–500 chars. */
export type ApprovalReject = { reason: string };

export type TariffFields = {
  name: string;
  car_class: CarClass;
  base_fare: Money;
  per_km: Money;
  per_min: Money;
  min_fare: Money;
  commission_percent: number;
};
export type TariffInput = TariffFields;
export type Tariff = TariffFields & {
  id: Uuid;
  active: boolean;
  approval_status: ApprovalStatus;
  pending_change?: { action?: "create" | "update" | "delete"; requested_by?: Uuid; requested_at?: DateTime } | null;
  updated_at?: DateTime;
};
export type TariffPage = CursorPage<Tariff>;

export type QueueKind = "driver_application" | "document_update" | "complaint";
export type QueueStatus = "waiting" | "in_progress" | "completed" | "rejected";
export type QueueItem = {
  id: Uuid;
  kind: QueueKind;
  subject_id: Uuid;
  status: QueueStatus;
  assigned_to?: Uuid | null;
  result?: "resolved" | "unresolved" | null;
  comment?: string | null;
  reject_reason?: string | null;
  created_at: DateTime;
  finished_at?: DateTime | null;
};
export type QueueReject = { reason: string };
export type QueueComplete = { result: "resolved" | "unresolved"; comment?: string };
export type QueuePage = CursorPage<QueueItem>;

export type StatsQuery = { from_date?: DateOnly; to_date?: DateOnly };
export type Stats = {
  orders_total: number;
  orders_completed: number;
  orders_cancelled: number;
  active_drivers: number;
  online_drivers: number;
  new_passengers: number;
  revenue: Money;
  commission: Money;
  drivers_over_limit?: number;
};

// ------------------------------------------------------------------ paths
/** Every path in the contract (70 operations), for grep-ability. */
export const API_PATHS = {
  otpRequest: "/api/v1/auth/otp/request",
  otpVerify: "/api/v1/auth/otp/verify",
  tokenRefresh: "/api/v1/auth/token/refresh",
  logout: "/api/v1/auth/logout",
  adminLoginEmail: "/admin/v1/auth/login/email",
  adminLoginSms: "/admin/v1/auth/login/sms",
  adminLoginVerify: "/admin/v1/auth/login/verify",
  driverMe: "/api/v1/drivers/me",
  driverRegistrationStep: (step: 1 | 2 | 3 | 4) => `/api/v1/drivers/registration/step/${step}`,
  driverDocumentUploadUrl: "/api/v1/drivers/documents/upload-url",
  locationUpdate: "/api/v1/location/update",
  driverStatus: "/api/v1/drivers/me/status",
  orders: "/api/v1/orders",
  orderHistory: "/api/v1/orders/history",
  order: (id: Uuid) => `/api/v1/orders/${encodeURIComponent(id)}`,
  orderCancel: (id: Uuid) => `/api/v1/orders/${encodeURIComponent(id)}/cancel`,
  orderRate: (id: Uuid) => `/api/v1/orders/${encodeURIComponent(id)}/rate`,
  tripOffers: "/api/v1/trips/offers",
  tripOfferAccept: (id: Uuid) => `/api/v1/trips/offers/${encodeURIComponent(id)}/accept`,
  tripStart: (id: Uuid) => `/api/v1/trips/${encodeURIComponent(id)}/start`,
  tripComplete: (id: Uuid) => `/api/v1/trips/${encodeURIComponent(id)}/complete`,
  walletBalance: "/api/v1/wallet/balance",
  walletLedger: "/api/v1/wallet/ledger",
  walletTopup: "/api/v1/wallet/topup",
  walletCardLink: "/api/v1/wallet/card/link",
  notifications: "/api/v1/notifications",
  notificationRead: (id: Uuid) => `/api/v1/notifications/${encodeURIComponent(id)}/read`,
  websocket: "/ws",
  profile: "/api/v1/profile",
  profileSettings: "/api/v1/profile/settings",
  adminMe: "/admin/v1/me",
  adminStaff: "/admin/v1/staff",
  adminStaffItem: (id: Uuid) => `/admin/v1/staff/${encodeURIComponent(id)}`,
  adminDrivers: "/admin/v1/drivers",
  adminDriver: (id: Uuid) => `/admin/v1/drivers/${encodeURIComponent(id)}`,
  adminPassengers: "/admin/v1/passengers",
  adminPassenger: (id: Uuid) => `/admin/v1/passengers/${encodeURIComponent(id)}`,
  adminOrders: "/admin/v1/orders",
  adminOrder: (id: Uuid) => `/admin/v1/orders/${encodeURIComponent(id)}`,
  adminWalletLedger: "/admin/v1/wallet/ledger",
  adminWalletCorrection: "/admin/v1/wallet/correction",
  adminWalletCorrectionApprove: (id: Uuid) => `/admin/v1/wallet/correction/${encodeURIComponent(id)}/approve`,
  adminWalletCorrectionReject: (id: Uuid) => `/admin/v1/wallet/correction/${encodeURIComponent(id)}/reject`,
  adminTariffs: "/admin/v1/tariffs",
  adminTariff: (id: Uuid) => `/admin/v1/tariffs/${encodeURIComponent(id)}`,
  adminTariffApprove: (id: Uuid) => `/admin/v1/tariffs/${encodeURIComponent(id)}/approve`,
  adminTariffReject: (id: Uuid) => `/admin/v1/tariffs/${encodeURIComponent(id)}/reject`,
  adminOperatorQueue: "/admin/v1/operator/queue",
  adminOperatorStart: (id: Uuid) => `/admin/v1/operator/queue/${encodeURIComponent(id)}/start`,
  adminOperatorReject: (id: Uuid) => `/admin/v1/operator/queue/${encodeURIComponent(id)}/reject`,
  adminOperatorComplete: (id: Uuid) => `/admin/v1/operator/queue/${encodeURIComponent(id)}/complete`,
  adminOperatorHistory: "/admin/v1/operator/history",
  adminStats: "/admin/v1/stats",
} as const;
// Not wrapped: PUT /api/v1/drivers/documents/{id}/content — always called
// through the signed `upload_url` from upload-url (HttpClient.uploadFile).
