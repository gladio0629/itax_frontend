# Client app (passenger) — adapter ↔ contract

Source of truth: `api/openapi.yml`. The http adapter is `client/src/api/adapters/http.ts`, and every
field and shape conversion lives in `client/src/api/httpMapper.ts`. Money in the API is in tiyin
and the UI uses so'm (÷100 / ×100 in the mapper).

## Method → operation

| Adapter method | operationId | Notes / mismatches |
|---|---|---|
| requestOtp(phone) | authOtpRequest | UI phone `+998 90 123 45 67` → `+998901234567`. `resend_after` drives the resend timer. No `requestId` in the API: the adapter keeps the phone in memory under a local id. |
| verifyOtp(requestId, code) | authOtpVerify | Returns TokenPair. The UI expects a ReviewRequest, so the adapter returns one that is already approved (no timers). The UI has 4 code boxes; the contract allows 4–6 digits. |
| getReviewStatus(id) | — (local) | Returns results that are already settled. |
| logout() | authLogout | Shared session: revoke, then clear tokens, storage and the socket. |
| (refresh) | authTokenRefresh | Shared HTTP client (single flight). |
| getProfile() | profileGet | `first_name + last_name` → name. **Missing:** `trips_count`, avatar. |
| updateProfileName(first, last) | profileUpdate | — |
| getNotificationPrefs / setNotificationPrefs | profileGet / profileSettingsUpdate | UI {master, orderStatus, news, bonus}; API notifications {push, sms, promo}. master↔push, news↔promo. **Missing:** a per-topic orderStatus/bonus flag (rows hidden in http mode); `sms` has no UI. |
| createOrder(input) | orderCreate (+Idempotency-Key) | UI sends local address ids and cities. The API needs GeoPoints, and there is no endpoint that turns a picked place into lat/lng. **Ordering is hidden** (see below). |
| repeatOrder(orderId) | orderGet + orderCreate | "Search again" re-sends the same type, seats/car_class/vehicle_type, from, to, payment_method and comment. |
| getOrder(id) | orderGet | GeoPoint `address` → place name. `distance_m` → km. `arrived` → UI `accepted`, `expired` → UI `no_driver`. Payment `wallet/payme/click` → UI `card`. **Missing:** the order's rating, the cancel reason, `editable`, `ratingEditable` / locked reason, per-seat ids, driver phone, car colour hex, driver avatar. |
| updateOrder(id, patch) | orderUpdate | Only `comment`, `payment_method` and `timing` (as a single `scheduled_at`) map. Address-id, stops and options patches can't be expressed. The details sheet is hidden in http mode. |
| cancelOrder(id, reason) | orderCancel | UI reasons: plansChanged→`changed_plans`, waitedTooLong→`long_wait`, other→`other`. **No enum value** for "price reconsidered" or "chose another way" (sent as `other`). |
| rateOrder(id, stars, reasons, note) | orderRate, orderRateUpdate on 403 already_rated | UI is multi-select (polite, conversation, comfort, simple, other+note). The API takes **one** reason, only for 5 stars: polite→polite, conversation→good_talk, comfort→comfort, simple→just_because, other+note→custom. |
| getOrderHistory({status, cursor}) | orderHistory | Opaque cursor kept by the adapter (UI pages by number). **Missing:** a `status` filter (tabs hidden in http mode). |
| getNotifications() | notificationsList | `title_key`/`body_key` + params are translated when the app has the key; otherwise a generic title per kind. Only the first page is loaded. |
| markNotificationRead(id) | notificationMarkRead | — |
| getWallet() | walletBalance + walletLedger | `debt_status != ok` / `limit_reached` → lowBalance. Ledger kinds `commission`, `correction` are shown as their own types. The wallet screen isn't routed in the client app. |
| linkCard({label, provider}) | walletCardLink | API takes `provider` (payme/click) and redirects to `redirect_url`. The UI's card label has no API field. |
| getSavedCards() | **NONE** | No list of linked cards. |
| (realtime) | notificationsWebSocket | `order.accepted`, `trip.completed`, `order.created` → refetch of the tracked order. |
| getCities, getPopularRoutes, getRecentRoutes | **NONE** | |
| getAddressSuggestions, searchAddresses, getRecentAddresses, reverseGeocode | **NONE** | No geocoding or search. |
| getSavedAddresses, getSavedAddressDetails, saveAddressDetails | **NONE** | |
| getPickupEta, getQuote, getCarClasses, getSeatMap | **NONE** | Price only arrives after create. No quote and no class list with prices. Seat map: API has a `seats` count only. |
| getDeliveryVehicles, getCargoRules, getMarketplaceWarehouses, getCargoInfo, getRideAlong, checkCargo | **NONE** | `vehicle_type` enum exists, but there are no specs (S…3XL sizes, dimensions, weight), loaders, hourly mode or ride-along. |
| getSchedulingRules | **NONE** | The UI books a day range plus a time window; the API has a single `scheduled_at`. |
| getOrderDetailsRules, getOrderOptions, getCommentHints, getLuggageRules, validateRider | **NONE** | No stops, options, luggage, "ride for someone else" or address details (entrance/floor/apartment/intercom). |
| getTipOptions, sendTip | **NONE** | |
| getTripShareLink, getEmergencyContacts, add/removeEmergencyContact, getSupportContact | **NONE** | Safety tools hidden. |
| applyPromoCode | **NONE** | |
| getBonusSummary, getBonusSources, getBonusHistory, requestBonusWithdraw | **NONE** | Bonus menu hidden. |
| getAccounts, switchAccount, addAccount, deleteAccount | **NONE** | |
| requestAccountDeletion | **NONE** | |
| requestPhoneChange, confirmPhoneChange | **NONE** | |
| submitHelpRequest, getHelpRequests, submitSupportTicket | **NONE** | Help hidden. |

