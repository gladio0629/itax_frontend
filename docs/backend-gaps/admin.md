# Admin app — adapter ↔ contract map

Source of truth: `api/openapi.yml`. Mapper: `admin/src/api/httpMapper.ts`. Adapter: `admin/src/api/adapters/http.ts`.
Money: the UI works in so'm, the API in tiyin. The mapper multiplies or divides by 100 at the boundary.
"NONE" means the http adapter rejects with `ApiError("NOT_SUPPORTED")` and `api.capabilities` hides the feature.

## Method → operation

| Adapter method | Operation | Notes / mismatches |
|---|---|---|
| `requestLogin(identifier)` | `adminLoginEmail` (email) · `adminLoginSms {phone}` (operator, no email) | The email path needs the staff phone at step 2. The login screen asks for it (`needsPhone`). There is no `resend_after` for admin, so the UI uses a 60 s cooldown and relies on 429. The SMS code may be 4–6 digits (`codeMinLength`). |
| `verifyLoginStep(id, code, {phone})` | `adminLoginSms {challenge_id, email_code, phone}` → `adminLoginVerify {challenge_id, sms_code}` | The final step returns an already-approved local review id. No timers. |
| `resendLoginCode(id)` | repeats `adminLoginEmail` / `adminLoginSms` | Uses the new `challenge_id` from the response. |
| `getReviewStatus` | NONE (local) | Results that are already settled, kept in memory. |
| `logout` | **NONE** | The contract has no admin logout or revoke. Logout only clears local memory; the token stays valid server-side until `expires_in`. |
| `isAuthenticated` | local | Tokens are in memory only. A reload means a full login. `AdminToken` has no refresh token, so a 401 means logging in again. |
| `getMe` | `adminMe` | `full_name` → name. Missing: `phone`, `actions`, `landingPath`, avatar. `actions` is derived 1:1 from `sections` (`operator` → `operatorWork`). `landingPath` is the first allowed section. Sections: `operator` → `operators`. `complaints` and `audit` have no API section. |
| `loginAsRole` | NONE | Test panel only. |
| `getStats(period)` | `adminStats {from_date,to_date}` | Mapped: revenue, commission, active_drivers, online_drivers, new_passengers, orders_total/completed/cancelled, drivers_over_limit. **Missing** (hidden in http mode): passengersTotal, driversTotal, driversBlocked, driversNew, averageOrderValue, walletTotalBalance, all time series (registrations, incomeOverTime), ordersByStatus, ordersByRoute, incomeByRoute, incomeByCity. |
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
| `revealPhone` | NONE | List responses already contain full phones. The mapper masks them for display, and "Ko'rsatish" reveals the value already received. **Gap:** no masked list plus audited reveal endpoint (the mock audits every reveal). |
| `getOrders({status})` | `adminOrdersList {status, from_date, to_date}` | Missing: `q`, passenger name/id on `Order`, city ids (only `from.address`/`to.address`), `cancel_reason`. Statuses: `arrived` and `expired` are added; `no_driver` has no API equivalent. |
| `createOrderForPassenger` / `updateOrderFields` / `cancelOrder` | **NONE** | No admin order mutations (the contract says "faqat ko'rish"). `canCancel` is always false. |
| `getWalletLedger` | `adminWalletLedger {wallet_id, driver_id}` | Missing: `kind` filter, search, and a driver name or id on `LedgerEntry` (only `wallet_id`). Kinds: `trip_payment`, `commission`, `topup`, `correction`→adjustment, `bonus`. |
| `getDriverWalletInfo` | `adminDriversGet` (+ `adminWalletLedger?driver_id&limit=1` to learn `wallet_id`) | **Gap:** `AdminDriver` has no `wallet_id` or `debt_limit`. A driver with no ledger rows can't receive a correction. |
| `proposeWalletAdjustment` | `adminWalletCorrection` + `Idempotency-Key` | The key is reused on retry of the same body. |
| `getAdjustmentProposals` | **NONE** | No endpoint lists pending corrections. The http UI offers "approve or reject by ID" instead, plus the corrections created in this tab (memory only). |
| `approveAdjustment` / `rejectAdjustment(id, reason)` | `adminWalletCorrectionApprove` / `…Reject {reason ≥3}` | |
| `getTariffs` | `adminTariffsList` | Fields differ completely. The UI-only fields (`perKmSeat`, `frontSeatSurcharge`, `fuelAdjustmentPct`) are hidden. The API fields `per_min`, `min_fare`, `car_class` are shown (`capabilities.tariffFields`). No `q` and no status filter, so the list is split by `active`. |
| `getTariffProposals` | derived from `Tariff.pending_change` | **Gap:** `pending_change` has no proposed values, so the UI shows only the action and the time. |
| `proposeTariffCreate` / `Edit` / `Archive` | `adminTariffsCreate` / `adminTariffsUpdate` (full `TariffInput`, merged with the current values) / `adminTariffsDelete` | |
| `approveTariffProposal` / `rejectTariffProposal(id, reason)` | `adminTariffsApprove` / `adminTariffsReject` | The proposal id is the tariff id. |
| `getComplaints` / `assignComplaint` / `setComplaintStatus` / `addComplaintNote` | **NONE** | Only the operator queue has `kind: complaint`. The section is hidden because it isn't in `sections`. |
| `getAuditLog` | **NONE** | The section is hidden. |
| `getQueue` | `adminOperatorQueue` | Missing: phone, search and `kind` filter. The row shows the kind and the `subject_id`. Kinds `driver_application` and `document_update` are added to the UI. |
| `getActiveTask` | derived from the queue (`status=in_progress`, `assigned_to=me`) | |
| `startTask` / `rejectQueueItem` | `adminOperatorStart` / `adminOperatorReject {reason}` | |
| `finishTask(id, result, note, rejectReason)` | resolved → `adminOperatorComplete {resolved}` · callback → `{unresolved}` · rejected → `adminOperatorReject` | |
| `getHistory` | `adminOperatorHistory` | Missing: filters (result, dates, operator), operator name, phone. |
| `getOperatorsInProgress` / `editHistoryEntry` / `getOperatorCounts` / `getOperatorsList` | **NONE** | Supervisor views are hidden; `operatorSupervise` is never granted. |
| `recordExport` | **NONE** | Export buttons are hidden (`export` isn't in `actions`). |

The contract has 38 admin operations, counting the 3 login steps. The admin adapter uses 36 of them. Unused:
- `adminDriversCreate`: no admin screen creates drivers (they register in the driver app).
- `adminOrdersGet`: the order list already returns full `Order` objects.

`adminStaffGet`, `adminDriversGet`, `adminPassengersGet` and `adminTariffsGet` serve as fallbacks: for archive results, wallet info, phone reveal and the full-object tariff PUT.

## Shapes the frontend needs (missing in the contract)

- `POST /admin/v1/auth/logout` → `204`: revokes the admin token.
- `GET /admin/v1/me` → add `phone`, `actions: ("export"|"operator_work"|"operator_supervise")[]`, and optionally `landing_section`.
- `GET /admin/v1/staff?q=&state=` and `Staff.last_login_at`. Add `StaffUpdate.email`, plus a way to restore an archived member (`state: active` allowed in `StaffUpdate`).
- `GET /admin/v1/drivers?driver_state=` and `AdminDriver.{wallet_id, debt_limit, online, city}`.
- `AdminPassenger.city` (if the UI keeps it).
- Masked phones in lists plus `POST /admin/v1/{drivers|passengers}/{id}/phone` → `{ phone }` (audited).
- `GET /admin/v1/orders?q=` and `Order.{passenger: {id, first_name}, cancel_reason}`.
  Order mutations (create for passenger, edit comment/seats/time, cancel with reason) if admins should have them.
- `GET /admin/v1/wallet/ledger?kind=&q=` and `LedgerEntry.driver_id`.
  `GET /admin/v1/wallet/correction?approval_status=pending_approval` → `CursorPage<Correction>` (with `driver_id` and creator name).
- `Tariff.pending_change.values: Partial<TariffFields>`, so the second approver can see what they approve.
- `GET /admin/v1/tariffs?q=&active=`.
- `QueueItem.{phone_masked, subject_name}`, plus `GET /admin/v1/operator/queue?kind=&q=`.
  `GET /admin/v1/operator/history?result=&from_date=&to_date=&operator_id=`, with an operator name on the item.
  Supervisor endpoints: in-progress list, per-status counts, operators list.
- Complaints (list, assign, status, notes), audit log, and an export audit endpoint, if those sections stay.
- `Stats`: totals and blocked/new counts for drivers and passengers, average order value, total wallet balance, daily series, top routes and cities.
- Cursor lists: the adapter follows `cursor` for at most 5 pages × 100 rows. Larger sets are cut off; a paged table would need UI work.
