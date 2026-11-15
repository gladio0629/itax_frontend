# Client app (passenger) — adapter ↔ contract

Source of truth: `api/openapi.yml` (0.2.0). The http adapter is `client/src/api/adapters/http.ts`, and every
field and shape conversion lives in `client/src/api/httpMapper.ts`. Money in the API is in tiyin
and the UI uses so'm (÷100 / ×100 in the mapper, rounded per value, so a breakdown can differ from the total by 1 so'm).
Updated 2026-11-15: the order flow runs against the contract in http mode.

## How the order flow maps

- **Addresses.** Screens keep local address ids. The adapter keeps an in-memory registry
  (`city:<uuid>`, `place:<uuid>`, `saved:<uuid>`, `pt:<lat>,<lng>`) of every point it returned: search, reverse,
  saved places, and the two ends of every order it mapped. Quote, create and update turn an id back into
  `GeoPoint {lat, lng, address}` (`address` = the shown name). `api.addressById(id)` replaces the sample address
  book in the screens, so the http bundle carries no sample data.
- **Map.** The map is a stylized SVG, not geographic. Picking a pin on it is hidden in http mode
  (`capabilities.mapPick = false`). "Where am I" uses the device position (`navigator.geolocation`, only when tapped) with
  `placesReverse` for the name; the order keeps the device coordinates, as the contract says (reverse is for the name only).
  There is no default pickup: the passenger picks one or locates. After an order the next draft keeps the last pickup.
- **Quote → create.** The quote and create bodies come from one builder: `type`, then `seat_ids` (per seat), `car_class`
  (whole car), or `vehicle_type` (Dostavka), plus `from`, `to` and the time fields. The adapter caches quotes by body
  (reused while more than 60 s from `expires_at`) and creates with the `quote_id` of the quote whose price `getQuote`
  last returned (the price on screen). On `QUOTE_EXPIRED`,
  `QUOTE_MISMATCH`, `QUOTE_ALREADY_USED`, `QUOTE_NOT_FOUND` (or no usable quote left locally), it fetches a fresh quote and
  rejects with the new total. The screen shows "Narx yangilandi — Yangi narx: …" and the passenger must confirm again.
  An order is never created at a price the passenger hasn't seen.
- **Class cards.** There is no class-list endpoint. For a whole car the adapter asks one quote per class
  (economy/comfort/business/minivan ↔ standart/komfort/biznes/miniven); the selected class reuses its cached quote.
  Per seat the contract takes no class, so only Standart is offered (at the seat quote, or the seat map's one-seat price
  before a seat is picked). The others show "Faqat butun mashina". No ETA per class.
- **Time.** "Haydovchi istagan" sends no time fields. One day with an exact time sends `scheduled_at`. A date range
  and/or a time window sends `scheduled_from` (first day + window start) and `scheduled_to` (last day + window end), local time
  with its UTC offset. The picker keeps its own rules (21 bookable days, ranges ≤ 3 days, windows ≥ 30 min), which sit inside
  the server's (from in the future, ≥ 15 min, ≤ 7 days, to ≤ 30 days ahead) and match the UI texts. Server refusals
  (`in_past`, `too_far`, `range_too_short`, `range_too_long`) are shown as the matching timing message.
- **Verdicts.** `editable` and `can_cancel` come from the server (today both are true only while `searching`). Tracking shows
  "Tafsilotlar" while `editable` and Cancel while `can_cancel`. `arrived` stays the UI's `accepted` step, with "Haydovchi
  yetib keldi" shown and the "Yo'lda" step completed. An admin-cancelled order shows its own "cancelled" state with the mapped
  `cancel_reason`.

## Method → operation