## Shapes the client expects for the missing features

Proposed. All money is in tiyin, all ids are UUIDs, and lists use `{ data, cursor }`.

- `GET /api/v1/places/search?q=&near_lat=&near_lng=` → `{ data: [{ id, name, area, lat, lng, distance_m, entrance? }] }`
- `GET /api/v1/places/reverse?lat=&lng=` → `{ id, name, area, lat, lng }`
- `GET /api/v1/places/saved` / `POST` / `DELETE /{id}` → `{ id, name, area, lat, lng, details?: { entrance, floor, apartment, intercom, note } }`
- `GET /api/v1/routes/popular` → `{ data: [{ from: GeoPoint, to: GeoPoint, distance_m, price_from }] }`
- `POST /api/v1/orders/quote` with the OrderCreate body (+ `stops[]`, `options[]`, `promo_code`) → `{ price, lines: [{ key, params, amount }], distance_m, duration_s, pickup_eta_s, car_classes: [{ car_class, price, available, reason_key?, eta_s }] }`
- `GET /api/v1/orders/seat-map?from=&to=&scheduled_at=` → `{ seats: [{ id: front|back-left|back-mid|back-right, taken, price }] }`, and `seat_ids[]` on OrderCreate instead of `seats`.
- OrderCreate/Order: `scheduled_from` and `scheduled_to` (time window, date range), `stops[]` (GeoPoint + details), `from_details` / `to_details`, `options[]` (child_seat+variant, pet, big_luggage, find_car, wheelchair, text_only), `luggage`, `rider: { name, phone } | null`, `promo_code`, `cargo: { tab, loaders, pricing_mode, hours, ride_along, sender, receiver }`.
- Order (response): `rating`, `cancel_reason`, `editable`, `rating_editable`, `locked_reason_key`, `driver.phone_masked` (or a call-proxy endpoint), `driver.avatar_url`.
- `GET /api/v1/orders/history?status=completed|cancelled`.
- `GET /api/v1/delivery/vehicles` → `{ data: [{ vehicle_type, size_label, dimensions_cm: { width, depth, height }, max_weight_kg }] }`.
- `GET /api/v1/orders/{id}/tips` / `POST` → `{ allowed, presets[], min, max, sent? }`.
- `GET /api/v1/orders/{id}/share` → `{ url }`. Plus `/api/v1/emergency-contacts` CRUD (max N) and `GET /api/v1/support/contact` → `{ phone }`.
- `POST /api/v1/promo/apply { code }` → `{ valid, discount_percent, message_key }`.
- `/api/v1/bonus/summary|sources|history|withdraw`.
- `GET /api/v1/wallet/cards` → `{ data: [{ id, brand, last4, provider }] }`.
- `POST /api/v1/profile/phone/request|confirm`, `DELETE /api/v1/profile` (deletion request).
- `POST /api/v1/help/requests { topic, message }`, `GET /api/v1/help/requests`.
- Profile: `trips_count`, `avatar_url`.
- Settings.notifications: `order_status` and `bonus` flags (or document how push/sms/promo cover them).
