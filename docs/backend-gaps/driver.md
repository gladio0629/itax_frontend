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
| GET | `/api/v1/legal` (no auth) | — | `{ terms_url: string, privacy_url: string }` | 404 → the names show as plain text, no links (Main and the selfie step). See `docs/handoff-driver.md` |

Notes:
- A rejected section (`status: "rejected"`) should come with the step to reopen; today the app only gets the overall
  `rejected` driver state and restarts at step 1 with a notice.
- "Bosh sahifaga" on the review screen stays disabled until the driver state is `active` (a driver under review is sent
  back to registration by the app).
