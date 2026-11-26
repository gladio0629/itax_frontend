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
| getTripShareLink, getSupportContact | **NONE** | Safety tools (SOS, share) hidden. Emergency contacts were removed from the app (owner, 2026-11-22). |
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
`accounts`, `phoneChange`, `accountDeletion`, `notificationTopics`, `appPayment` (Payme / Click need a payment page on the
order), `cardPayment` (card needs saved cards and a charge path; owner 2026-11-26: cash only in 1.1), `seatLayouts` (`GET /orders/seat-layouts`), `recentRoutes`, `ratingNote`, `historySearch`. Store release 1.1 (2026-11-26).

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

## Redesign v2

Endpoints the redesigned passenger app (design v2, 2026-11-22) calls or needs. Conventions as above: ids UUID,
money integer tiyin, lists `{ data, cursor }`, errors `{ error: { key, params } }`. The client renders only what the
server returns; no numbers are computed on the device.

### Home: recent routes (group 3)

The "Oxirgi yo'nalishlar" tiles. Today `getRecentRoutes` is unsupported in the http adapter, so the section is hidden.

- `GET /api/v1/routes/recent?limit=4` (auth: passenger)
- Response `200`: `{ "data": [ { "from_city_id": "uuid", "to_city_id": "uuid", "distance_m": 308000, "price_from": 12000000 | null, "label": "Toshkent — Samarqand" } ] }`
  — the passenger's own last distinct city pairs, newest first. Same item shape as `GET /api/v1/routes/popular`.
- Errors: `401 AUTH_REQUIRED`.

### Saved places: kind (group 4)

"Manzilni saqlash" offers Uy / Ish / Boshqa. Home shows home/work with their own icon and the word in the
passenger's language. `SavedPlace` has a `name` only, and `SavedPlaceCreate` rejects unknown fields, so the http
adapter sends the translated word as `name` and no kind.

- `POST /api/v1/places/saved`: add optional `"kind": "home" | "work" | "other"` to the request.
- `GET /api/v1/places/saved`: add `"kind"` (nullable) to every item.
- Rule to agree on: at most one `home` and one `work` per passenger? (Today nothing limits it.) Error key if so,
  e.g. `PLACE_KIND_TAKEN` with `params: { kind }`.

### Address details on route points (group 4, unchanged need)

The redesign keeps Podyezd, Qavat, Kvartira, Domofon kodi and "Haydovchiga izoh" per route point
(`saveAddressDetails`, `capabilities.addressDetails`). Still needed on the order as listed under
"Still needed from the backend" above.

### Passenger order: Trip, Extras, Time, Payment (group 5)

The redesigned flow sends only what the server prices; the screens show the server's seat map, class prices, quote
lines and total. Needed beyond what the contract has today:

- **Multi-day pickup window** (owner, 2026-11-22: "allow choosing an end day"). The UI keeps a daily window over
  several days, e.g. 08:00–12:00 on any day from 20 to 22 November. Today the http adapter can only send
  `scheduled_from = 20 Nov 08:00`, `scheduled_to = 22 Nov 12:00`, which reads as one continuous 52-hour window.
  Proposal: on `OrderCreate` / `QuoteRequest` / `OrderUpdate` add
  `"pickup_window": { "first_day": "2026-11-20", "last_day": "2026-11-22", "from": "08:00", "to": "12:00" }`
  (local Asia/Tashkent time; `from`/`to` omitted for an exact time `"at": "08:00"`). Error keys:
  `TIMING_RANGE_TOO_LONG` (`params.max_days`), `TIMING_WINDOW_TOO_SHORT` (`params.min_minutes`), `TIMING_IN_PAST`.
  `GET /api/v1/orders/scheduling-rules` (or the existing source of `SchedulingRules`) keeps `max_range_days`.
