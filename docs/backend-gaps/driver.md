# Driver app: adapter methods vs `api/openapi.yml`

Money: the API uses tiyin and the UI uses so'm. `httpMapper.ts` converts with ×100 / ÷100.
"Hidden" means the http adapter reports the feature as unsupported (`capabilities.<name> = false`)
and the UI hides it or shows "Tez orada". Nothing is faked.

## Method → operation

| Adapter method | operationId | Status in http mode / mismatches |
|---|---|---|
| `getSession` | `authTokenRefresh` (resume), `driverGetStatus`, `driverRoutesGet` | `draft` has no GET for registration progress, so the app restarts at step 1 (steps overwrite). `pending_review` shows the review screen, `rejected` reopens registration with a notice, `blocked` shows a blocked screen. `active` with no routes yet (`GET /drivers/me/routes` → `[]`) is the first-run **routes** stage (registration step 5); if that read fails the driver goes straight in. |
| `getRegistrationOptions` | `citiesList` (cities) | Cities: names from `GET /api/v1/cities` (step 1 `city` is a free string), static list only if that read fails. Car models, colors, years, classes and seat counts are still static UI lists. **Needed:** `GET /api/v1/drivers/registration/options` → `{ car_brands: {brand, models[]}[], colors: string[], years: int[], car_classes: CarClass[], seats: int[] }` |
| `requestOtp` | `authOtpRequest` | `resend_after` becomes `resendInSec`; `code_length` becomes `codeLength` and sets the number of boxes (the live server sends 6). Without it the app falls back to 4–6 (`api.otpLength`). |
| `verifyOtp` | `authOtpVerify` | Returns an already-settled review (no timers). `is_new_user` is unused. |
| `savePersonal` | `driverRegistrationStep` (1) | The UI's single "Ism Familiya" field is split at the first space into `first_name` / `last_name`. A birth-date input was added for `birth_date`. `city` is sent as the catalogue city name (free string). |
| `saveCar` | `driverRegistrationStep` (2) | The model list is "Brand Model" and is split into `brand` / `model`. `color` sends the color key. Car-class and seat inputs were added for `car_class` / `seats`. |
| `uploadDocument` (new) | `driverDocumentUploadUrl` + `driverDocumentUploadContent` | Real file picker (jpeg/png, ≤ 10 MB). PUT goes to the signed `upload_url` without a bearer. |
| `submitDocuments` | `driverRegistrationStep` (3, then 4) | Kinds: `license_front`, `tech_passport_front` and `selfie` (a selfie slot was added; the contract requires it). Step 4 needs a terms checkbox (`accept_terms: true`). |
| `logout` | `authLogout` | Then clears memory, storage and the socket. |
| `getRoutes` / `addRoute` / `setRouteBothWays` / `removeRoute` / `completeRoutesSetup` | `driverRoutesGet`, `driverRoutesPut`, `citiesList` | **On.** Every change is GET → modify → full-set PUT, and the screen shows the PUT response (each PUT issues new ids). A new pair starts `both_ways: true`. 422 `routes.N.b_city_id: same_as_a` → "pick two different cities", `routes.N: duplicate` → "route exists", `routes: arrayMaxSize` (more than 10) → "too many routes". The server accepts 0 routes, but the app keeps the last one (`ROUTES_MIN_ONE`, as in sample data): an active driver without routes is sent to the first-run routes step. |
| `getProfile` | `driverGetMe` | No `rating_count`, `city`, `member_since` or documents status. Those rows are hidden. |
| `getHomeSummary` | `walletBalance` + `notificationsList` + `tripsList` | Unread count is counted on the first notifications page. `tripActive` (GPS reporting) = `GET /trips` has an item. **Needed:** `unread_count` on `NotificationPage`, plus `new_offers_count` and today's earnings/trips. |
| `getFeed` | `tripOffersList` + `citiesList` | Shown now: pickup time (`scheduled_at`, or the `scheduled_from`–`scheduled_to` window; none = now, no time row), `payment_method` (cash / card; `card`, `payme`, `click` show as card, `wallet` has no label), `comment`, `created_at` ("N min ago"), `seat_ids` (seat names tag), and city names from `from_city_id` / `to_city_id` (address line from the point). Still missing: pickup distance (only `pickup_eta_s`), stops / options / luggage, commission %. Filters (direction/date/type) stay hidden: the endpoint has no query params. Seat summary is hidden. |
| `markFeedSeen` | **NONE** | No-op. |
| `getRejectReasons` / `rejectRequest` | `tripOfferReject` | **On.** Reasons `too_far` / `bad_price` / `busy` / `other` (UI keys `reject.reason.far` / `price` / `busy` / `other`); the reason is optional. The sample-data-only reasons (time, seats) are not offered. |
| `acceptRequest` | `tripOfferAccept` | 409 `ORDER_ALREADY_TAKEN` shows the "taken" card; 402 `WALLET_LIMIT_REACHED` shows a toast. |
| `takeRequestAlerts` | **NONE** (WS `offer.created` only refreshes the feed) | Hidden. |
| `getAccepted` | `tripsList` (`?status=assigned,in_progress`) | **On; survives reload.** Each item's `order` gives route, time, seats / `seat_ids`, payment, comment and price. Passenger name / phone / rating are not in the contract: no passenger row and no call button. The order has no commission, so the "you get" line is hidden until the trip has `final_price` and `commission`. |
| `advanceBooking` | `tripArrive`, `tripStart`, `tripComplete` | **"Arrived" step on.** The button is the first non-`cancel` entry of the server's `Trip.next_actions` in its order (`assigned` → `arrive`, then `start`; `in_progress` → `complete`). The app never derives it from the status. The four-step progress bar is display only (`arrived_at` → waiting, `in_progress`). There is no `GET /trips/{id}`: the action comes from the last `GET /trips` answer, and the list is re-read after the step. |
| `getCancelReasons` / `cancelBooking` | `tripCancel` | **On.** Reasons `passenger_no_show` / `passenger_asked` / `car_problem` / `emergency` / `other`; no comment field in the UI (`comment` is optional). The cancel button shows only while `next_actions` has `cancel`. 403 `FORBIDDEN` + `reason: trip_started` shows "The trip has started, contact an operator" and the list is re-read. |
| `getTripSummary` | **NONE** (Trip has `final_price` and `commission` but no pct or bonus) | Hidden. |
| `getTripChat` / `sendTripMessage` | **NONE** | Hidden ("Tez orada"). |
| `getHistory` / `getTripDetail` | `tripsHistory` (cursor) + `citiesList` | **On.** Completed and cancelled trips with their `order`; cursor pages become "load more". Earnings = `final_price − commission` (0 for cancelled). The detail has no `GET /trips/{id}`: it is looked up in the loaded pages, then up to 10 pages are read before "not found". Hidden: the city search, range and min-earnings filters and the total (`capabilities.historyFilters = false`; the endpoint has only `cursor` / `limit`), passenger and rating (not in the contract), commission % (only the amount). The timeline starts at "arrived" (Trip has no accepted-at). Cancel reasons map to the driver reasons; an admin cancel shows "cancelled by an operator". |
| `getWallet` | `walletBalance` | `debt_status` maps to the level (`ok`/`approaching`/`at_limit` → `ok`/`near`/`blocked`). No today stats, no commission %, no saved-cards list. Those blocks are hidden. |
| `getLedger` | `walletLedger` | Cursor pages become "load more". No `total`, no type or date filters (hidden). `kind: correction` was added to the UI. |
| `getTopupOptions` | **NONE** | Limits come from the `TopupRequest` schema (1 000 – 10 000 000 so'm) and providers from its enum. The presets are UI. |
| `requestTopup` | `walletTopup` (+ `Idempotency-Key`) | Opens `redirect_url`. |
| `linkCard` | `walletCardLink` | Opens `redirect_url`. **Needed:** `GET /api/v1/wallet/cards` → `{ id, brand, last4, provider }[]` |
| `getBonus` | **NONE** | Hidden. |
| `requestProfileChange` | `driverUpdateMe` (name only) | Phone and car changes are hidden (they need re-review; no endpoint). |
| `getNotifications` / `markAllNotificationsRead` | `notificationsList`, `notificationMarkRead` (one PUT per unread) | `title_key` / `body_key` must exist in the app's i18n. **Needed:** the key catalogue, and `PUT /notifications/read-all`. |
| `getNotificationPrefs` / `setNotificationPrefs` | `profileGet` + `profileSettingsUpdate` | Only `push` (master) and `promo` (news) map. new-orders / payments / bonus toggles are hidden. |
| `getHelpRequests` / `submitHelpRequest` | **NONE** | Hidden. |
| `getAppInfo` | **NONE** | Local build info. |
| `getCapabilities` / `setCapabilities` | `driverCapabilitiesGet` / `driverCapabilitiesPut` (+ `driverGetMe` for the car) | **On.** Four age groups from the contract (`0-1`, `1-3`, `3-7`, `7-12`). `child_seat_ages` is sent empty while `child_seat` is off, and the screen shows the server's answer. Car class and model are read-only from `/drivers/me`. The cargo body row is hidden (no data). |
| `getReviewStatus` | `driverGetStatus` (for the registration review only) | Other reviews are settled immediately. |
| `reportLocation` (new) | `driverLocationUpdate` (`/api/v1/location/update`) | Sent only while the feed is open or a trip is active, at most every 10 s. |
| `subscribe` (new) | WebSocket `/ws` (subprotocol auth) | `offer.created` → re-read the feed. `trip.cancelled` (an admin cancelled this driver's order) → re-read `GET /trips`, and a toast says an operator cancelled the trip. `wallet.limit_reached` → re-read the balance. `driver.approved` → re-read status / session. Order status events are passenger-only and unknown types are ignored. |

Not used by the driver app: `orderCreate/Get/Update/Cancel/History`, `orderRate*`, `profileUpdate`,
all `/admin/v1/*`.

## Other mismatches

- `CarClass` has `minivan`; the driver UI had only economy/comfort/business (added).
- `Offer.seats` vs whole car: an offer with `car_class` and no `seats` is shown as "whole car". `seats` falls back to the length of `seat_ids`.
- Delivery offers carry only `vehicle_type`. There are no cargo dimensions, loaders, sender or receiver, so the freight block is hidden.
- `Order` (in `GET /trips` and history) has no passenger name, masked phone or rating, so the accepted card and the trip detail have no passenger row.
- No `GET /api/v1/trips/{id}`. The step button and the trip detail work from the last list or history pages.
- `Trip` has no accepted-at time, so the history timeline starts at "arrived".
- Active trips carry no commission (`Order` has none, and `Trip.commission` is set on completion), so the "you get" line on an accepted card stays hidden until then.
- `PaymentMethod` `wallet` has no label in the driver UI (shown without a payment tag); `payme` / `click` are shown as card.
- `DriverStatus.reason` is a free key with no catalogue. The UI shows a generic "rejected" / "blocked" text.
- The WebSocket only triggers refetches. `offer.created` carries no offer payload, so the feed is re-read (`GET /trips/offers`, first page, limit 50).
- `GET /trips/offers` has no filters. **Needed:** `?direction=&date=&type=`, or server-side matching against the driver's routes and capabilities (stored but not used by matching yet).
- `GET /trips/history` has no filters and no total. **Needed:** `?from_date=&to_date=&min_earnings=&city_id=` and a `total`, to turn the history filters back on.
- `GET /api/v1/cities` answers `Cache-Control: no-store`; the contract says `public, max-age=300`. The app reads it once per tab either way.
- A server-sent `title_key` the app can't translate falls back to a generic title for its kind, and an unknown `body_key` is hidden. Please share the key catalogue.
- `walletTopup` / `walletCardLink` return a provider `redirect_url`. The app opens it (http(s) only) and expects the provider to return to the app. There is no return URL parameter in the contract.

Still hidden in http mode (backend-gaps.md §0, "Still open"): trip chat, trip summary (commission % and bonus), feed
filters and the seat summary, new-request alerts, ledger filters, bonus, help requests, phone / car change, saved
cards, per-topic notification switches, `unread_count` / read-all (one PUT per unread item instead), history filters.

## Redesign v2

Driver app redesign (design v2, 2026-11-22). Money in tiyin on the wire as before. Error envelope `{ error: { key, params } }`.
Until an endpoint exists the http adapter treats **only** 404 / 405 / 501 as "not there yet" and carries on
(`optionalEndpoint` in `driver/src/api/adapters/http.ts`); 422, 5xx and network errors are shown to the driver.

### Registration (screens: personal → licence → car → selfie → automatic check)

The four existing step bodies are unchanged (the contract rejects unknown fields). This section replaces the
`savePersonal` / `saveCar` / `submitDocuments` rows above: the adapter now has `savePersonal`, `saveLicense`, `saveCar`,
`submitRegistration` and `getRegistrationReview`.

- Order on the wire: step 1 after the personal screen; the licence screen only uploads two photos and calls the licence
  endpoint below; step 2 after the car screen; step 3 (all documents) + step 4 (`accept_terms`) after the selfie screen.
  Upload URLs are requested on each screen, so `license_front` / `license_back` are uploaded before step 2.
- Step 3 now sends `license_front`, `license_back`, `tech_passport_front`, `tech_passport_back`, `car_photo`, `selfie`
  (all kinds already in `DocumentKind`). **Please confirm step 3 accepts all six.**
- **Lost in http mode until the endpoints exist:** the referral code, the licence number / dates / categories and the
  service types. The screens ask for them; the adapter sends them to the endpoints below and skips them on 404.

| Method | Path | Request | Response | Errors (key) |
|---|---|---|---|---|
| POST | `/api/v1/drivers/registration/referral` | `{ code: string }` (4–12, A–Z0–9) | 204 | 422 `referral.invalid` → UI `REFERRAL_INVALID` |
| POST | `/api/v1/drivers/registration/license` | `{ number: string, issued_at: DateOnly, expires_at: DateOnly, categories: string[] }` | 204 | 422 on `number` / `issued_at` / `expires_at` / `categories` → UI `LICENSE_NUMBER_INVALID`, `LICENSE_DATES_REQUIRED`, `LICENSE_CATEGORY_REQUIRED` (field map still to add in `mapFieldError` once the server keys are known) |
| PUT | `/api/v1/drivers/me/service-types` | `{ service_types: ("passengers" \| "delivery")[] }` (≥ 1) | 204 | 422 → UI `SERVICE_TYPE_REQUIRED` |
| GET | `/api/v1/drivers/registration/review` | — | `{ sections: { key: "personal" \| "license" \| "car" \| "selfie", status: "approved" \| "checking" \| "queued" \| "rejected" }[], eta_minutes?: int }` | 404 → the screen shows the four sections without a status and no time estimate |
| GET | `/api/v1/drivers/registration/options` | — | `{ car_brands: { brand, models[] }[], colors: { key, hex }[], years: int[], seats: int[], car_classes: CarClass[], service_types: string[], license_categories: string[] }` | (already requested above; static lists until then: brands, 7 colours incl. red / beige, licence categories A, B, BE, C, D) |

Notes:
- A rejected section (`status: "rejected"`) should come with the step to reopen; today the app only gets the overall
  `rejected` driver state and restarts at step 1 with a notice.
- "Bosh sahifaga" on the review screen stays disabled until the driver state is `active` (a driver under review is sent
  back to registration by the app).

### Work flow: Home, Request, OrderDetail, ToPickup, Waiting, OnTrip, Finished

All fields below are optional on the client: without them the screen hides that part (test panel → "Minimal server
data" shows what the real backend gives today). Nothing is computed on the phone: no prices, waiting charges, ETAs.

**Offer (`GET /api/v1/trips/offers` items, and a new `GET /api/v1/trips/offers/{id}`)** — today the app finds one offer
by reading the list.
- `expires_at` (ISO): end of the answer window → the Request countdown; at zero the screen closes and the list is re-read.
- `requester`: `{ first_name, trips_count?, rating? }` shown before acceptance ("Dilnoza · 43 safar · reyting 4.9").
  Today the contract withholds identity until acceptance; please confirm this is allowed.
- `car_seats` (int): seats in the driver's car, for the seat picture.
- `price_lines`: `[{ key: "trip" | "loaders" | "waiting" | "commission" | …, amount (tiyin, signed), pct? }]`; the app
  labels known keys and shows "Sizga qoladi" from the offer's net.
- Cargo: `freight.insured` (bool), plus the freight fields already listed above.

**Trip (`GET /api/v1/trips` items, and a new `GET /api/v1/trips/{id}`)** — today one trip is found by reading the list.
- `passenger`: `{ name, rating, call_number }`. `call_number` must be dialable (e.g. a masked-call proxy); without it
  there is no call button (the app never dials a masked number). Same `call_number` on freight `sender` / `receiver`
  after acceptance.
- `eta`: `{ minutes, distance_km? }` — to the pickup (assigned) or to the next stop (in progress).
- `waiting` (after `arrive`): `{ arrived_at, free_minutes, price_per_minute, charge?, passenger_notified? }`. The app
  only runs the clock; the charge is the server's.
- `progress` (in progress): `{ started_at, next_stop: Place, arrive_at, remaining_km, ratio (0..1) }`.
- `active_trip_id` on the list: which booking the driver handles next (pickup order when several passengers share the
  car). Without it the app takes the first item in the server's order.

| Method | Path | Request | Response | Errors (key) |
|---|---|---|---|---|
| GET | `/api/v1/trips/{id}/summary` | — | `{ gross, commission_pct, commission, base_commission_pct?, commission_waived?, net, payment, cash_to_collect?, passenger_name?, destination?, passenger_rating? }` (tiyin) | 404 `TRIP_NOT_FOUND`. Until then Finished shows the trip price only (and the net if the trip carries it) |
| POST | `/api/v1/trips/{id}/passenger-rating` | `{ stars: 1..5 }` | 204 | 409 `ALREADY_RATED`, 422 `stars` |
| POST | `/api/v1/trips/{id}/sos` | `{ lat?, lng? }` | 202 | 404 `TRIP_NOT_FOUND`. The app hides "IZGO'ga signal" until this exists; the 112 call button is always there |

**Home**: `today_work_min` and `week: [{ date, amount }]` (last 7 days, tiyin) for the earnings block and its mini
chart; today they are absent and the chart is hidden.

**Clocks:** the countdown (`expires_at`), the waiting clock (`arrived_at`) and "Safarda · N daq" (`started_at`)
compare server times with the phone's clock. A phone clock that is off shifts them. Please also send the server's
current time (e.g. a `Date` header the app can read, or `server_time` in these responses) or remaining seconds
(`expires_in_s`, `free_left_s`).

**Not built (no data source):** turn-by-turn instructions on OnTrip ("800 m, M39 bo'ylab"). The top card opens the
phone's navigator instead (geo: / Apple Maps link, no web request).

### Wallet: Wallet, WalletDebt, TopUp

- **Top-up options** (reviewer note: `http.ts` used to hard-code presets and min/max). The app now calls
  `GET /api/v1/wallet/topup/options` → `{ presets: Money[], min?: Money, max?: Money, providers?: PayProvider[] }`
  (tiyin). On 404 there are no presets and no limits on screen: the driver types the amount and `POST /wallet/topup`
  validates it (422 → the server's error key). Providers fall back to the contract's `PayProvider` values.
- **`WalletBalance`** (`GET /api/v1/wallet/balance`), optional additions:
  - `headroom` (Money): what can still be spent before the limit ("134 500 zaxira"). The app does not subtract.
  - `min_topup_to_unblock` and `recommended_topup` (Money): the WalletDebt screen's "Qaytish uchun kamida" and
    "Tavsiya"; the suggested amount pre-fills TopUp.
  - `week`: `{ earnings: Money, change_pct?: int }` for "Bu hafta … +12% o'tgan haftadan".
  - `commission`: `{ pct, level: "bronze" | "silver" | "gold" }` for the commission tile.
- **Pay with a saved card**: `TopupRequest` has no card. Proposed `{ amount, provider, card_id? }`; until then saved
  cards are not offered on TopUp in http mode (`GET /api/v1/wallet/cards` above is still needed for the list).
- The TopUp screen shows the current balance only, not "balance → balance + amount": a provider fee or rounding would
  make a client-side sum wrong. If the server can quote it, add `POST /api/v1/wallet/topup/quote` →
  `{ credited: Money, balance_after: Money }`.

### Profile: History, Profile, Level, Capabilities, Notifications, Settings

- **Imkoniyatlarim** (decision 2026-11-22: wishes removed). The contract's `DriverCapabilities` (child seat, pets,
  big luggage) is no longer used by the app. Needed:
  `GET` / `PUT /api/v1/drivers/me/cargo-capabilities` → `{ body_sizes: ("S"|"M"|"L"|"XL"|"XXL"|"3XL")[],
  available_body_sizes?: string[], loader_help: boolean }`; 422 on an unknown size. Matching should use these for
  cargo offers. Until it exists the screen shows "Tez orada" in http mode (`capabilities.driverCapabilities = false`).
- **Delete account** (Google Play requirement): `DELETE /api/v1/drivers/me` → 204, then the session ends;
  409 `TRIP_ACTIVE` while a trip is open. Until then Sozlamalar → "Akkauntni o'chirish" opens
  `${VITE_SITE_URL}/delete-account` in the system browser.
- **Profile** (`GET /api/v1/drivers/me`): `acceptance_pct` (0–100), `member_since` (year), `rating_count`, and the
  documents' review status (already listed above). Missing ones are hidden.
- **Level** ("Darajalar", the old bonus screen): `GET /api/v1/drivers/me/level` →
  `{ levels: [{ key, trips_required, commission_pct }], current, next?, week_trips, trips_to_next, commission_pct,
  rules: [{ key: "trips" | "rating" | "cancels", progress, target, done, ratio }], resets_in_days }`. Hidden until then
  (`capabilities.bonus = false`).
- **History**: filters `range`, `kind` (`passengers` / `delivery`), `city`, `min_earnings` on the history list, plus a
  `summary` of the filtered period: `{ from, to, total (tiyin), trips, days?: [{ date, amount }] }` for the Tarix top
  (total, trips, a bar per day for a week). Without it the top shows only the title.
- **Settings**: night mode, language, request sound and navigator are stored on the phone (not account data).
