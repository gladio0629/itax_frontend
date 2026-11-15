# Backend gaps: what the frontends need vs `api/openapi.yml`

The contract is `api/openapi.yml` (IZGO Taxi Platform API 0.1.0, **70 operations**). The frontends
call it through `shared/http` and the per-app `src/api/adapters/http.ts` + `src/api/httpMapper.ts`.
Every feature the contract lacks reports `api.capabilities.<feature> = false`. The http
adapter rejects it with `NOT_SUPPORTED`, and the UI hides it or shows "Tez orada". Nothing is faked.

Per-app detail: every adapter method → operationId, field mismatches, and the exact
request/response shapes proposed for each missing feature.

- [Client (passenger)](backend-gaps/client.md)
- [Driver](backend-gaps/driver.md)
- [Admin](backend-gaps/admin.md)

Conventions in all proposals: ids are UUIDs, money is integer tiyin, lists are `{ data, cursor }`,
and errors are `{ error: { key, params } }`.

## 1. What is hidden in http mode today

| App | Works against the contract | Hidden / "Tez orada" until the backend adds it |
|---|---|---|
| Client | OTP login, session resume, logout, profile name, notification settings (push/promo), order tracking (get, cancel, rate, search again), history, notifications, realtime order updates | **Ordering itself** (no places/geocoding, cities, quote, class list, seat map; Home shows "Tez orada"), the order details sheet (so `orderUpdate` isn't reachable), stops, options, address details, cargo, scheduling ranges, tips, safety tools, trip share, promo, bonuses, help/support, cards screens (no saved-cards list, so `walletCardLink` isn't reachable), account switching, phone change, account deletion, history status filter. The passenger wallet screen isn't routed in the client app at all (this predates the http work), so `walletBalance` and `walletLedger` are wired in the adapter only |
| Driver | OTP login, registration steps 1–4 with document upload, status (review / rejected / blocked / active), offers + accept, trip start/complete, GPS, wallet balance/ledger/top-up/card link, profile name, notifications, push/promo settings, realtime refresh | Routes ("Yo'nalishlarim"), offer reject, feed filters and seat summary, "arrived" step, trip cancel, chat, trip summary, trip history, accepted-trips list after reload, bonus, help, capabilities ("Imkoniyatlarim"), phone/car change, request alerts, ledger filters, per-topic notification switches |
| Admin | Email→SMS→verify login and phone-only operator login, `/me` sections, staff, drivers, passengers, orders (view), ledger, two-person corrections and tariffs, operator queue/history, stats (contract figures) | Complaints, audit log, section badges, supervisor views, export audit, staff search/state filter/restore/email edit, order create/edit/cancel, pending-corrections list, proposed tariff values, ledger/queue/history filters, most stats charts |

## 2. Operation coverage (all 70)

| Area | operationIds | Used by |
|---|---|---|
| Auth | authOtpRequest, authOtpVerify, authTokenRefresh, authLogout | client, driver (refresh and logout in `shared/http/session.ts`) |
| Admin auth | adminLoginEmail, adminLoginSms, adminLoginVerify | admin |
| Driver | driverGetMe, driverUpdateMe, driverRegistrationStep, driverDocumentUploadUrl, driverDocumentUploadContent (signed PUT), driverLocationUpdate, driverGetStatus | driver |
| Orders, ratings | orderCreate, orderHistory, orderGet, orderUpdate, orderCancel, orderRate, orderRateUpdate | client (`orderCreate` only for "search again", see §3; `orderUpdate` is wired but its UI, the details sheet, is hidden in http mode) |
| Trips | tripOffersList, tripOfferAccept, tripStart, tripComplete | driver |
| Wallet | walletBalance, walletLedger, walletTopup, walletCardLink | driver (all 4). The client adapter wires balance, ledger and card link, but no client screen reaches them in http mode (see §1) |
| Notifications | notificationsList, notificationMarkRead, notificationsWebSocket | client, driver |
| Profile | profileGet, profileUpdate, profileSettingsUpdate | client (all 3), driver (get + settings) |
| Admin | adminMe, adminStaff* (5), adminDrivers* (5), adminPassengers* (5), adminOrdersList, adminOrdersGet, adminWalletLedger, adminWalletCorrection (+approve/reject), adminTariffs* (7), adminOperator* (5), adminStats | admin, except **adminDriversCreate** (drivers self-register; no admin screen for it) and **adminOrdersGet** (the list already returns full orders) |

## 3. Cross-cutting mismatches

