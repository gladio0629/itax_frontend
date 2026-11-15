import type { DeliveryVehicleSpec,
  AddressSearchResult,
  AddressDetails,
  CargoCheck,
  CargoContact,
  CargoInfo,
  CargoInfoTopic,
  CargoInput,
  CargoRules,
  RideAlong,
  Warehouse,
  CarClass,
  CarClassId,
  EmergencyContact,
  EmergencyContacts,
  LuggageRules,
  PromoResult,
  Rider,
  TipOptions,
  TripShare,
  CommentHint,
  OrderDetailsRules,
  OrderOption,
  OrderOptionId,
  ServiceType,
  SchedulingRules,
  AccountSummary,
  Address,
  BonusHistoryPage,
  BonusSource,
  BonusSummary,
  City,
  CreateOrderInput,
  HelpRequest,
  HelpTopic,
  NotificationItem,
  NotificationPrefs,
  OrderHistoryPage,
  OrderStatus,
  OrderWithDetails,
  OtpRequestResult,
  Profile,
  Quote,
  QuoteInput,
  ReviewRequest,
  RouteSuggestion,
  SavedAddressInfo,
  SavedCard,
  Seat,
  UpdateOrderInput,
  WalletSummary,
  ClientCapabilities,
  OrderEvent,
} from "./types";

/**
 * Every screen talks to the app exclusively through this interface.
 * `mockAdapter` implements it fully against the local sample data.
 * `httpAdapter` implements what api/openapi.yml has endpoints for; the rest
 * rejects with ApiError("NOT_SUPPORTED") and `capabilities` tells screens
 * to hide those features.
 */
export interface ApiAdapter {
  readonly capabilities: ClientCapabilities;
  /** How many digits an SMS code can have (the contract allows 4–6). */
  readonly otpLength: { min: number; max: number };

  // --- session (the sample-data adapter keeps no session: null / no-ops) ---
  /** null when the adapter doesn't track sessions (the store's flag decides). */
  hasSession(): boolean | null;
  /** After a reload: refresh tokens and reconnect realtime. Never throws. */
  resumeSession(): Promise<void>;
  /** Revoke on the server, then clear tokens, storage and the socket. */
  logout(): Promise<void>;
  /** The session ended (expired, revoked, logout) — go to login. */
  onSessionEnd(listener: () => void): () => void;
  /** Server-pushed order changes (WebSocket). */
  onOrderEvent(listener: (event: OrderEvent) => void): () => void;

  /** "Search again" for an order that found no driver: re-sends it. The
   * fallback fills what an old order doesn't record (sample data only). */
  repeatOrder(
    orderId: string,
    fallback: Pick<CreateOrderInput, "serviceType" | "mode" | "seatIds" | "cargo" | "paymentMethod" | "timing">
  ): Promise<OrderWithDetails>;

  getCities(): Promise<City[]>;
  getPopularRoutes(): Promise<RouteSuggestion[]>;
  getRecentRoutes(): Promise<RouteSuggestion[]>;
  getAddressSuggestions(query: string, excludeCityId?: string, onlyCityId?: string): Promise<Address[]>;
  /** Search with area, distance from the pickup and entrance variants. */
  searchAddresses(input: { query: string; fromAddressId?: string; excludeCityId?: string; onlyCityId?: string }): Promise<AddressSearchResult[]>;
  getRecentAddresses(): Promise<Address[]>;
  getSavedAddresses(fromAddressId: string): Promise<SavedAddressInfo[]>;
  reverseGeocode(x: number, y: number, excludeCityId?: string, onlyCityId?: string): Promise<Address>;
  getPickupEta(): Promise<{ minutes: number }>;
  getSeatMap(input: { fromAddressId: string; toAddressId: string }): Promise<Seat[]>;
  getQuote(input: QuoteInput): Promise<Quote>;
  getDeliveryVehicles(): Promise<DeliveryVehicleSpec[]>;
  getSchedulingRules(): Promise<SchedulingRules>;

  getOrderDetailsRules(): Promise<OrderDetailsRules>;
  /** Add-ons available for a service type (none for Dostavka). */
  getOrderOptions(input: { serviceType: ServiceType; carClass?: CarClassId }): Promise<OrderOption[]>;
  getCommentHints(input: {
    text: string;
    serviceType: ServiceType;
    carClass?: CarClassId;
    selectedOptionIds: OrderOptionId[];
  }): Promise<CommentHint[]>;
  /** Class cards for the current order; each price is that class's total. */
  getCarClasses(input: QuoteInput): Promise<CarClass[]>;
  getLuggageRules(route: { fromAddressId: string; toAddressId: string }): Promise<LuggageRules>;
  /** Normalizes "Kim ketadi?"; throws an ApiError with a translation key. */
  validateRider(rider: Rider): Promise<Rider>;

