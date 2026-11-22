# Admin app — adapter ↔ contract map

Source of truth: `api/openapi.yml` (0.2.0). Mapper: `admin/src/api/httpMapper.ts`. Adapter: `admin/src/api/adapters/http.ts`.
Money: the UI works in so'm, the API in tiyin. The mapper multiplies or divides by 100 at the boundary.
"NONE" means the http adapter rejects with `ApiError("NOT_SUPPORTED")` and `api.capabilities` hides the feature.

Owner decision (2026-11-22): this build is not going to production now. Everything the server lacks works fully in the mock adapter with sample data; the http adapter has no workarounds for missing endpoints. It calls the expected endpoint (listed under "Redesign v2: missing endpoints and fields") behind a capability flag.

## Method → operation

| Adapter method | Operation | Notes / mismatches |
|---|---|---|
| `requestLogin(identifier)` | `adminLoginEmail` (email) · `adminLoginSms {phone}` (operator, no email) | The email path needs the staff phone at step 2. The login screen asks for it (`needsPhone`). There is no `resend_after` for admin, so the UI uses a 60 s cooldown and relies on 429. Each challenge's `code_length` sets the number of code boxes and the auto-submit length (`codeLength`); without it the UI shows 6 boxes and accepts 4+ digits for SMS. |
| `verifyLoginStep(id, code, {phone})` | `adminLoginSms {challenge_id, email_code, phone}` → `adminLoginVerify {challenge_id, sms_code}` | The final step signs in directly (`{ done: true }`). No timers. |
| `resendLoginCode(id)` | repeats `adminLoginEmail` / `adminLoginSms` | Uses the new `challenge_id` and `code_length` from the response. |
| `logout` | `adminLogout` (Bearer, 5 s timeout) | Revokes the session on the server; the same token gets 401 afterwards (checked). Any failure (offline, timeout, 401) is swallowed and the tab still clears its memory. Called by the adapter itself, because `shared/http/session.ts` `logout()` skips the server call for admin. |
| `isAuthenticated` | local | Tokens are in memory only. A reload means a full login. `AdminToken` has no refresh token, so a 401 means logging in again. |
| `getMe` | `adminMe` | `full_name` → name. Missing: `phone`, `actions`, `landingPath`, avatar. `actions` is derived 1:1 from `sections` (`operator` → `operatorWork`). `landingPath` is the first allowed section. Sections: `operator` → `operators`; `complaints` and `audit` show their sidebar entries and routes when listed. |
| `loginAsRole` | NONE | Test panel only. |
| `getStats(period)` | `adminStats {from_date,to_date}` | Mapped: revenue, commission, `average_order_value`, active_drivers, new_passengers, orders_total/completed/cancelled/`expired`, drivers_over_limit. `online_drivers` is mapped but not shown (owner decision). `orders_by_status` → the by-status list. `daily` → income over time; days missing from `daily` are zero-order days and are filled in for the requested range. `top_routes` → the routes card. Missing fields: see the list below. |
| `getCities` | NONE | No cities endpoint. The passenger city column and field are hidden. |
| `getSectionBadges` | NONE | Hidden. |
| `getStaff({role})` | `adminStaffList {role, cursor, limit}` | Missing: `q` search, `state` filter, `last_login_at`, and a per-row `can_edit` verdict. In http mode `canEdit` is true and the server's 403 decides. Roles: `manager`↔`menejer`, `marketer`↔`marketolog`. |
| `createStaff` | `adminStaffCreate` | `name` → `full_name`. Email is `null` for an operator without one. |
| `updateStaff` | `adminStaffUpdate` | **`StaffUpdate` has no `email`**, so the email field is read-only on edit. |
| `setStaffStatus` | `adminStaffUpdate {state}` | |
| `archiveStaff` | `adminStaffDelete` | |
| `restoreStaff` | **NONE** | `StaffUpdate.state` only allows `active`/`blocked`, so an archived staff member can't be restored. |
| `getDrivers({search,status})` | `adminDriversList {q, state, cursor}` | `state` covers active/blocked/archived. Filtering by `driver_state` (`pending_review`, `rejected`) is not supported. Display status: `state=blocked` → blocked; `driver_state` draft/pending_review → review; rejected → rejected; else active. Missing: `online`, `debt_limit`, city, avatar. |
| `updateDriverProfile` | `adminDriversUpdate {first_name,last_name}` | The car (model, colour, plate) can't be edited through the API. The UI shows only the name field. The single "Ism" field is split on the first space. |
| `setDriverStatus(id, s, reason)` | `adminDriversUpdate {state, state_reason}` | `state_reason` is required for `blocked`. The confirm dialog asks for it. |
| `archiveDriver` / `restoreDriver` | `adminDriversDelete` / `adminDriversUpdate {state: active}` | Restoring through `state: active` is an assumption the contract doesn't state. |
| `getPassengers` / create / update / status / archive / restore | `adminPassengers*` | Same as drivers. Missing: city, `total_trips` (`orders_count` is used instead). |
| `getOrders({status, passengerId})` | `adminOrdersList {status, passenger_id}` | `passenger_id` → `passengerId` (shown as a short id in the order drawer; there is no passenger name). `cancel_reason` codes are labelled; `scheduled_from`/`scheduled_to` are shown as a range. The `passenger_id` filter is wired in the adapter; no screen links passengers to orders yet. Statuses: `arrived` and `expired` are added; `no_driver` has no API equivalent. |
| `updateOrderFields(id, patch)` | `adminOrdersUpdate` (PATCH) | Edit form fields in http mode (`capabilities.orderEditFields`): comment (≤200), payment method, exact time (`scheduled_at`) or range (`scheduled_from` + `scheduled_to`). Only changed fields are sent, and nothing is sent when nothing changed. A set time can be changed but not cleared (the API has no "clear"). Seats and the HH:MM window stay demo-only. Only `searching` orders can be edited; the server answers 403 `driver_assigned` / `trip_started` / `order_closed`, and the drawer shows it. |
| `cancelOrder(id, reason, comment?)` | `adminOrdersCancel {reason, comment?}` | Reason select: `admin_decision`, `passenger_request`, `driver_request`, `duplicate`, `fraud`, `other` (`capabilities.orderCancelReasons`), plus an optional comment (≤500). The admin API has no per-order verdict (`Order.can_cancel` is the passenger's), so `canCancel` is true and the server's 403 (`trip_started`) decides. |
| `createOrderForPassenger` | **NONE** | No endpoint; hidden (`capabilities.orderCreate`). |
| `getWalletLedger` | `adminWalletLedger {wallet_id, driver_id}` | Kinds: `trip_payment`, `commission`, `topup`, `correction`→adjustment, `bonus`. The backoffice still serves sample ledger data. |
| `getDriverWalletInfo` | `adminDriversGet` (+ `adminWalletLedger?driver_id&limit=1` to learn `wallet_id`) | A driver with no ledger rows can't receive a correction until `AdminDriver.wallet_id` exists. |
| `createWalletCorrection` | `adminWalletCorrection` + `Idempotency-Key` | One request after the confirm modal (decision 2026-11-22). Reason 5–500 characters. Reported as applied only when the response says `approval_status: approved` (today the server returns `pending_approval`). |
| `getTariffSettings` / `updateTariffSettings` | expected `/admin/v1/tariff-settings` | The old per-route tariffs (`adminTariffs*`) are not used: replaced by the fuel/markup model (owner decision, no old editor kept). |
| `getComplaints({status, subjectType, assignedToMe})` | `adminComplaintsList {status, subject_type, assigned_to}` | Status: `open`↔open, `in_progress`↔reviewing, `resolved`↔resolved, `rejected`↔dismissed. Categories (`driver_behavior`, `passenger_behavior`, `payment`, `safety`, `lost_item`, `app_issue`, `other`) get their own labels. The list has no notes, so each card has a "Izohlarni ko'rish" button (`getComplaint`). Hidden in http mode: free-text search and the sample fraud/service split (no `q`, no category filter). Shown: subject filter and "assigned to me". `assigned_to`/`author_id` are staff ids, named from `/me` and the staff list when the role may read it, else `#1a2b3c4d`. |
| `getComplaint(id)` | `adminComplaintsGet` | Complaint with notes. |
| `assignComplaint(id, staffId)` | `adminComplaintsAssign {staff_id}` + `adminComplaintsGet` | "O'zimga biriktirish" (open → in_progress on the server). |
| `setComplaintStatus(id, status, resolution?)` | `adminComplaintsStatus {status, resolution?}` + `adminComplaintsGet` | "Hal qilish" / "Rad etish" ask for the closing text (3–1000; `capabilities.complaintResolution`). The server decides transitions; 403 `invalid_transition` (e.g. resolving an open complaint) is shown. |
| `addComplaintNote(id, text)` | `adminComplaintsNote {text}` + `adminComplaintsGet` | The POST returns the note only; the adapter refetches the complaint. |
| (create) | `adminComplaintsCreate` | Not used: the admin UI has no "new complaint" form (operators take complaints through the queue). |
| `getAuditLog({action, entityType, dateFrom, dateTo})` | `adminAuditList {action, entity_type, from_date, to_date}` | Actions are the backend's dotted names (`staff.update`, `wallet.correction.create`, `complaint.note.add`…), labelled in the screen and shown raw when unknown; an entity-type filter is added. No `q`, so search is hidden. Actor: staff name when known, else role + short id; "Tizim" without an actor. The detail line lists the changed fields; values only for non-personal keys (state, status, role…), never names, phones or emails. |
| `getQueue` | `adminOperatorQueue` | The row shows the kind and the `subject_id` until the queue item has a phone. |
| `getActiveTask` | derived from the queue (`status=in_progress`, `assigned_to=me`) | |
| `startTask` / `rejectQueueItem` | `adminOperatorStart` / `adminOperatorReject {reason}` | |
| `finishTask(id, result, note, rejectReason)` | `adminOperatorComplete {result, comment}` · rejected → `adminOperatorReject {reason}` | Sends `resolved`, `no_answer`, `callback` or `escalated`; the API accepts only `resolved`/`unresolved` today. |
| `getHistory` | `adminOperatorHistory` | |
| `getOperatorsInProgress` / `editHistoryEntry` / `getOperatorCounts` / `getOperatorsList` | **NONE** | Supervisor board is hidden; `operatorSupervise` is never granted. |
| `recordExport` | **NONE** | Export buttons are hidden (`export` isn't in `actions`). |

Contract operations the admin does not call:
- `adminDriversCreate`: no admin screen creates drivers (they register in the driver app).
- `adminOrdersGet`: the order list already returns full `Order` objects.
- `adminComplaintsCreate`: no "new complaint" form in the admin UI.
- `adminTariffs*` (old per-route tariffs) and the correction approve/reject/list operations: removed with the two-person approval and the new tariff model.

No WebSocket in admin: `/ws` accepts passenger/driver tokens only.

**Sample data on the server side.** The backoffice still serves drivers, passengers and the wallet ledger (and the driver/passenger figures in stats) from sample data; only orders and order stats come from the order service. So real orders' `passenger_id` usually doesn't match a row in the passengers list, and the admin UI doesn't try to join them. The UI never calls any of this data "real".

## Redesign v2: missing endpoints and fields

One line per endpoint. Paths and field names are the frontend's proposal; money in tiyin; errors `{ error: { key, params } }`. Each works in the mock adapter today; the capability flag in brackets turns it on in http mode.

**Me and permissions**
- `GET /admin/v1/me`: add `phone`, `actions: ("export"|"operator_work"|"operator_supervise")[]`, sections `marketing` (marketolog, superadmin, owner, menejer), `orders_view` and `drivers_view` (operator: list + counts only, drivers without `wallet_balance`).

**Search and dashboard**
- `GET /admin/v1/search?q=` → `{ items: { kind: order|driver|passenger|staff, id, title, subtitle }[] }`, only kinds the caller's sections allow [`globalSearch`].
- `GET /admin/v1/dashboard?period=today|7d|30d|90d` → the UI `Dashboard` shape: KPIs with `delta_pct` and 7-point series, daily orders split passenger/delivery, top routes, recent orders (newest first), attention items (`queue waiting`, `complaints open`, `fuel_price_updated_at`, drivers at limit).
- `GET /admin/v1/stats`: add `passengers_total`, `passengers_new`, `drivers_total`, `drivers_blocked`, `drivers_new`, `wallet_total_balance`, `registrations: { date, passengers, drivers }[]`, `income_by_route`, `income_by_city`.
- `GET /admin/v1/marketing?period=3m|6m|12m` → `{ monthly_orders, active_passengers, active_drivers, average_check: { value, delta_pct, spark[] }, commission_by_month: { month, value }[], funnel: { title, steps: { label, count, pct }[] }, order_types: { passenger_pct, delivery_pct } }`; funnel's first steps need app analytics events [`marketing`].
- `GET /admin/v1/section-badges` → counts per section for the sidebar [`sectionBadges`].

**Orders**
- `GET /admin/v1/orders`: add `q` (id, passenger name/phone, driver name), `type=passenger|delivery`, `from_date`/`to_date`; state the sort (`created_at` descending) [`orderSearch`, `orderKindFilter`, `orderDateFilter`].
- `GET /admin/v1/orders/counts?type=&from_date=&to_date=&q=&passenger_id=` → `{ all, <status>: n }` [`orderCounts`].
- `AdminOrder`: add `passenger { name, phone, rating }`, `size_label` (S–3XL), `luggage_count`, `cancelled_by`, `commission`, `driver_payout`, `commission_label`, `timeline[]`, `can_edit`, `can_cancel`.
- `POST /admin/v1/orders` for a passenger (create order) [`orderCreate`].
- `POST /admin/v1/orders/{id}/operator-task` `{ note? }` → `QueueItem` [`orderToOperator`].

**Drivers and passengers**
- `GET /admin/v1/drivers`: add `driver_state`, `route`, `level` filters; `GET /admin/v1/drivers/routes` → `string[]` [`driverRouteFilter`, `driverLevelFilter`].
- `GET /admin/v1/drivers/counts?q=&route=&level=` → `{ all, active, auto_review, blocked, archived }` [`driverCounts`].
- `AdminDriver`: add `wallet_id`, `debt_limit`, `at_debt_limit`, `city`, `route`, `level`, `commission_pct`, `accept_rate_30d`, `cancels_this_week`, `cancel_limit_week`, `cargo_bodies[]`, `loader_help`, `documents[]`, `trips_count`.
- `GET /admin/v1/drivers/{id}/trips?month=&kind=` → `{ month, months[], summary, counts, rows[] }` [`driverTrips`].
- `GET /admin/v1/passengers`: add `from_date`; `GET /admin/v1/passengers/counts?q=&from_date=` → `{ all, active, blocked, archived }` [`passengerJoinedFilter`, `passengerCounts`].
- `AdminPassenger`: add `city`, `total_trips`, `last_trip_at`, `last_payment { method, card_last4? }`; `warned` only if the owner decides it exists.

**Wallet**
- `POST /admin/v1/wallet/correction`: apply on create (ledger row + balance) and return the written entry; accept optional `entry_id` [`correctionEntryRef`].
- `POST /admin/v1/wallet/correction/preview` → `{ balance_before, balance_after }` for the confirm modal.
- `GET /admin/v1/wallet/ledger`: add `kind`, `q`, `driver_id`, `from_date`/`to_date`, and a total; `LedgerEntry` add `driver_id`, `driver_name`, `note` [`walletLedgerFilters`].
- `GET /admin/v1/wallet/summary` → `{ topped_up_today, topup_split?, commission_today, commission_trips, drivers_at_limit, reconciliation? }` [`ledgerSummary`].
- Ledger kinds `tip` and `penalty`, if the backend adds them [`walletKinds`].

**Tariffs**
- `GET /admin/v1/tariff-settings?city_id=` → `{ city_id, fuel[], classes[], bodies[], extras[], levels[], example }` with server-computed example prices [`tariffSettings`].
- `PATCH /admin/v1/tariff-settings` `{ city_id, <one section> }` + `Idempotency-Key` → full settings; applies to new orders only.
- `GET /admin/v1/tariff-settings/cities` → `{ data: { id, name }[] }` [`tariffCities`].

**Operator queue**
- `QueueItem`: add `phone`, `subject_kind`, `subject_name`, `order_id`, `request_text`, kind `document_update`.
- `POST /admin/v1/operator/queue/{id}/complete`: `result` values `resolved | no_answer | callback | escalated`.
- `POST /admin/v1/operator/queue/{id}/postpone` → item back in the queue, `waiting_since` kept [`queuePostpone`].
- `GET /admin/v1/operator/me/stats` → `{ resolved_today, no_answer_today, avg_handle_sec }` [`operatorMyStats`].
- `GET /admin/v1/operator/queue`: add `kind`, `q`, `operator_id`; in-progress list for supervisors [`queueFilters`].
- `GET /admin/v1/operator/history`: add `kind`, `result`, `operator_id`, `from_date`/`to_date`, operator name [`historyFilters`].
- `GET /admin/v1/operator/counts` (same filters) → `{ queue, in_progress, done }` [`operatorCounts`].
- `GET /admin/v1/operators` → `{ id, name }[]` (board filter).
- `PATCH /admin/v1/operator/history/{id}` `{ result, comment }`, own entries only [`historyEdit`].

**Staff**
- `GET /admin/v1/staff`: add `q`, `state`; `Staff` add `last_login_at`, `login_method`, `can_edit` [`staffSearch`, `staffStatusFilter`, `staffLastLogin`].
- `GET /admin/v1/staff/counts?q=&state=` → `{ all, <role>: n }` [`staffCounts`].
- `StaffUpdate`: allow `email` and `state: active` for an archived member [`staffEmailEdit`, `restoreStaff`].

**Audit, complaints, export**
- `GET /admin/v1/audit`: add `q`, `entity_id`, `category`; `AuditEntry` add `actor_role`, `category`, `ip` (as shown, e.g. `185.74.•.•`); publish the action catalogue [`auditSearch`, `auditCategories`].
- `GET /admin/v1/complaints`: add `q` and a category filter [`complaintSearch`, `complaintCategoryFilter`].
- `POST /admin/v1/exports` `{ section }` → audit entry for a CSV export [`export` action].

**Lists**
- Cursor lists: the adapter follows `cursor` for at most 5 pages × 100 rows; larger sets need server totals and paging.