| Topic | Frontend | Contract | Effect / ask |
|---|---|---|---|
| Places | Pick-up/drop-off are named places (city + point, entrance) | `GeoPoint { lat, lng, address? }` only; no search, reverse geocoding, saved places or cities | Client can't build `from`/`to` for **orderCreate**, so ordering is hidden. Needs `places/search`, `places/reverse`, `places/saved` (client.md) |
| Price | Quote shown **before** ordering: lines, total, per-class prices, ETA | Price only in the `orderCreate` response | Needs `POST /api/v1/orders/quote` (client.md) |
| Time | "Haydovchi istagan" (driver decides) **or** a date range + time window (`dateEnd`, `timeRange`) | Single `scheduled_at` | Range and window can't be sent. Needs `scheduled_from` / `scheduled_to` |
| Seats | Seat map: front, back-left, back-mid, back-right, each with price/taken | `seats` count 1–4 | Needs `GET orders/seat-map` and `seat_ids[]` on create |
| Vehicle types | Size chips S, M, L, XL, XXL, 3XL with dimensions and max weight | `vehicle_type` enum `spark…fura`, no specs | Needs `GET /api/v1/delivery/vehicles` |
| Car class | UI ids `standart/komfort/biznes/miniven` (client), `economy/comfort/business` (driver) | `economy/comfort/business/minivan` | Mapped in httpMapper; driver gained `minivan` |
| Order status | `no_driver` (client), no `arrived` / `expired` | `searching, accepted, arrived, in_progress, completed, cancelled, expired` | `arrived` → accepted, `expired` → no_driver on the client; admin shows all 7 |
| Payment | `cash`, `card` | `cash, card, wallet, payme, click` | `wallet/payme/click` shown as card on the client |
| Cancel reasons | 4 client reasons | `changed_plans, long_wait, driver_asked, wrong_address, other` | "price reconsidered" and "chose another way" are sent as `other` |
| Rating reasons | Multi-select, any star count | One `reason`, only and always for 5 stars | First reason sent; `Order` has no `rating` field to read back |
| Server verdicts | `editable`, `ratingEditable`, `lockedReasonKey`, `canCancel`, `canEdit`, `Me.actions`, `Trip.next_actions` | Not in the contract | The UI doesn't derive them from status. It uses neutral values and lets the server's 403 decide; please add them |
| Lists | Driver/admin screens page by number with totals and filters | Cursor only, few filters | "Load more" / at most 5 pages × 100 rows; filters the API lacks are hidden |
| OTP length | Code boxes | `^[0-9]{4,6}$`, length not stated | In http mode client and driver show 6 boxes: confirm works from 4 digits, and a full 6 submits at once. A `code_length` in `OtpRequestResult` would let the UI show the exact count |
| i18n keys | Notification `title_key`/`body_key`, `DriverStatus.reason`, `FORBIDDEN.params.reason` | Free strings; catalogue is `shared/errors/errors.json`, which isn't in this repo | Unknown keys fall back to generic text. Please share the key catalogue |
| Money | so'm in the UI | tiyin | Converted ×100 / ÷100 in each httpMapper only |
| Admin session | Logout, idle timeout | No admin refresh token, no admin logout endpoint | Logout only clears memory; the token stays valid until `expires_in`. Needs `POST /admin/v1/auth/logout` |
| Admin realtime | — | `/ws` takes identity tokens only | Admin has no live updates |
| Provider redirects | Top-up / card link open `redirect_url` | No return-URL parameter | The provider must know where to send the user back |

## 4. Security notes

1. **WebSocket token in the query string.** `/ws?token=<access_token>` lands in the Kong access
   log, which writes the request line with the query (the contract says so), as well as in proxy and
   CDN logs, browser history tools, and `Referer`-like diagnostics. Suggest one of:
   - **First-message auth:** open `/ws` without a token, and the client sends
     `{"type":"auth","token":"…"}` as its first frame within N seconds. Today the server closes
     with 1008 on any client frame, so this needs a contract change.
   - **Subprotocol:** `new WebSocket(url, ["izgo.v1", "bearer.<token>"])`, which sends
     `Sec-WebSocket-Protocol`. The server echoes `izgo.v1`. The token isn't in the URL or access
     log, but some proxies log headers, so scrub it there.
   - **One-time ticket:** `POST /api/v1/ws/ticket` → `{ ticket, expires_in: 30 }`, single use, then
     `/ws?ticket=…`. A leaked log line is useless after 30 s.
   - Until then the frontend never logs the URL. Kong should drop the query from access logs for
     `/ws`.
2. **Refresh token in `localStorage`** (client, driver web). Any XSS can read it. The CSP (scripts
   from `'self'` only, no inline script) narrows that. Better for web: an `HttpOnly; Secure;
   SameSite=Strict` refresh cookie on `/api/v1/auth/token/refresh`. **Native apps must keep it in
   Keychain / Keystore.** Admin keeps tokens in memory only.
3. **Admin token can't be revoked** (no logout endpoint, no refresh). Keep `expires_in` short and
   add `POST /admin/v1/auth/logout`.
4. **Full phone numbers in admin lists.** `AdminDriver.phone`, `AdminPassenger.phone` and
   `Staff.phone` return full numbers to every role with the section. The UI masks them, but they
   are in the response. Suggest masked phones in lists plus an audited reveal endpoint.
5. **CORS** must allow only the 3 hosted origins, with methods `GET, POST, PUT, PATCH, DELETE,
   OPTIONS` and headers `Authorization, Content-Type, X-App, Idempotency-Key`. Use no wildcard
   with credentials (the frontends send none: `credentials: "omit"`).
6. **`X-App` is client-controlled.** Use it for routing and metrics only. The token's `aud`/`role`
   must decide access, as the contract says for location.
7. **Signed upload URL:** it already binds owner, kind, size and expiry. Keep `expires` short. Use
   magic-byte checks and EXIF stripping, as the contract describes.
8. **Avatars:** `avatar_url` images are allowed only from the API origin (CSP `img-src`). If they
   come from a separate CDN, tell us its origin.

## 5. Frontend decisions the backend should know

- `Idempotency-Key` is sent on exactly the three operations that declare it (`orderCreate`,
  `walletTopup`, `adminWalletCorrection`). It is one UUID per user action, reused on retry of the
  same payload; a changed payload gets a new key.
- On 401 from a request that carried a bearer, the client refreshes once (single flight), then
  retries once. Only a refresh rejected by the server logs the user out; a timeout or network
  failure doesn't. A 401 from `otp/verify` or `login/*` never triggers a refresh.
- Requests time out after 15 s (signed uploads: 120 s).
- Driver GPS goes to `POST /api/v1/location/update`, only while a trip is active or the request
  feed is open, at most every 10 s. `LOCATION_TTL` (2 min) is comfortably above that.
- The WebSocket keeps one connection per tab, reconnects with backoff from 1 s up to 30 s, and
  reconnects after every token refresh. It handles `4401 token_expired` with a refresh and
  `4401 session_revoked` with a logout. It never sends frames.
