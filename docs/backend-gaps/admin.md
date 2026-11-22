# Admin app — adapter ↔ contract map

Source of truth: `api/openapi.yml` (0.2.0). Mapper: `admin/src/api/httpMapper.ts`. Adapter: `admin/src/api/adapters/http.ts`.
Money: the UI works in so'm, the API in tiyin. The mapper multiplies or divides by 100 at the boundary.
"NONE" means the http adapter rejects with `ApiError("NOT_SUPPORTED")` and `api.capabilities` hides the feature.

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
| `getStats(period)` | `adminStats {from_date,to_date}` | Mapped: revenue, commission, `average_order_value`, active_drivers, online_drivers, new_passengers, orders_total/completed/cancelled/`expired`, drivers_over_limit. `orders_by_status` → the by-status bar chart. `daily` → income over time (`revenue`) and orders/completed over time; days missing from `daily` are zero-order days (the contract lists only days with orders) and are filled in for the requested range. `top_routes` → the routes card, ranked by order count. **Missing** (hidden in http mode): passengersTotal, driversTotal, driversBlocked, driversNew, walletTotalBalance, registrations series, incomeByRoute, incomeByCity. The driver/passenger figures come from the backoffice's sample data (see below). |
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
| `revealPhone` | removed | Decision 2026-11-22: admin shows phone numbers in full for every role (no masking, no reveal button). Lists show `phone` as sent, formatted `+998 90 123 45 67`. No endpoint needed. |
| `getOrders({status, passengerId})` | `adminOrdersList {status, passenger_id}` | `passenger_id` → `passengerId` (shown as a short id in the order drawer; there is no passenger name). `cancel_reason` codes are labelled; `scheduled_from`/`scheduled_to` are shown as a range. The `passenger_id` filter is wired in the adapter; no screen links passengers to orders yet. Missing: `q`, passenger name. Statuses: `arrived` and `expired` are added; `no_driver` has no API equivalent. |
| `updateOrderFields(id, patch)` | `adminOrdersUpdate` (PATCH) | Edit form fields in http mode (`capabilities.orderEditFields`): comment (≤200), payment method, exact time (`scheduled_at`) or range (`scheduled_from` + `scheduled_to`). Only changed fields are sent, and nothing is sent when nothing changed. A set time can be changed but not cleared (the API has no "clear"). Seats and the HH:MM window stay demo-only. Only `searching` orders can be edited; the server answers 403 `driver_assigned` / `trip_started` / `order_closed`, and the drawer shows it. |
| `cancelOrder(id, reason, comment?)` | `adminOrdersCancel {reason, comment?}` | Reason select: `admin_decision`, `passenger_request`, `driver_request`, `duplicate`, `fraud`, `other` (`capabilities.orderCancelReasons`), plus an optional comment (≤500). The admin API has no per-order verdict (`Order.can_cancel` is the passenger's), so `canCancel` is true and the server's 403 (`trip_started`) decides. |
| `createOrderForPassenger` | **NONE** | No endpoint; hidden (`capabilities.orderCreate`). |
| `getWalletLedger` | `adminWalletLedger {wallet_id, driver_id}` | Missing: `kind` filter, search, and a driver name or id on `LedgerEntry` (only `wallet_id`). Kinds: `trip_payment`, `commission`, `topup`, `correction`→adjustment, `bonus`. The backoffice still serves sample ledger data. |
| `getDriverWalletInfo` | `adminDriversGet` (+ `adminWalletLedger?driver_id&limit=1` to learn `wallet_id`) | **Gap:** `AdminDriver` has no `wallet_id` or `debt_limit`. A driver with no ledger rows can't receive a correction. |
| `createWalletCorrection` | `adminWalletCorrection` + `Idempotency-Key` | One request after the confirm modal (decision 2026-11-22). Reason 5–500 characters. Reported as applied only when the response says `approval_status: approved`; see "Redesign v2 → Group 4". |
| `getTariffSettings` / `updateTariffSettings` | **NONE** | Old per-route tariffs (`adminTariffs*`) are no longer used: replaced by the fuel/markup model, see "Redesign v2 → Group 4". |
| `getComplaints({status, subjectType, assignedToMe})` | `adminComplaintsList {status, subject_type, assigned_to}` | Status: `open`↔open, `in_progress`↔reviewing, `resolved`↔resolved, `rejected`↔dismissed. Categories (`driver_behavior`, `passenger_behavior`, `payment`, `safety`, `lost_item`, `app_issue`, `other`) get their own labels. The list has no notes, so each card has a "Izohlarni ko'rish" button (`getComplaint`). Hidden in http mode: free-text search and the sample fraud/service split (no `q`, no category filter). Shown: subject filter and "assigned to me". `assigned_to`/`author_id` are staff ids, named from `/me` and the staff list when the role may read it, else `#1a2b3c4d`. |
| `getComplaint(id)` | `adminComplaintsGet` | Complaint with notes. |
| `assignComplaint(id, staffId)` | `adminComplaintsAssign {staff_id}` + `adminComplaintsGet` | "O'zimga biriktirish" (open → in_progress on the server). |
| `setComplaintStatus(id, status, resolution?)` | `adminComplaintsStatus {status, resolution?}` + `adminComplaintsGet` | "Hal qilish" / "Rad etish" ask for the closing text (3–1000; `capabilities.complaintResolution`). The server decides transitions; 403 `invalid_transition` (e.g. resolving an open complaint) is shown. |
| `addComplaintNote(id, text)` | `adminComplaintsNote {text}` + `adminComplaintsGet` | The POST returns the note only; the adapter refetches the complaint. |
| (create) | `adminComplaintsCreate` | Not used: the admin UI has no "new complaint" form (operators take complaints through the queue). |
| `getAuditLog({action, entityType, dateFrom, dateTo})` | `adminAuditList {action, entity_type, from_date, to_date}` | Actions are the backend's dotted names (`staff.update`, `wallet.correction.approve`, `complaint.note.add`…), labelled in the screen and shown raw when unknown; an entity-type filter is added. No `q`, so search is hidden. Actor: staff name when known, else role + short id; "Tizim" without an actor. The detail line lists the changed fields; values only for non-personal keys (state, status, role…), never names, phones or emails. |
| `getQueue` | `adminOperatorQueue` | Missing: phone, search and `kind` filter. The row shows the kind and the `subject_id`. Kinds `driver_application` and `document_update` are added to the UI. |
| `getActiveTask` | derived from the queue (`status=in_progress`, `assigned_to=me`) | |
| `startTask` / `rejectQueueItem` | `adminOperatorStart` / `adminOperatorReject {reason}` | |
| `finishTask(id, result, note, rejectReason)` | resolved → `adminOperatorComplete {resolved}` · callback → `{unresolved}` · rejected → `adminOperatorReject` | |
| `getHistory` | `adminOperatorHistory` | Missing: filters (result, dates, operator), operator name, phone. |
| `getOperatorsInProgress` / `editHistoryEntry` / `getOperatorCounts` / `getOperatorsList` | **NONE** | Supervisor views are hidden; `operatorSupervise` is never granted. |
| `recordExport` | **NONE** | Export buttons are hidden (`export` isn't in `actions`). |

The contract (0.2.0) has 49 admin operations, counting the 3 login steps and logout. The admin adapter uses 46 of them. Unused:
- `adminDriversCreate`: no admin screen creates drivers (they register in the driver app).
- `adminOrdersGet`: the order list already returns full `Order` objects.
- `adminComplaintsCreate`: no "new complaint" form in the admin UI.

No WebSocket in admin: `/ws` accepts passenger/driver tokens only.

**Sample data on the server side.** The backoffice still serves drivers, passengers and the wallet ledger (and the driver/passenger figures in stats) from sample data; only orders and order stats come from the order service. So real orders' `passenger_id` usually doesn't match a row in the passengers list, and the admin UI doesn't try to join them. The UI never calls any of this data "real".

`adminStaffGet`, `adminDriversGet`, `adminPassengersGet` and `adminTariffsGet` serve as fallbacks: for archive results, wallet info, phone reveal and the full-object tariff PUT.

## Shapes the frontend needs (missing in the contract)

- `GET /admin/v1/me` → add `phone`, `actions: ("export"|"operator_work"|"operator_supervise")[]`, and optionally `landing_section`.
- `GET /admin/v1/staff?q=&state=` and `Staff.last_login_at`. Add `StaffUpdate.email`, plus a way to restore an archived member (`state: active` allowed in `StaffUpdate`).
- `GET /admin/v1/drivers?driver_state=` and `AdminDriver.{wallet_id, debt_limit, online, city}`.
- `AdminPassenger.city` (if the UI keeps it).
- `GET /admin/v1/orders?q=`, a passenger name on the admin order, and an admin verdict per order (`can_edit`, `can_cancel`).
  Create order for a passenger.
- `GET /admin/v1/wallet/ledger?kind=&q=` and `LedgerEntry.driver_id`; `driver_id` on correction list items.
- `GET /admin/v1/tariffs?q=&active=`.
- `QueueItem.{phone, subject_name}` (the operator calls this number; shown in full), plus `GET /admin/v1/operator/queue?kind=&q=`.
  `GET /admin/v1/operator/history?result=&from_date=&to_date=&operator_id=`, with an operator name on the item.
  Supervisor endpoints: in-progress list, per-status counts, operators list.
- An export audit endpoint; complaint free-text search and category filter; the audit action/entity catalogue in the contract (today free strings).
- `Stats`: totals and blocked/new counts for drivers and passengers, total wallet balance, registrations series, income by route and city.
- Section badges (`getSectionBadges`).
- Cursor lists: the adapter follows `cursor` for at most 5 pages × 100 rows. Larger sets are cut off; a paged table would need UI work.

## Redesign v2

Admin redesign v2 (design-v2/admin, 2026-11-22). Endpoints the new screens expect. The http adapter already calls them, but they stay hidden (`capabilities.*: false`) until the backend ships them. Errors are `{ error: { key, params } }` as everywhere.

### Header search (group 1)

- `GET /admin/v1/search?q=<text>` (min 2 chars), auth: any staff.
  - Response: `{ items: { kind: "order"|"driver"|"passenger"|"staff", id: string, title: string, subtitle: string }[] }`, at most ~12 items.
  - The server returns only kinds the caller's sections allow (operator: none or own scope; marketolog: none). `subtitle` is display text.
  - Matches: order id, driver/passenger name, plate, phone, staff name/email.
  - Errors: `validation.too_short` (q < 2), `auth.forbidden`.
  - Capability flag in the adapter: `globalSearch`.

### Group 3: dashboard, orders, drivers, passengers

Field and endpoint names below are the frontend's proposal; error keys follow the existing `{ error: { key, params } }` style and are not a documented server rule. Everything the server leaves out is hidden in the UI (`null`), never computed in the browser.

**Dashboard** (`getDashboard`; today composed from `GET /admin/v1/stats`, so it already works in http mode with KPIs, a 14-day total chart, top routes, recent orders and the debt-limit card):
- `Stats` per period also needs the previous period's values (or `delta_pct`) for `orders_total`, `active_drivers`, `new_passengers`, `commission`, and a 7-point series for each (sparklines).
- `Stats.daily[]`: split `orders` into `orders_passenger` and `orders_delivery` (stacked bars).
- Attention items, either as fields (`operator_queue_waiting`, `operator_queue_oldest_at`, `complaints_open`, `fuel_price_updated_at`) or as a list `attention: { id, tone: "info"|"warning"|"danger", title, detail, section }[]` filtered by the caller's sections.
- Alternative to all of the above: `GET /admin/v1/dashboard?period=today|7d|30d` returning the UI's `Dashboard` shape (`admin/src/api/types.ts`).

**Orders**
- `GET /admin/v1/orders`: add `type=passenger|delivery` (capability `orderKindFilter`) and `q` (id, passenger name/phone, driver name).
- `GET /admin/v1/orders/counts?type=&from_date=&to_date=&q=&passenger_id=` → `{ all, searching, accepted, arrived, in_progress, completed, cancelled, expired }` (chip counters; `orderCounts`). The list is cut at 500 rows, so the UI never counts rows itself.
- `AdminOrder` additions: `passenger: { name, phone, rating }`; `size_label: "S"…"3XL"` for delivery (the order's `vehicle_type` is a car name and is never shown); `luggage_count`; `cancelled_by: "passenger"|"driver"|"admin"`; `commission` and `driver_payout` (Money) with a label such as "Komissiya (Kumush, 5%)" or `{ level, pct }`; `timeline: { title, detail, at, estimated, state: "done"|"current"|"pending" }[]`.
- Sort order: the dashboard takes the first 4 rows of `GET /admin/v1/orders` as "So'nggi buyurtmalar". The contract does not say the list is newest first; please state it (`created_at` descending).
- `POST /admin/v1/orders/{id}/operator-task` `{ note?: string ≤500 }` → `201 QueueItem` ("Operatorga yuborish"; capability `orderToOperator`). Errors: `ORDER_NOT_FOUND`, `FORBIDDEN`. Note: doc 2.4 still lists "how tasks enter the operator queue" as an open question; this endpoint rests on that answer.

**Drivers**
- `GET /admin/v1/drivers`: add `route` and `level` filters; `GET /admin/v1/drivers/routes` → `string[]` (filter options); `GET /admin/v1/drivers/counts?q=&route=&level=` → `{ all, active, auto_review, blocked, archived }`.
- `AdminDriver` additions: `route` (display text), `level: "bronze"|"silver"|"gold"`, `commission_pct`, `at_debt_limit` (server verdict for the "Qarz chegarasi" badge), `debt_limit`, `accept_rate_30d`, `cancels_this_week`, `cancel_limit_week`, `cargo_bodies: ("S"…"3XL")[]`, `loader_help`, `documents: { title, detail, status: "verified"|"checking"|"rejected" }[]`.
- `GET /admin/v1/drivers/{id}/trips?month=YYYY-MM&kind=passenger|delivery|cancelled` → `{ month, months: string[], summary: { trips, trips_total, income, commission, commission_avg_pct, cancelled, cancelled_pct }, counts: { all, passenger, delivery, cancelled }, rows: { order_id, kind, at, from_name, to_name, subject, price, payment_method, commission, payout, status, cancelled_by }[] }` (driver history tab; capability `driverTrips`). Money in tiyin like the rest of the contract.

**Passengers**
- `GET /admin/v1/passengers`: add `from_date` for "Ro'yxatdan o'tgan" (`passengerJoinedFilter`); `GET /admin/v1/passengers/counts?q=&from_date=` → `{ all, active, blocked, archived, warned? }`.
- `AdminPassenger` additions: `last_trip_at`, `last_payment: { method, card_last4? }`.
- "Ogohlantirilgan" (`warned`) is in the design but not in the docs. The UI shows it only if the server sends it and offers no action that sets it. Owner decision needed.

**Links between screens**
- "Audit tarixi" (order panel) and the driver "Audit" tab open the audit log filtered by that object. Needs `GET /admin/v1/audit?entity_id=<uuid>` (or `q`); hidden while `auditSearch` is false.
- The driver "Hamyon" tab opens the ledger filtered by that driver. Needs `GET /admin/v1/wallet/ledger?driver_id=` (already listed above as ledger filters); hidden while `walletLedgerFilters` is false.

### Group 4: ledger, correction entry, tariffs (decision 2026-11-22)

**No second person.** A tariff change and a ledger correction are made by one staff member in two UI steps (Save → confirm modal with old → new → Confirm). The frontend sends exactly one request on Confirm and nothing on Cancel. The server writes the audit entry.

**Blocks production until the backend changes:**
- `POST /admin/v1/wallet/correction` must apply the correction on create (ledger row written, balance updated) and return it as applied. Today it returns `approval_status: pending_approval` and the creator cannot approve their own entry (`self_approval`), so with the approve UI removed a correction from the panel would never take effect. The UI says so instead of claiming success.
- `GET/POST /admin/v1/wallet/correction/{id}/approve|reject`, `GET /admin/v1/wallet/correction?approval_status=` and `/admin/v1/tariffs/{id}/approve|reject` are no longer called by the admin.
- The new tariff model has no endpoint yet, so in http mode the Tariffs page shows "not available yet" (`capabilities.tariffSettings = false`). The old per-route tariff endpoints (`/admin/v1/tariffs`) are no longer used.

**Correction**
- `CorrectionCreate` + optional `entry_id` (the ledger entry being corrected, "Qaysi yozuvga"; `correctionEntryRef`). Errors: `VALIDATION_ERROR` (amount 0, reason outside 5–500), `NOT_FOUND` (entry of another wallet).
- Response: the written `LedgerEntry` (or `Correction` with `applied_entry_id`) so the UI can show it.
- Optional preview for the confirm modal: `POST /admin/v1/wallet/correction/preview` → `{ balance_before, balance_after }`. Until it exists the modal shows the current balance only, never a computed new one.

**Ledger**
- `LedgerEntry` additions: `driver_id`, `driver_name`, `note` (display text such as "Safar #48190 · 5%" or "Payme · tranzaksiya ••8821").
- `GET /admin/v1/wallet/ledger`: add `kind`, `q`, `from_date`/`to_date` (`walletLedgerFilters`). Kinds the UI knows: `topup`, `commission`, `trip_payment`, `correction`, `bonus`, plus `tip` (choy puli) and `penalty` (jarima) if the backend adds them (the docs do not define them; chips appear only for kinds in `walletKinds`).
- `GET /admin/v1/wallet/summary` → `{ topped_up_today, topup_split?: string, commission_today, commission_trips, drivers_at_limit, reconciliation?: { match_pct, at } }` (KPI tiles; `ledgerSummary`).

**Tariff settings** (`tariffSettings`, `tariffCities`)
- `GET /admin/v1/tariff-settings?city_id=` → `{ city_id, fuel: [{ kind: "gas"|"petrol", label, price_per_litre, updated_at }], classes: [{ key: economy|comfort|business|minivan, label, seats, fuel, markup_kind: "percent"|"sum", markup_value, example_price }], bodies: [{ size: S…3XL, fuel, markup_kind, markup_value, example_base, example_price }], extras: [{ key: free_wait_min|wait_per_min|stop|loader|cancel_fee, label, unit: "min"|"som", value }], levels: [{ level: bronze|silver|gold, commission_pct, min_trips_week, min_rating, max_cancels_week }], example_distance_km, example: { title, distance_km, fuel_label, fuel_price, base, markup_label, markup, total } }`. Money in tiyin; a `sum` markup is money, a `percent` markup is a number.
- `PATCH /admin/v1/tariff-settings` with `Idempotency-Key`, body `{ city_id, <one section> }` (`fuel` | `classes` | `bodies` | `extras` | `levels`) → the full settings with fresh examples. Applies to new orders only; existing orders keep their price (doc 2.5). Errors: `VALIDATION_ERROR` (negative, commission > 100, unknown key).
- `GET /admin/v1/tariff-settings/cities` → `{ data: { id, name }[] }` (the "Shahar" filter; only if tariffs differ per city).
- Dashboard: `fuel_price_updated_at` (or an attention item) for the "Gaz narxi N kundan beri yangilanmagan" card.

### Group 5: operators, staff, audit, marketing

**Permissions (`GET /admin/v1/me`)**
- The operator's read-only windows (owner task, design OperatorHistory/OperatorDrivers): add sections `orders_view` and `drivers_view` for the operator role. They allow `GET /admin/v1/orders` (+ counts) and `GET /admin/v1/drivers` (+ counts) only, no detail, no actions, and the drivers response must not include `wallet_balance` (send `null`). Until `me` returns them the "Buyurtmalar" tab and "Haydovchilar" item are hidden.
- Marketolog: a `marketing` section (design Marketing) next to or instead of `stats`. Until it exists the marketolog keeps the old dashboard in http mode.
- Staff rows: `login_method: "email_sms" | "sms"` and `last_login_at` (column "Kirish", "Oxirgi faollik").

**Operator queue** (owner decision 2026-11-22: five results, postpone keeps the wait time)
- `QueueItem` additions: `subject_kind: "passenger" | "driver"`, `subject_name`, `phone` (full, see handoff decision), `order_id`, `request_text` (the "Zayavka" text), `kind` value `document_update` ("Hujjat").
- `POST /admin/v1/operator/queue/{id}/complete`: `result` needs `resolved | no_answer | callback | escalated` (today only `resolved | unresolved`). Until then the admin sends `unresolved` and puts the label ("Javob bermadi", "Qayta qo'ng'iroq", "Menejerga yuborildi") at the start of `comment`; history shows these as "Hal qilinmadi".
- `POST /admin/v1/operator/queue/{id}/postpone` → the item back in the queue, `waiting_since` unchanged, assignment cleared (`queuePostpone`; button hidden until then).
- `GET /admin/v1/operator/me/stats` → `{ resolved_today, no_answer_today, avg_handle_sec }` (KPI tiles under the current task; `operatorMyStats`).
- Board filters: `GET /admin/v1/operator/queue` and the in-progress list accept `kind`, `operator_id`, `q`; history accepts `kind`, `result`, `operator_id`, `from_date`/`to_date`; counts endpoint with the same filters → `{ queue, in_progress, done }` (`queueFilters`, `historyFilters`, `operatorCounts`).
- `PATCH` of the operator's own history entry (result + comment), already listed above as `historyEdit`.

**Staff**
- `GET /admin/v1/staff/counts?q=&status=` → `{ all, superadmin, owner, menejer, marketolog, operator }` (role chips; `staffCounts`).

**Audit**
- `AuditEntry` additions: `actor_role`, `category: money | tariff | block | personal | login | staff`, `ip` as the server wants it shown (design shows `185.74.•.•`). The IP column appears only when entries have it.
- `GET /admin/v1/audit?category=` (category chips; `auditCategories`).

**Marketing** (`marketing`)
- `GET /admin/v1/marketing?period=3m|6m|12m` → `{ monthly_orders, active_passengers, active_drivers, average_check: { value, delta_pct, spark[] } | null, commission_by_month: { month, value }[] | null, funnel: { title, steps: { label, count, pct }[] } | null, order_types: { passenger_pct, delivery_pct } | null }`. Money in tiyin. Any `null` block is hidden. The funnel's first steps (app opened, price seen) need app analytics events that the backend does not collect yet.
