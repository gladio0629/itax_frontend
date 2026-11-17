# Backend gaps: what the frontends need vs `api/openapi.yml`

The contract is `api/openapi.yml` (IZGO Taxi Platform API 0.2.0, **100 operations**; the analysis below was written against 0.1.0 with 70, see §0 for what has changed). The frontends
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

## 0. Backend status (updated 2026-11-15)

`api/openapi.yml` is now IZGO Taxi Platform API **0.2.0, 100 operations** (was 0.1.0, 70), copied from
`onlyback/api/openapi.yml`. `[x]` means the backend has it and it is in the contract, checked end to end through
Kong against the local stack. The tables below still describe the frontend as it is; the adapters and
capabilities need to be switched on per item.

**Ordering (client)**
- [x] Cities: `GET /api/v1/cities` (stable UUIDs, no token)
- [x] Address search and reverse geocoding, server-side: `GET /api/v1/places/search`, `GET /api/v1/places/reverse`.
  Covers the city catalogue plus a platform gazetteer; no external geocoder yet (see open items)
- [x] Saved places: `GET/POST /api/v1/places/saved`, `DELETE /api/v1/places/saved/{id}` (with entrance/floor/apartment/intercom/note)
- [x] Popular routes with `price_from`: `GET /api/v1/routes/popular`
- [x] Quote before ordering: `POST /api/v1/orders/quote` → `{ quote_id, price, lines[{key, params, amount}], distance_m, duration_s, expires_at }`.
  `lines` always sum to `price` and use the client's keys (`quote.seatFare`, `quote.carFare`, `quote.class.*`,
  `quote.cargoBase`, `quote.cargoDistance`). `orderCreate` with `quote_id` charges exactly the quoted price, or fails
  with `QUOTE_NOT_FOUND` / `QUOTE_EXPIRED` / `QUOTE_ALREADY_USED` / `QUOTE_MISMATCH`
- [x] Seat map and seat selection: `GET /api/v1/orders/seat-map`, `seat_ids[]` (`front, back-left, back-mid, back-right`)
  on create/update/order/offer. `seats` still works
- [x] Time as exact time or range: `scheduled_at` or `scheduled_from` + `scheduled_to`
- [x] Vehicle sizes: `GET /api/v1/delivery/vehicles` → `size_label` S, M, L, XL, XXL, 3XL with dimensions and max
  weight. `vehicle_type` keeps its values `spark…fura`, which the client already uses as ids
- [x] Order verdicts and details: `editable`, `can_cancel`, `cancel_reason`, `price_lines`, `quote_id`, `from_city_id`, `to_city_id`
- [x] `code_length` in `OtpRequestResult` and `AdminLoginChallenge`

**Driver**
- [x] Offer reject: `POST /api/v1/trips/offers/{id}/reject {reason?}`
- [x] "Arrived" step: `POST /api/v1/trips/{id}/arrive` (order status `arrived`); `start` still works straight from `assigned`
- [x] `Trip.next_actions` (`arrive | start | cancel | complete`), plus `arrived_at` and the cancel fields
- [x] Trip cancel (before start): `POST /api/v1/trips/{id}/cancel {reason, comment?}`. The order goes back to search for other drivers
- [x] Accepted trips after reload: `GET /api/v1/trips?status=assigned,in_progress` (with `order`)
- [x] Trip history: `GET /api/v1/trips/history` (with `order`)
- [x] Routes: `GET/PUT /api/v1/drivers/me/routes` (`a_city_id`, `b_city_id`, `both_ways`)
- [x] Capabilities: `GET/PUT /api/v1/drivers/me/capabilities`
- [x] Offer now carries `scheduled_at`/`scheduled_from`/`scheduled_to`, `payment_method`, `comment`, `created_at`, `seat_ids`, city ids
- [x] `offer.created` is now actually sent over WebSocket. Before, no service emitted it, so the feed never refreshed in real time

**Admin**
- [x] Logout revokes the token on the server: `POST /admin/v1/auth/logout`. The same token gets 401 afterwards
- [x] Complaints: list/get/create/assign/status/notes under `/admin/v1/complaints`; `AdminSection` gains `complaints`
- [x] Audit log: `GET /admin/v1/audit`; `AdminSection` gains `audit`
- [x] Order edit (comment, payment, time; only while searching) and cancel with reason: `PATCH /admin/v1/orders/{id}`,
  `POST /admin/v1/orders/{id}/cancel`. Admin orders now come from the real order service (before: sample data),
  plus a `passenger_id` filter