  getTipOptions(orderId: string): Promise<TipOptions>;
  sendTip(orderId: string, amount: number): Promise<ReviewRequest>;

  getTripShareLink(orderId: string): Promise<TripShare>;
  getEmergencyContacts(): Promise<EmergencyContacts>;
  addEmergencyContact(contact: { name: string; phone: string }): Promise<EmergencyContact>;
  removeEmergencyContact(id: string): Promise<void>;
  getSupportContact(): Promise<{ phone: string }>;

  getCargoRules(): Promise<CargoRules>;
  /** Warehouses for "Marketpleysga", nearest to the pickup first. */
  getMarketplaceWarehouses(fromAddressId: string): Promise<Warehouse[]>;
  getCargoInfo(topic: CargoInfoTopic): Promise<CargoInfo>;
  /** Whether "Men ham birga ketaman" fits: free cab seats after loaders. */
  getRideAlong(input: { vehicle: CargoInput["vehicle"]; loaders: number }): Promise<RideAlong>;
  /** Whether a Kargo order can be confirmed, and what's missing. */
  checkCargo(input: {
    fromAddressId: string;
    toAddressId: string;
    stops: string[];
    cargo: CargoInput;
    sender: Rider;
    receiver: CargoContact;
  }): Promise<CargoCheck>;
  /** Details remembered for a saved address, or null. */
  getSavedAddressDetails(addressId: string): Promise<AddressDetails | null>;
  /** Validates and normalizes Tafsilotlar; a saved address remembers them. */
  saveAddressDetails(addressId: string, details: AddressDetails): Promise<AddressDetails>;

  requestOtp(phone: string): Promise<OtpRequestResult>;
  verifyOtp(requestId: string, code: string): Promise<ReviewRequest>;
  getReviewStatus(reviewId: string): Promise<ReviewRequest>;

  createOrder(input: CreateOrderInput): Promise<OrderWithDetails>;
  getOrder(orderId: string): Promise<OrderWithDetails>;
  updateOrder(orderId: string, patch: UpdateOrderInput): Promise<OrderWithDetails>;
  cancelOrder(orderId: string, reason: string): Promise<OrderWithDetails>;
  rateOrder(orderId: string, rating: number, reasons?: string[], note?: string): Promise<OrderWithDetails>;
  getOrderHistory(params?: { status?: OrderStatus; cursor?: number }): Promise<OrderHistoryPage>;

  getSavedCards(): Promise<SavedCard[]>;
  /** `provider` is required by the real backend (walletCardLink); the
   * response redirects to the provider's page. */
  linkCard(payload: { label: string; provider?: "payme" | "click" }): Promise<ReviewRequest>;

  getNotifications(): Promise<NotificationItem[]>;
  markNotificationRead(id: string): Promise<void>;

  getProfile(): Promise<Profile>;

  getWallet(): Promise<WalletSummary>;

  applyPromoCode(code: string): Promise<PromoResult>;

  getBonusSummary(): Promise<BonusSummary>;
  getBonusSources(): Promise<BonusSource[]>;
  getBonusHistory(params?: { type?: "earn" | "withdraw"; cursor?: number }): Promise<BonusHistoryPage>;
  requestBonusWithdraw(amount: number): Promise<ReviewRequest>;

  getNotificationPrefs(): Promise<NotificationPrefs>;
  setNotificationPrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs>;

  getAccounts(): Promise<AccountSummary[]>;
  switchAccount(id: string): Promise<AccountSummary[]>;
  addAccount(payload: { name: string; phone: string }): Promise<ReviewRequest>;
  deleteAccount(id: string): Promise<ReviewRequest>;
  requestAccountDeletion(): Promise<ReviewRequest>;

  requestPhoneChange(newPhone: string): Promise<OtpRequestResult>;
  confirmPhoneChange(requestId: string, code: string, newPhone: string): Promise<ReviewRequest>;
  updateProfileName(firstName: string, lastName: string): Promise<Profile>;

  submitHelpRequest(topic: HelpTopic, message?: string): Promise<ReviewRequest>;
  getHelpRequests(): Promise<HelpRequest[]>;

  submitSupportTicket(message: string): Promise<ReviewRequest>;
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method}: httpAdapter is not implemented yet. Wire it to the real IZGO backend.`);
  }
}
