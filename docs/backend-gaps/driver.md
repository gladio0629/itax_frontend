# Driver app: adapter methods vs `api/openapi.yml`

Money: the API uses tiyin and the UI uses so'm. `httpMapper.ts` converts with ×100 / ÷100.
"Hidden" means the http adapter reports the feature as unsupported (`capabilities.<name> = false`)
and the UI hides it or shows "Tez orada". Nothing is faked.

## Method → operation

| Adapter method | operationId | Status in http mode / mismatches |
|---|---|---|
| `getSession` | `authTokenRefresh` (resume), `driverGetStatus`, `driverGetMe` | `draft` has no GET for registration progress, so the app restarts at step 1 (steps overwrite). `pending_review` shows the review screen, `rejected` reopens registration with a notice, `blocked` shows a blocked screen. There is no `routes` stage (no routes endpoint). |
| `getRegistrationOptions` | **NONE** | Cities, car models, colors, years, classes and seat counts are static UI lists in the http adapter. **Needed:** `GET /api/v1/drivers/registration/options` → `{ cities: string[], car_brands: {brand, models[]}[], colors: string[], years: int[], car_classes: CarClass[], seats: int[] }` |
| `requestOtp` | `authOtpRequest` | `resend_after` becomes `resendInSec`. The UI has 4 code boxes; the contract allows 4–6 digits. |
| `verifyOtp` | `authOtpVerify` | Returns an already-settled review (no timers). `is_new_user` is unused. |
| `savePersonal` | `driverRegistrationStep` (1) | The UI's single "Ism Familiya" field is split at the first space into `first_name` / `last_name`. A birth-date input was added for `birth_date`. `city` is sent as the city name (free string). |
| `saveCar` | `driverRegistrationStep` (2) | The model list is "Brand Model" and is split into `brand` / `model`. `color` sends the color key. Car-class and seat inputs were added for `car_class` / `seats`. |
| `uploadDocument` (new) | `driverDocumentUploadUrl` + `driverDocumentUploadContent` | Real file picker (jpeg/png, ≤ 10 MB). PUT goes to the signed `upload_url` without a bearer. |
| `submitDocuments` | `driverRegistrationStep` (3, then 4) | Kinds: `license_front`, `tech_passport_front` and `selfie` (a selfie slot was added; the contract requires it). Step 4 needs a terms checkbox (`accept_terms: true`). |
| `logout` | `authLogout` | Then clears memory, storage and the socket. |
| `getRoutes` / `addRoute` / `setRouteBothWays` / `removeRoute` / `completeRoutesSetup` | **NONE** | Hidden. **Needed:** `GET/PUT /api/v1/drivers/me/routes` → `{ routes: { id, a_city, b_city, both_ways }[] }` |
| `getProfile` | `driverGetMe` | No `rating_count`, `city`, `member_since` or documents status. Those rows are hidden. |
| `getHomeSummary` | `walletBalance` + `notificationsList` | Unread count is counted on the first notifications page. **Needed:** `unread_count` on `NotificationPage`, plus `new_offers_count` and today's earnings/trips. |
| `getFeed` | `tripOffersList` | Offer has **no pickup time** (`scheduled_at`), no `payment_method`, no `created_at`, no pickup distance (only `pickup_eta_s`), no stops/options/comment/luggage, and no commission %. Filters (direction/date/type) are hidden because the endpoint has no query params. Seat summary is hidden. |
| `markFeedSeen` | **NONE** | No-op. |
| `getRejectReasons` / `rejectRequest` | **NONE** | Hidden. **Needed:** `POST /api/v1/trips/offers/{id}/reject {reason?}` → 204 |
| `acceptRequest` | `tripOfferAccept` | 409 `ORDER_ALREADY_TAKEN` shows the "taken" card; 402 `WALLET_LIMIT_REACHED` shows a toast. |
| `takeRequestAlerts` | **NONE** (WS `offer.created` only refreshes the feed) | Hidden. |
| `getAccepted` | **NONE** | Trips accepted in this tab are kept in memory and lost on reload. Passenger name/phone/rating are unknown. **Needed:** `GET /api/v1/trips?status=assigned,in_progress` → `CursorPage<Trip & { order: Order, passenger: { first_name, rating, phone_masked } }>` |
| `advanceBooking` | `tripStart`, `tripComplete` | No "arrived" step (`assigned` → start → complete). |
| `getCancelReasons` / `cancelBooking` | **NONE** | Hidden. **Needed:** `POST /api/v1/trips/{id}/cancel {reason}` |
| `getTripSummary` | **NONE** (Trip has `final_price` and `commission` but no pct or bonus) | Hidden. |
| `getTripChat` / `sendTripMessage` | **NONE** | Hidden ("Tez orada"). |
| `getHistory` / `getTripDetail` | **NONE** for drivers (`orderHistory` is the passenger's) | "Tez orada". **Needed:** `GET /api/v1/trips/history` → `CursorPage<Trip & { order: Order }>` |
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
| `getCapabilities` / `setCapabilities` | **NONE** | Hidden. **Needed:** `GET/PUT /api/v1/drivers/me/capabilities` → `{ child_seat, child_seat_ages[], pets, big_luggage }` |
| `getReviewStatus` | `driverGetStatus` (for the registration review only) | Other reviews are settled immediately. |
| `reportLocation` (new) | `driverLocationUpdate` (`/api/v1/location/update`) | Sent only while the feed is open or a trip is active, at most every 10 s. |
| `subscribe` (new) | WebSocket `/ws` | `offer.created`, `order.accepted`, `trip.completed` and `wallet.limit_reached` refresh the screens; `driver.approved` refreshes the session. |

Not used by the driver app: `orderCreate/Get/Update/Cancel/History`, `orderRate*`, `profileUpdate`,
all `/admin/v1/*`.

## Other mismatches

- `CarClass` has `minivan`; the driver UI had only economy/comfort/business (added).
- `Offer.seats` vs whole car: an offer with `car_class` and no `seats` is shown as "whole car".
- Delivery offers carry only `vehicle_type`. There are no cargo dimensions, loaders, sender or receiver, so the freight block is hidden.
- `Trip` has no passenger or order data. The accepted card shows the offer snapshot taken at accept time.
- `DriverStatus.reason` is a free key with no catalogue. The UI shows a generic "rejected" / "blocked" text.
- The trip step button follows `Trip.status`: `assigned` shows "Safarni boshlash", `in_progress` shows "Yakunlash". The server still decides; a 403 is shown as an error. **Needed:** `Trip.next_actions: ("start"|"complete"|"cancel")[]` so the client never infers the next step from a status.
- The OTP input has 4 boxes, but the contract allows 4–6 digits. **Needed:** `code_length` in `OtpRequestResult`.
- The WebSocket only triggers refetches. `offer.created` carries no offer payload, so the feed is re-read (`GET /trips/offers`, first page, limit 50).
- `GET /trips/offers` has no filters. **Needed:** `?direction=&date=&type=`, or server-side matching against the driver's routes.
- Server-sent `title_key` / `body_key` show as raw text when the app has no translation for them.
- `walletTopup` / `walletCardLink` return a provider `redirect_url`. The app opens it (http(s) only) and expects the provider to return to the app. There is no return URL parameter in the contract.