- [x] Pending corrections list: `GET /admin/v1/wallet/correction?approval_status=pending_approval` (with `created_by_name`)
- [x] Stats: `orders_expired`, `average_order_value`, `orders_by_status`, `daily`, `top_routes` (real order data)

**Security and hosting**
- [x] WebSocket token out of the URL: `new WebSocket(url, ["izgo.v1", "bearer." + token])`, or first frame
  `{"type":"auth","token":…}`. `?token=` is still accepted until the frontends switch (`WS_ALLOW_QUERY_TOKEN`)
- [x] WebSocket events documented: `onlyback/docs/websocket-events.md`. New events: `order.arrived`,
  `trip.started`, `trip.cancelled`, `order.cancelled`
- [x] CORS in Kong: methods `GET, POST, PUT, PATCH, DELETE, OPTIONS`, headers `Authorization, Content-Type, X-App,
  Idempotency-Key`, no wildcard. **The 3 domains are placeholders** in `onlyback/gateway/kong.yml` and must be filled
  in, together with `WS_ALLOWED_ORIGINS`
- [x] HTTPS/WSS: Caddy profile in front of Kong (`onlyback/docs/hosting.md`). Configured, but not verified with a
  real domain
- [x] Dev test accounts with a fixed code and seed data: `onlyback/docs/dev-testing.md`

**Still open**
- [ ] **Driver location push** for the passenger's map. The driver app already reports its GPS
  (`POST /api/v1/location/update`), but nothing forwards it to the passenger. The client listens on `/ws` for
  `{"type":"driver.location","id":"<order_id>","order_id":"<order_id>","lat":"41.31","lng":"69.28"}` (optional
  `heading`), sent to the order's passenger while the order is `accepted` … `in_progress`, a few seconds apart.
  Until the backend sends it (matching-geo → notification), the map shows the route and both ends but no car.
  The event also needs a row in `onlyback/docs/websocket-events.md`. Unlike the other frames with an `order_id`,
  it is not a reason to re-read the order, and the client doesn't
- [ ] Real geocoder (street addresses). Search covers cities and a small landmark list only
- [ ] Seat pooling: seat-map `taken` is always `false`. No front-seat surcharge
- [ ] Order extras: stops, options, address details on the order, luggage, rider, promo code, cargo (loaders, hourly,
  ride-along, sender/receiver), tips
- [ ] Safety tools and trip share, support contact, help requests, bonus
- [ ] Account switching/deletion, phone change, profile `trips_count`/avatar
- [ ] Order history `status` filter, `rating` on `Order`, driver phone (masked)/avatar on the order
- [ ] Saved cards list (`GET /api/v1/wallet/cards`), provider return URL
- [ ] Notifications: `unread_count`, read-all, per-topic switches, i18n key catalogue for the frontends
- [ ] Driver: registration options endpoint, trip chat, trip summary (commission %, bonus), feed filters and
  matching by the driver's routes/capabilities (stored but not used by matching yet), ledger filters, phone/car change
- [ ] Admin: `me.phone`/`actions`; staff search/state filter/restore/email edit; driver `driver_state` filter,
  `wallet_id`, `online`; masked phones with an audited reveal; ledger filters; proposed tariff values; queue/history
  filters and supervisor views; export audit; section badges; create order for a passenger
- [ ] **Admin drivers, passengers and wallet ledger still use sample (mock) data in the backoffice**, as do the
  driver/passenger figures in stats. Only orders and order stats are wired to the real service
- [ ] Admin realtime (`/ws` accepts passenger/driver tokens only)
- [ ] Refresh token as an `HttpOnly` cookie for web

### Frontend verification (2026-11-16)

Checked in headless Chrome against the local stack through the Vite dev proxy, with the dev test accounts:
client login → address search → quote (lines and per-class prices from the server) → seats → order with
`quote_id` (charged exactly the quoted price) → the offer appears live in the driver feed → accept → arrived →
start → complete, each step shown live in the client → rating (5, polite). Admin: the 2-step login for
superadmin, owner, manager, marketer and operator, each seeing only its sections; complaints, audit log, orders,
stats; logout, after which the old token gets 401. Client and driver logout return 204. The WebSocket opens
`/ws` with no token in the URL; the token travels only in `Sec-WebSocket-Protocol: izgo.v1, bearer.…`.

### Found while wiring the frontend (asks for the backend)