| Adapter method | operationId | Notes / mismatches |
|---|---|---|
| requestOtp(phone) | authOtpRequest | UI phone `+998 90 123 45 67` → `+998901234567`. `resend_after` drives the resend timer. No `requestId` in the API: the adapter keeps the phone in memory under a local id. |
| verifyOtp(requestId, code) | authOtpVerify | Returns TokenPair. The UI expects a ReviewRequest, so the adapter returns one that is already approved. 4–6 digits accepted (`code_length` is now in the response, not used yet). |
| getReviewStatus(id) | — (local) | Returns results that are already settled. |
| logout() | authLogout | Shared session: revoke, then clear tokens, storage and the socket. |
| (refresh) | authTokenRefresh | Shared HTTP client (single flight). |
| getProfile() | profileGet | `first_name + last_name` → name. **Missing:** `trips_count`, avatar. |
| updateProfileName(first, last) | profileUpdate | — |
| getNotificationPrefs / setNotificationPrefs | profileGet / profileSettingsUpdate | master↔push, news↔promo. **Missing:** per-topic orderStatus/bonus flags (rows hidden). |
| getCities() | citiesList | 1:1. Not used by a screen today. |
| getPopularRoutes() | routesPopular | `price_from` tiyin → so'm; `null` stays "no price" (the finished screen hides the price line). `distance_m` → km. |
| searchAddresses({query, fromAddressId, onlyCityId}) | placesSearch | `q` (min 2 chars, else no call), `near_lat/near_lng` from the pickup, `city_id` = onlyCityId. `distance_m` → km (shown only when known), `area`, `entrance`. The UI's `excludeCityId` is **not** applied: the backend accepts in-city trips and only refuses from = to (422 `to: same_as_from` → "Qayerdan va qayerga bir xil bo'lmasin"). |
| getAddressSuggestions(query, _, onlyCityId) | placesSearch | Same, as addresses (Tafsilotlar drop-off picker). |
| locateMe() | placesReverse | Device position → `lat/lng`; name/area/city from the result, coordinates from the device. Geolocation denied/unavailable → `LOCATION_UNAVAILABLE`. |
| reverseGeocode(x, y) | — | x/y are positions on the stylized map: no honest lat/lng. Hidden (`mapPick`). |
| getSavedAddresses() | placesSavedList | `name`, `area`, `details` (entrance/floor/apartment/intercom/note ↔ the UI's Tafsilotlar). **Missing:** city id, distance and ETA from the pickup (not shown). |
| getSavedAddressDetails(id) | (from placesSavedList) | Details of a saved place the adapter has seen, else null. |
| saveAddress({addressId, name?, details?}) / removeSavedAddress(id) | placesSavedCreate / placesSavedDelete | Wired and checked, but **no screen calls them yet** (the app has no "save this address" / "remove" UI). |
| saveAddressDetails(id, details) | — | The contract has no PATCH for a saved place and the order can't carry route-point details, so the Tafsilotlar capsule is hidden (`addressDetails`). |
| getDeliveryVehicles() | deliveryVehicles | `vehicle_type` = UI id (spark…fura), `size_label` S…3XL, `dimensions_cm`, `max_weight_kg`; description is the UI's `cargo.desc.<id>`. |
| getSeatMap({from, to}) | orderSeatMap | Coordinates of both points. `price` tiyin → so'm, `taken` as given (always false today: no pooling). |
| getQuote(input) | orderQuote | Body as above. `lines[{key, params, amount}]` → QuoteLine 1:1 (amount → so'm; a key the app has no text for shows as "Boshqa"); total = `price`; `distance_m` → km, `duration_s` → minutes. No pickup ETA / arrival time (not shown). Per seat with no seat picked → "O'rindiqni tanlang" (no call). |
| getCarClasses(input) | orderQuote × 4 (whole car) | See "Class cards". |
| getSchedulingRules() | — (UI rules) | 21 days / 3 days / 30 min / 5 min step, inside the server's limits. |
| getOrderDetailsRules() | — (contract lengths) | comment 200, PlaceDetails 20/200, no stops. |
| getOrderOptions / getCommentHints / getLuggageRules | — | Empty / none: the order can't carry options or luggage. |
| createOrder(input) | orderCreate (+Idempotency-Key) | Quote body + `payment_method` (cash/card), `comment` (Yo'lovchi: "Haydovchiga izoh"; Dostavka: the cargo note), `quote_id`. Quote errors → renewal and confirmation (see above). `FORBIDDEN active_orders_limit` → its own message. Stops, options, promo, rider, luggage or route-point details in the input are rejected (never dropped silently); the UI hides them and keeps no details in the draft. |
| repeatOrder(orderId) | orderGet + orderCreate | "Search again": same type, `seat_ids` (or seats) / car_class / vehicle_type, from, to, payment, comment; no `quote_id`, so the current tariff applies (as the contract allows). |
| getOrder(id) | orderGet | `seat_ids` → real seat positions; `from_city_id/to_city_id`; `editable`, `can_cancel`; `cancel_reason` → UI text key (passenger and admin enums; unknown → "other"); `price_lines` → the breakdown in history details; `scheduled_*` → the UI's timing; `arrived` → `accepted` + driver-arrived flag; `expired` → `no_driver`; payment wallet/payme/click → card. **Missing:** the order's rating, a rating verdict, driver name/car/phone (trip-order's `orderResp` fills only `driver.id`, read from `dto.go`; not observed, the test orders had no driver), car colour hex, avatar. |
| updateOrder(id, patch) | orderUpdate | Only the changed fields: `to` (drop-off), `seat_ids` or `car_class` (whole car), `scheduled_at` / `scheduled_from`+`scheduled_to`, `payment_method`, `comment`. The pickup can't change (`editPickup = false`, row read-only), a time can't go back to "now", and stops/options/details aren't expressible (NOT_SUPPORTED). The server re-prices an accepted change, with no quote and no confirmation step. |
| cancelOrder(id, reason) | orderCancel | plansChanged→`changed_plans`, waitedTooLong→`long_wait`, other→`other`. **No enum value** for "price reconsidered" / "chose another way" (sent as `other`). |
| rateOrder(id, stars, reasons, note) | orderRate, orderRateUpdate on 403 already_rated | One reason, only for 5 stars: polite→polite, conversation→good_talk, comfort→comfort, simple→just_because, other+note→custom. |
| getOrderHistory({cursor}) | orderHistory | Opaque cursor kept by the adapter. **Missing:** `status` filter (tabs hidden). |
| getNotifications() / markNotificationRead(id) | notificationsList / notificationMarkRead | First page only. |
| getWallet() | walletBalance + walletLedger | Not routed in the client app. |
| linkCard({provider}) | walletCardLink | Not reachable (cards screens hidden). |
| (realtime) | notificationsWebSocket | Subprotocol auth (shared). `order.created`, `order.accepted`, `order.arrived`, `trip.started`, `trip.completed`, `trip.cancelled` (driver backed out, order searching again), `order.cancelled` (admin) → re-read `GET /orders/{order_id}` on the tracking screen. Other types ignored. |
| getRecentRoutes, getRecentAddresses | — | No endpoint, and no screen uses them. |
| getPickupEta | — | No pickup ETA in the contract: the Home pin bubble and class ETAs are hidden (`pickupEta`). |
| getCargoRules, getMarketplaceWarehouses, getCargoInfo, getRideAlong, checkCargo | **NONE** | Kargo tabs, loaders, hourly mode, ride-along, sender/receiver, warehouses and info sheets are hidden (`cargoExtras`). Dostavka orders = vehicle + route + time + note. |
| validateRider | **NONE** | "Kim ketadi?" hidden (`rider`). |
| getTipOptions, sendTip | **NONE** | |
| getTripShareLink, getEmergencyContacts, add/removeEmergencyContact, getSupportContact | **NONE** | Safety tools hidden. |
| applyPromoCode | **NONE** | Promo rows hidden (`promo`). |
| getSavedCards | **NONE** | Card payment can be chosen; the saved-cards list and "link card" under it are hidden. |
| getBonusSummary, getBonusSources, getBonusHistory, requestBonusWithdraw | **NONE** | |
| getAccounts, switchAccount, addAccount, deleteAccount, requestAccountDeletion | **NONE** | |
| requestPhoneChange, confirmPhoneChange | **NONE** | |
| submitHelpRequest, getHelpRequests, submitSupportTicket | **NONE** | |

## Capabilities in http mode

On: `ordering`, `orderDetails`, `repeatOrder`, `popularRoutes`.
Off (backend still lacks them, `docs/backend-gaps.md` §0): `stops`, `orderOptions`, `rider`, `addressDetails`, `cargoExtras`,
`mapPick`, `pickupEta`, `editPickup`, `historyStatusFilter`, `tips`, `safety`, `promo`, `bonuses`, `help`, `savedCards`,
`accounts`, `phoneChange`, `accountDeletion`, `notificationTopics`.

## Still needed from the backend (client)

- A real geocoder (street addresses) and a geographic map, so a point can be picked on the map.
- On the order: stops, options (child seat + age, pet, big luggage, …), route-point details (entrance/floor/apartment/intercom/note),
  luggage, rider `{name, phone}`, promo code, Kargo extras (tab, loaders, hourly + hours, ride-along, sender/receiver).
- A pickup ETA (per class), and a class list with availability reasons (instead of one quote per class).
- Driver on the order: `first_name`, car, masked phone, avatar (the service code fills only `driver.id`).
- `rating` and a rating verdict on Order; order history `status` filter.
- A saved-place update (PATCH), plus city id and distance on saved places.
- A quote (or a price confirmation) for `orderUpdate`, which re-prices silently today.
- A cancel enum value for "price reconsidered" / "chose another way".
- Tips, safety/share/support, help, bonus, saved cards list, accounts, phone change, deletion, profile `trips_count`/avatar,
  per-topic notification switches.
