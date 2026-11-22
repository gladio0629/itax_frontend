# Admin app — adapter ↔ contract map

Source of truth: `api/openapi.yml` (0.2.0). Mapper: `admin/src/api/httpMapper.ts`. Adapter: `admin/src/api/adapters/http.ts`.
Money: the UI works in so'm, the API in tiyin. The mapper multiplies or divides by 100 at the boundary.
"NONE" means the http adapter rejects with `ApiError("NOT_SUPPORTED")` and `api.capabilities` hides the feature.

## Method → operation

| Adapter method | Operation | Notes / mismatches |
|---|---|---|
| `requestLogin(identifier)` | `adminLoginEmail` (email) · `adminLoginSms {phone}` (operator, no email) | The email path needs the staff phone at step 2. The login screen asks for it (`needsPhone`). There is no `resend_after` for admin, so the UI uses a 60 s cooldown and relies on 429. Each challenge's `code_length` sets the number of code boxes and the auto-submit length (`codeLength`); without it the UI shows 6 boxes and accepts 4+ digits for SMS. |
| `verifyLoginStep(id, code, {phone})` | `adminLoginSms {challenge_id, email_code, phone}` → `adminLoginVerify {challenge_id, sms_code}` | The final step returns an already-approved local review id. No timers. |
| `resendLoginCode(id)` | repeats `adminLoginEmail` / `adminLoginSms` | Uses the new `challenge_id` and `code_length` from the response. |
| `getReviewStatus` | NONE (local) | Results that are already settled, kept in memory. |
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
| `proposeWalletAdjustment` | `adminWalletCorrection` + `Idempotency-Key` | The key is reused on retry of the same body. Reason 5–500 characters (`capabilities.adjustmentReasonMinLength`). |
| `getAdjustmentProposals({status})` | `adminWalletCorrectionList {approval_status}` | `pending_second` → `pending_approval`. The "approve or reject by ID" workaround and the in-tab list are gone; the wallet screen lists pending corrections with approve/reject buttons. `created_by_name` → proposer. Items carry `wallet_id` only, so the row shows "Hamyon #…" unless the driver's wallet id is already known from the ledger. |
| `approveAdjustment` / `rejectAdjustment(id, reason)` | `adminWalletCorrectionApprove` / `…Reject {reason ≥3}` | The creator's own approve/reject gets 403 `self_approval`, shown on screen. |
| `getTariffs` | `adminTariffsList` | Fields differ completely. The UI-only fields (`perKmSeat`, `frontSeatSurcharge`, `fuelAdjustmentPct`) are hidden. The API fields `per_min`, `min_fare`, `car_class` are shown (`capabilities.tariffFields`). No `q` and no status filter, so the list is split by `active`. |
| `getTariffProposals` | derived from `Tariff.pending_change` | **Gap:** `pending_change` has no proposed values, so the UI shows only the action and the time. |
| `proposeTariffCreate` / `Edit` / `Archive` | `adminTariffsCreate` / `adminTariffsUpdate` (full `TariffInput`, merged with the current values) / `adminTariffsDelete` | |
| `approveTariffProposal` / `rejectTariffProposal(id, reason)` | `adminTariffsApprove` / `adminTariffsReject` | The proposal id is the tariff id. |
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
- `Tariff.pending_change.values: Partial<TariffFields>`, so the second approver can see what they approve.
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