- `Order.driver` carries only `id`: the client shows "Haydovchi" without name, car, plate or rating.
- No `GET /api/v1/trips/{id}`; `Trip` has no accepted-at time; active trips carry no commission.
- `GET /api/v1/cities` answers `Cache-Control: no-store`; the contract says `public, max-age=300`.
- Matching doesn't use the driver's routes or capabilities yet; the driver screens say they are saved, not that
  requests are filtered by them.
- Order expiry has no WebSocket event; the client notices it on its own search timer.
- Prices are not whole so'm (e.g. 2 246 080 tiyin); the UI rounds each line, so a breakdown can be 1 so'm off
  the total it shows (the total itself is the server's price).
- Undocumented in the contract: 422 key `routes: arrayMaxSize`; 403 reasons `self_approval`, `complaint_closed`,
  `invalid_state`, `staff_inactive`; the audit action and entity names; `passenger_id` on admin order responses
  (typed `Order`, not `AdminOrder`); `Complaint.category` comes back as a free string.

## 1. What is hidden in http mode today (frontend updated 2026-11-16)

| App | Works against the contract | Still hidden (no endpoint or field yet) |
|---|---|---|
| Client | OTP login (box count from `code_length`), session resume, logout, profile, notification settings, **ordering**: cities, server-side address search near the pickup, "where am I" (device position + `places/reverse` for the name), saved places, popular routes with `price_from`, Taksi per seat (seat map with real positions → `seat_ids`) or whole car per class, Kargo vehicle sizes S…3XL, time now / exact / range, quote with the server's price lines, order with `quote_id` (a refused quote → fresh quote, new price must be confirmed), tracking with live searching → accepted → arrived → in progress → completed / cancelled / no driver, `editable`/`can_cancel` verdicts, edit while searching, cancel, rate, search again, history with price lines | Pick on the drawn map (not a real map), stops, options, luggage, rider, address details (entrance/floor…) on the order, Kargo tabs/loaders/hourly/ride-along/contacts, pickup ETA, editing the pickup, promo, tips, safety tools and trip share, support, help, bonus, saved cards, account switching/deletion, phone change, history status filter, recent addresses/routes |
| Driver | OTP login (`code_length`), registration 1–4 (cities from `/cities`), status, live feed (`offer.created`) with pickup time/range, payment, comment, posted time and seat positions, reject with reason, accept, the step button from `next_actions` (arrive → start → complete), cancel before start with reason, active trips that survive reload, trip history, Yo'nalishlarim, Imkoniyatlarim, GPS, wallet, profile, notifications, live refresh (`trip.cancelled`, `wallet.limit_reached`, `driver.approved`) | Trip chat, trip summary (commission %, bonus), feed filters and seat summary, request alerts, history/ledger filters, bonus, help, phone/car change, saved cards, per-topic notification switches, passenger name/phone/rating on a trip |
| Admin | Email→SMS→verify login (`code_length`) and phone-only operator login, logout that revokes the token, `/me` sections incl. complaints and audit, staff, drivers, passengers, orders (real data) with edit (while searching) and cancel with reason, ledger, pending corrections list, two-person corrections and tariffs, operator queue/history, complaints (filters, assign, notes, resolve/reject with the server's transition rules), audit log with filters, stats cards and charts (income and orders per day, orders by status, top routes) | Create order for a passenger, staff search/state filter/restore/email edit, `driver_state` filter, wallet id/online on drivers, masked phones with audited reveal, ledger filters, proposed tariff values, queue/history filters, supervisor views, export, section badges, complaint creation form, passenger/driver totals and the other stats the API lacks. Drivers, passengers and the ledger are still **sample data on the server** |

## 2. Operation coverage (the original 70; the 30 added in 0.2.0 are listed in §0)

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

1. **Resolved (2026-11-16):** the client and driver apps now authenticate `/ws` with the subprotocol `izgo.v1, bearer.<token>`; no token in the URL. The backend can set `WS_ALLOW_QUERY_TOKEN=false` once these builds are deployed everywhere. Original note: **WebSocket token in the query string.** `/ws?token=<access_token>` lands in the Kong access
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
- The WebSocket keeps one connection per tab, authenticates with the subprotocol `izgo.v1, bearer.<token>`,
  reconnects with backoff from 1 s up to 30 s, and reconnects after every token refresh. It handles
  `4401 token_expired` / `token_invalid` with a refresh, `4401 session_revoked` with a logout and `4403` with
  the longest backoff. It never sends frames.