- **Payme / Click as order payment** — already in `PaymentMethod` (`payme`, `click`); the client now sends them.
  Needed: what the passenger sees after "Buyurtma berish" (redirect URL or deep link to the provider app, and the
  order state while unpaid), e.g. `payment: { "status": "pending", "redirect_url": "…" }` on the created order.
- **Stops, luggage, "Boshqa odam uchun", promo, route-point details on the order** — still as listed under
  "Still needed from the backend" (http capabilities `stops`, `orderOptions`, `rider`, `promo`, `addressDetails` are off,
  so those rows are hidden or rejected before sending).
- **Saved cards list** — `GET /api/v1/wallet/cards` → `{ data: [{ id, label, brand, last4 }] }`; "Karta" in Payment
  opens this list (capability `savedCards`).

### Delivery: Yuk, Kontakt, Shartlar (group 6)

The redesigned delivery flow keeps every Kargo input of the current app (scope tabs, drop-offs, body S–3XL, sender /
receiver, receiver's address details, note, loaders, route / hourly with hours, ride-along) — all still behind
`capabilities.cargoExtras`, as listed above. New from the design:

- **Insurance switch** ("Sug'urta", design CargoTerms). Proposal:
  - `CargoRules` (`GET /api/v1/delivery/rules` or wherever the Kargo rules come from): `"insurance": { "available": true }`.
  - `QuoteRequest` / `OrderCreate` cargo block: `"insurance": true | false`.
  - Quote line `{ "key": "quote.insurance", "amount": <tiyin> }` when on; terms text from the existing info topic
    `insurance` (`GET /api/v1/delivery/info/insurance` → `{ title_key, paragraph_keys }` or plain localized text).
  - Error key when it can't be added: `CARGO_INSURANCE_UNAVAILABLE`.
- **Payment link after ordering** (Payme / Click, owner 2026-11-22): if the created order carries
  `payment: { "redirect_url": "https://…" }`, the app opens it in the system browser; otherwise it says payment will be
  asked later. Nothing else is built on the client.

### Live order and rating: Search, NoDriver, Driver, Arrived, OnTrip, Rate (group 7)

The live screens show only what `GET /api/v1/orders/{id}` (plus the WebSocket events) sends; each block below hides
when its field is missing, so today's backend gets the plain versions ("Haydovchi yo'lda", "Safar davom etmoqda").
Needed for the full design:

- **Driver ETA to the pickup** (design Driver, "12 daqiqada yetib keladi" and the "12 daq" bubble on the map):
  `"driver_eta_s": 720` on the order while `accepted` (not `arrived`). UI field `driverEtaMinutes`.
- **Waiting terms after `arrived`** (design Arrived, ring "03:42 · Bepul kutish", "har daqiqa uchun 500 so'm"):
  `"waiting": { "started_at": "<DateTime>", "free_until": "<DateTime>", "price_per_minute": <tiyin> }` while `arrived`.
  UI field `waiting`.
- **Trip progress** (design OnTrip, "Samarqandga 2 soat 40 daqiqa", "Taxminan 11:20 da", "128 km o'tildi · 180 km
  qoldi"): `"trip_progress": { "done_m": 128000, "left_m": 180000, "arrival_at": "<DateTime>" }` while `in_progress`.
  UI field `tripProgress`.
- **Driver on the order** — still only `driver.id` (see "Still needed"): name, car model and colour, plate, rating.
  Without them the card shows "Haydovchi" and the price only. A dialable driver phone (or a call-masking number) is
  also needed: `"driver_phone"` on the order while `accepted` / `in_progress` (UI field `driverPhone`). The mock gives a
  sample number and the button opens the phone's dialer; without the field it says "Qo'ng'iroq qilish hozircha mavjud emas".
  "Haydovchiga yozish" uses the same number for the phone's SMS app (no in-app chat); without it the button says
  "Xabar yuborish hozircha mavjud emas".
- **"Qayta qidirish" with a new time** (design NoDriver, "Olish vaqti · O'zgartirish"): the client re-creates the
  order from `GET /orders/{id}` with the shown time as `scheduled_*` (works with today's contract). A
  `POST /api/v1/orders/{id}/repeat { scheduled_* }` would avoid re-sending the whole order.
- **Rating comment** (design Rate, "O'z fikringiz", any number of stars, next to the reason chips):
  `RatingInput` keeps one reason and only with 5 stars, so the http client shows the comment only at 5 stars and sends
  it as the `custom` reason (the chips are then not sent). Proposal:
  `{ "stars": 1..5, "reasons": ["polite", "good_talk", "comfort", "just_because"], "comment": "≤200" }`.
  Capability `ratingNote` turns the full version on.
- **Tips, trip share link, support phone** — unchanged (`tips`, `safety` off). SOS opens a sheet with the support
  number and "Safarni ulashish"; emergency contacts were removed from the app.

### History and bonus: History, HistoryDetail, KbHistory, Bonus (group 8)

Owner decision (2026-11-22): this build is not going to production yet, so everything below works fully in the mock
adapter; the http adapter keeps the capability off until the endpoint exists.

- **History search and service filter** (design History / KbHistory, "Shahar yoki haydovchi", Hammasi / Yo'lovchi /
  Dostavka): `GET /api/v1/orders?type=passenger|delivery&q=<text>&status=…&cursor=…`. `q` matches the from/to city
  name and the driver's name, case-insensitive. Capability `historySearch`.
- **Trip times on the order** (design HistoryDetail, "08:40 … 12:55"): `"started_at"` and `"finished_at"`
  (DateTime) on `Order`. UI fields `startedAt`, `finishedAt`.
- **The passenger's rating on the order** (design HistoryDetail, "Sizning bahoyingiz", stars and the reason):
  `"rating": { "stars": 5, "reasons": ["polite"], "comment": "…" }` on `GET /orders/{id}`, plus a verdict
  `"rating_editable": true` (today the http adapter assumes `true`).
- **Delivery size label** on the order (history cards "Dostavka, M"): `"vehicle_label": "M"` next to `vehicle_type`,
  so the client never maps vehicle ids to sizes. UI field `cargoSize`.
- **Bonus ways to earn** (design Bonus, "Har bir do'st uchun +15 000", "Shu oyda 5 ta safar · 3 / 5"):
  `GET /api/v1/bonus/sources` → `{ data: [{ id, icon, title_key, description_key, amount_this_month, action,
  "reward": <tiyin | null>, "progress": { "done": 3, "total": 5 } | null }] }`. Bonus endpoints are still missing
  altogether (capability `bonuses`).

### Settings, account, help (group 9)

All of these work fully in the mock adapter (owner, 2026-11-22); http keeps the capabilities off until the endpoints
exist.

- **Help request reasons** (owner answer 7: Safar, To'lov, Haydovchi, Akkaunt, Boshqa):
  `POST /api/v1/support/requests { "topic": "trip" | "payment" | "driver" | "account" | "other", "message": "≤500",
  "order_id"?: Uuid }` → `{ id, status }`; `GET /api/v1/support/requests` → `{ data: [{ id, topic, status, created_at }] }`.
  The operator calls the profile phone. A trip's "Bu safar bo'yicha yordam" opens the form with `trip` picked.
- **Accounts on one device, phone change, account deletion, per-topic notification switches** — unchanged from
  "Still needed" (`accounts`, `phoneChange`, `accountDeletion`, `notificationTopics`).
- **Support contact**: the e-mail on "Biz haqimizda" is fixed in the client config (`SUPPORT_EMAIL`); a
  `GET /api/v1/support/contact { phone, email }` would let it change without a release.

### Home: "Faol buyurtma" (owner, 2026-11-22)

Home shows a row for the passenger's live order (searching, driver on the way or arrived, on the trip); tapping it
opens tracking. Needed: `GET /api/v1/orders/active` → the newest live `Order` or `204`. Until then the http adapter
looks for one on the first history page.
