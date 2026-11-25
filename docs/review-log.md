# Redesign v2: review log

Reviewer terminal (branch `redesign-v2`). One entry per review round, newest first.
Verdict per branch: **GREEN** = can be merged, **YELLOW** = can be merged, fix items in the next group, **RED** = must be fixed before merging.

## 2026-11-25, update v3: `redesign-v2` after the A/B/C merges, client-van merged

Scope: `redesign-v2` at `9ec2529` (terminals merged B `3ca14ee`, A `ed9eb09`, C `9ec2529` themselves), then client-van `74d96a9` merged by the reviewer as `0eb2cde`.

Checks (admin, client, driver, at `9ec2529` and again at `0eb2cde`): typecheck, build with `VITE_DEMO_MODE=true` and `false`, and `check:no-network` in both modes all pass. The test panel is only in the demo bundles. No "demo" text in the UI.

### admin (A + B + C): YELLOW, fixes for terminal A

OK
- Routes: the contract's tails live under the existing `/operators` prefix, and `/op/*` redirects there (contract rule "keep the existing prefix"). No route is defined twice.
- Sidebar: no duplicate items. The operator gets Navbat, Qidiruv, Buyurtmalar, Haydovchilar, Yo'lovchilar and Tarix. The manager gets So'rovlar with a badge.
- Adapter: `ApiAdapter extends OpsAdapter, OpCardsApi`. No method name overlaps the base adapter or the other domain.
- Action buttons come from server lists: `allowedActions` on the order page, `actions` on the cards, SMS and notes, and `allowedActions` on requests. Money, counts and statuses come from the server. The manager's money confirm shows the server's old → new preview (`getManagerRequestPreview`) and then calls approve.
- The operator Buyurtmalar and Haydovchilar pages have no "Faqat ko'rish" banner. The operator drivers list shows no level, trips, balance, export or row menu. There is no level and no SOS in the operator screens. Phones are shown in full.
- "Orqaga": `PageHeader back` on DriverPage, OpDriver, OpPassenger, OpOrder, Ledger (opened from a driver), Orders (opened from a passenger) and an Audit entry. It is also on the Drawers and FormDrawers: order detail, passenger detail, ledger fix, tariff edit, staff add/edit, driver and order edit. No top-level sidebar page has it.
- Failed shell command in A's session: `pkill -f "vite --port 5237"` (and `"port 5238"` at the merge) matched the shell that was running it, which then exited with 144. Both times this happened after `git commit` had already finished. Commits `c46ac52` and `ed9eb09` are intact, both trees are clean, and no dev server is left running. It does not matter.

Fix (terminal A)
1. Two `opPath` objects: `admin/src/features/opCards/labels.ts:15` (hard-coded `/operators`) and `admin/src/features/ops/paths.ts:9` (`OP_BASE`). `DriversScreen.tsx:19` and the opCards screens use A's copy. Keep only `features/ops/paths.ts` (add the optional `tab` argument there).
2. Request types are defined twice: `OpRequestType`, `REQUEST_TYPE` and `REQUEST_STATUS` in `api/opCards/types.ts:183` and `features/opCards/labels.ts:72-88`, next to B's `ManagerRequestType` and `features/ops/requestLabels.ts`. A's list adds `sms_unlock`, but that is not a request type in doc 2.5: SMS unlock is the operator's own action. Use B's types. Remove `sms_unlock` from `opCardsMock.ts:326` and from the notes `requests.type` list in `docs/backend-gaps.md`.
3. The notes tab "So'rovlar" comes from its own random mock (`opCardsMock.ts:314 requestsFor`), not from B's request store (`mockOps.ts`, `op_requests_v1`). A request sent through "Menejerga so'rov" therefore never shows on the card. Read it from the mockOps store.

Nit
- The sidebar "Yo'lovchilar" item is gated by section `operators` (`Sidebar.tsx:50`), but its route checks `passengers_view`. Gate the item by `passengers_view`.
- The wallet bar colour thresholds (`driverTabs.tsx:156`, <20 / <50) are a UI colour only. They are fine unless the server sends a tone.

### client-van `74d96a9` (3 commits): GREEN, merged `0eb2cde`
- The seat layout per class (rows, ids, taken, `passengerSeats`, `wholeCarAvailable`) comes from `getSeatLayouts`. The minivan cabin is driver + 1, then 3, then 3. Switching class drops seats the new cabin lacks. "Butun mashina" follows the server flag, and the price is still the server quote.
- The new strings are in uz, ru and en.
- The "Holatni to'xtatish" test switch exists only in the test panel.
- The merge conflict in `docs/backend-gaps.md` was resolved by keeping both sections. The reviewer also removed the duplicate `passengers_view` paragraph from B's block, so it is described once in A's.
- The http fallback to `seat-map` (no minivan layout until the endpoint exists) is mock/http-gap only and is not flagged.

### Not checked
- The iOS simulator for the minivan map. Pixel comparison with `TripVan.dc.html`.

## 2026-11-22, round 8: admin `342e67e` and client `df8296f`, both GREEN, merged

### redesign-admin `1928d19..342e67e` (1 commit): GREEN
- Back in the stats section:
  - the "Qarz limitiga yetgan haydovchilar" tile (`driversOverLimit`);
  - the "Buyurtmalar dinamikasi" chart (orders and completed per day).
- No online metric (owner decision).
- Mock values come from the seed's `atDebtLimit` verdict, not a browser rule. Seed v7 adds sample drivers at the debt limit.

### redesign-client `1148788..df8296f` (1 commit): GREEN
Round 7 must-fix, both done:
- Tarix allows a tip whenever `tips.allowed` (`canTip`), at any age. The rating keeps its 7-day limit, and Rate disables the stars when the rating is locked.
- Bonus: a withdrawal under review is watched until it settles, even after the sheet closes. The balance and history are then read again. The button shows the pending review instead of allowing a second withdrawal.

Round 7 "later" items, all done:
- phone change: auto-fill is cancelled on close, and the code is confirmed once;
- accounts: error with retry;
- request guards on bonus history and the notification switches;
- mark-read failure reverts;
- Help: error with retry, and the rejected text;
- Tarix: the search keeps the chips;
- live order: "Asosiy sahifaga" goes back, the timer resets, the ride-along switch shows its real value;
- Rate can leave when there is nothing to send;
- the nits.

Checks after both merges (`--no-ff`, no conflicts):
- All three apps pass typecheck, the `VITE_DEMO_MODE=false` build and `check:no-network`. `dist` has no test panel or "demo" text.
- `cap sync` passes for the client.
- Client uz/ru/en have 671 keys each.

## 2026-11-22, round 7 merge: client `1148788` into `redesign-v2`

Owner decisions:
- The About "Veb-sayt" row may link to the bare `https://xasanow.uz` home page. `check-no-network.mjs` already accepts it. `DEPLOY.md` and `docs/native.md` now mention it.
- From now on the reviewer decides small things (links to our own site, wording, small UI details) and notes them here. Only big features, business rules and money go to the owner. Testing is local only for now.

Merged `redesign-client` at `1148788` as YELLOW, on the owner's request, `--no-ff`, with no conflicts.
- `docs/handoff-client.md` has nothing open.
- `docs/backend-gaps.md` index: the client line lists the redesign v2 groups.
- After the merge, all three apps pass typecheck, the `VITE_DEMO_MODE=false` build and `check:no-network`. `cap sync` passes for the client.
- Open for the client terminal (round 7 must fix): tipping from Tarix on trips older than 7 days, and the stale bonus balance after closing the withdraw sheet early.

## 2026-11-22, round 7: client `2aa8f8e..1148788` (rounds 4–5 fixes, groups 7–9, three small answers): YELLOW, not merged

Checks:
- Typecheck, `VITE_DEMO_MODE=false` build, `check:no-network` and `cap sync` pass.
- `dist` has no test panel or "demo" text. The only site URL is the bare origin.
- uz/ru/en have 666 keys each.

Screens (demo, 390×844): History, Bonus, Settings, Account and Help match their PNGs. History's status filter chips come from the old app.

Round 4 and round 5 items, all done:
- Delivery:
  - a cargo-rules failure shows an error with retry on the right step (`CargoFlow.tsx:392-397`);
  - "Kabinada hamroh" has a retry (`CargoTermsScreen.tsx:139-143`);
  - after an order, back skips the flow entries (`HomeScreen.tsx:113-141`);
  - swap and reorder are back (`CargoFlow.tsx:268-289`, `CargoScreen.tsx:61-80`).
- Live order:
  - cancel leaves no dead entry (`exitToHome`);
  - sheets close before Rate opens;
  - Rate re-sends only when something changed;
  - "Haydovchiga yozish" (`sms:`) and the saved cards with "Karta ulash" in O'zgartirish are back;
  - one cancel confirmation only.
- All round 5 "later" items are done: replace on X, auto-close, stale poll guard, tip min/max, share guard, fresh countdown, no redundant edit.
- The three small answers:
  - sample phones are clearly fake (`+998 90 000 00 0N`, mock and seed only);
  - the offer card stays on Rate;
  - a "Faol buyurtma" row on Home opens the live order.

Must fix
- Rule 2, `features/history/HistoryDetailScreen.tsx:172`: tipping from Tarix works only while the rating is editable (7 days). The old detail had the tip card on every completed trip with a driver. A trip older than 7 days with `tips.allowed` can no longer get a tip. Show the link when `canRate || tips.allowed`.
- `features/bonus/BonusScreen.tsx:150` (`closeWithdraw` clears `reviewId`): closing the sheet while the withdrawal is under review drops `onWithdrawApproved`. The mock has already written the withdrawal, but the balance and history stay old and "Yechib olish" stays on, so the user can withdraw again from the old balance. The old screen kept `reviewId`.

Owner call (closed: the home link is allowed, see the merge entry above)
- `features/settings/AboutScreen.tsx:47`: the "Veb-sayt" row links to the bare `https://xasanow.uz`.

Later
- `PhoneChangeSheet.tsx:39-42` (only when the mock returns a test code): the 600 ms auto-fill timer is never cleared, and it calls `verify`. If the sheet closes within that time, the phone still changes. If the user types the code in that time, it is confirmed twice.
- `AccountScreen.tsx:59`: if `getAccounts` fails, the other accounts disappear with no error. The old screen showed an error with retry. `:80` closing add/remove during review does not reload.
- `BonusScreen.tsx:119-133`: switching the history filter quickly can show "Kirim" entries under "Chiqim" (no request guard; old bug).
- `NotificationsSettingsScreen.tsx:33-45`: two quick switches overwrite each other. `NotificationsScreen.tsx:48`: `markNotificationRead` has no catch.
- `HelpScreen.tsx:39,42`: failed side loads vanish. `:114` shows "sent" for a rejected request.
- `HistoryScreen.tsx:304`: the status filter stays applied while its chips are hidden during search. A driver-name match is not visible.
- Live order:
  - the back stack grows when going back and forth between "Faol buyurtma" and the live order's back arrow;
  - `homeBase.ts` stores an index, which can point to a non-Home entry;
  - the ride-along switch can show off while `rideAlong` is still true;
  - `elapsed` is not reset after "Qayta qidirish";
  - Rate with an unchanged rating and no tip has only X to leave;
  - error/loading back pushes `/home`.
- Nits:
  - `bonus.source.goal.title` has a fixed "5 ta";
  - the clipboard fallback toast;
  - an orphaned comment in `MenuDrawer.tsx:12`;
  - `Field.tsx` prefix readOnly styling.

## 2026-11-22, owner answers on the client removals (round 5)

The client terminal gets these:
- Restore "Haydovchiga yozish" in the live order.
- Restore the saved-card list and "Karta ulash" under Karta in the live order's O'zgartirish.
- The second iOS confirmation on cancel is not needed and stays out.

Also committed: `docs/izgo-asosiy-hujjat.md` from the main chat (`7c0d0ff`). It covers the operator windows, the five results, postpone, and the marketolog's Marketing page. This closes admin handoff §2.

## 2026-11-22, round 6 merge: admin `1928d19` into `redesign-v2`

Owner decision:
- "Hozir onlayn haydovchilar" stays out, because drivers have no online status. The admin terminal read decision 5 correctly.
- Two items go to the admin terminal: the debt-limit drivers count (`driversOverLimit`) and the orders/completed over-time chart.

Merged `redesign-admin` at `1928d19` as YELLOW, `--no-ff`, with no conflicts.
- `docs/handoff-admin.md`:
  - §1 is marked DONE: the design doc line is in place, and the main doc has had it since v1.8;
  - §2 is main doc text, which stays with the main chat.
- `docs/backend-gaps.md` index: the admin line now lists the redesign v2 groups.
- After the merge, all three apps pass typecheck, the `VITE_DEMO_MODE=false` build and `check:no-network`.

## 2026-11-22, round 6: driver `0a2d568` merged; admin `1928d19` YELLOW (merged afterwards, see above)

### redesign-driver `750065f..0a2d568` (1 commit): GREEN, merged
- `HistoryCard.tsx`: a cancelled trip shows the server's earnings instead of a hard-coded 0.
- The unused key `caps.childSeatHint` is removed from uz/ru/en.
- Merged `--no-ff` with no conflicts.
- After the merge, all three apps pass typecheck, the `VITE_DEMO_MODE=false` build and `check:no-network`. `cap sync` passes for the driver.

### redesign-admin `c9b3236..1928d19` (merge of `redesign-v2` at `2cad494` and 1 commit): YELLOW
Checks: typecheck, `VITE_DEMO_MODE=false` build and `check:no-network` pass. `dist` has no test panel or "demo" text. Screens checked: Dashboard and Marketing (demo, superadmin).

Fixed from round 4:
- Stats: these come back from `getStats`:
  - order totals (all, completed, cancelled, expired);
  - passengers (total and new);
  - drivers (total, active, blocked);
  - the registrations chart.
  
  `StatsSection` handles errors: a failure shows "Qayta urinish", and a failed period change keeps the old figures with a StaleNotice. A request-order guard is in place.
- Operator queue: a sequence guard on the active task. "Boshlash" stays disabled until the active task has loaded. `CurrentTask` has `key`.
- Operators board: refreshes every 15 s (skipped while the tab is hidden), timers tick every second, the done column pages by 20, the date shows outside "today", and a custom date range is back.
- Marketing for superadmin, owner and menejer: a "Marketing" item in Asosiy. The marketolog still sees it as "Umumiy statistika".
- `docs/backend-gaps/admin.md`: no duplicate endpoints left, and the stale approve, reveal and old-tariff rows are gone.

To fix (rule 2; the online-drivers figure stays out by owner decision, see the merge entry above):
- Two figures from the old StatsScreen are still missing (`63575a8:admin/src/features/dashboard/StatsScreen.tsx:123,188`):
  - "Qarz limitiga yetgan haydovchilar" (`driversOverLimit`);
  - the orders/completed over-time chart.

Note: in the demo the "Ro'yxatdan o'tganlar" and "Daromad dinamikasi" charts show one point on 7-noy for the period "Bugun". This is mock data, not a finding.

## 2026-11-22, round 5: client `253cbd0..2aa8f8e` (live order and rating) and owner answers after round 4

Owner answers:
- Not for production now. A feature the server lacks may work only in mock. Reviewers no longer flag missing real-backend fallbacks or http-mode gaps.
- Reviewers still flag price or commission maths in screens, failing builds, secrets, broken flows and big unrequested features.
- Admin:
  - the new tariff model and ledger corrections work in mock only;
  - no old route-tariff editor;
  - Marketing is also for superadmin, owner and menejer. Add `marketing` to their sections; this item is now must-fix for the admin.
- The round 4 admin "owner calls" about tariffs and corrections are closed.

### redesign-client `253cbd0..2aa8f8e` (2 commits and a merge of `redesign-v2`): RED
Checks:
- Typecheck, `VITE_DEMO_MODE=false` build and `check:no-network` pass.
- `dist` has no test panel or "demo" text. The only site URL is the bare origin.
- uz/ru/en have 637 keys each. No imports of the deleted files remain.

Screens (demo build, 390×844, full order Toshkent → Samarqand):
- Search, Driver, OnTrip and Rate match `Search.png`, `Driver.png`, `OnTrip.png` and `Rate.png`.
- Search shows the route line instead of the design's radar with nearby cars. That is the drawn map, so not a finding.
- "Keyingi safar uchun taklif" on Rate is the old screen's suggestion, kept.
- The demo `localStorage` from an older build broke the quote ("Narx olinmadi" on every try). After clearing it, the flow works. This only affects demo data, so it is not a finding.

Must fix
- `features/live/LiveOrderScreen.tsx:113-115,227`: the cancel sheet pushes `?sheet=cancel`, and `confirmCancel` then replaces only that entry with `/home`. The history becomes `[track, home]`, so Android back on Home returns to the cancelled order. Pop the sheet entry before leaving.
- `LiveOrderScreen.tsx:123`: if the ride completes while SOS or edit is open, the replace to Rate swaps only the sheet entry. After rating, back goes to track, which sees "completed" and opens Rate again, a loop. Rate's stars are prefilled, so "Yuborish" re-sends the rating with `reasons: []` and overwrites the stored reasons. Close the sheet first, then redirect.
- Still open from round 4 (no cargo file changed in these commits):
  - cargo rules failure loop (`CargoFlow.tsx:141-142,365,420`);
  - "Kabinada hamroh" error without retry;
  - dead history entries after a delivery order (`HomeScreen.tsx:213`; the same pattern also leaves the order-flow entries under a passenger ride);
  - restore swap pickup/drop-off and reorder drop-offs in the delivery flow (owner decision).

Later
- `LiveOrderScreen.tsx:461,237,244`: the X on the cancelled and no-driver views pushes `/home`, which leaves the dead order under it. Use `replace`, as the panel buttons do.
- `LiveOrderScreen.tsx:185-193`: auto-close pops only one entry. With `edit:to` open it lands on an empty `?sheet=edit`.
- `LiveOrderScreen.tsx:118-127`: a late poll for the old order after "Qayta qidirish" can bring NoDriver back for about 1.5 s. A second tap then repeats the order twice. Ignore stale responses.
- `RateScreen.tsx:102,284`: the custom tip is not checked against `tips.min`/`max` before sending.
- `LiveOrderScreen.tsx:252`: double-tapping share calls `navigator.share` twice and shows an error toast.
- `LiveOrderScreen.tsx:34-41`: the countdown shows a stale value for the first second.
- `EditOrderScreen.tsx:141,166`: confirming the same time still sends `timing`. Save with no changes sends `{}` and says "saved".
- Rule 2, small removals (keep them out only if the owner agrees):
  - the "message driver" button, which only showed a "not available" toast;
  - the saved-card list and "Karta ulash" inside the live edit's payment;
  - the iOS second confirmation on cancel.

OK
- Rating and tip are each sent once: a retry skips the rating, and the button is disabled while sending.
- The cancel sheet closes when the trip starts. Edit sends only changed fields.
- NoDriver: changing the time, then "Qayta qidirish", passes the new timing.
- SOS is support plus share. Android back closes a sheet first.
- Phases (search, no driver, to pickup, arrived, trip, cancelled, completed → Rate) match the six PNGs.
- No money maths in screens. The countdown, minutes left and progress are display of the server's timestamps and kilometres.
- Emergency contacts are removed (screen, route, settings row, adapter, i18n), as decided.

## 2026-11-22, round 4 admin: redesign-admin `12b9ae3..c9b3236` (7 commits: round 3 fixes, groups 4 and 5): RED

Checks:
- Detached checkout: typecheck, `VITE_DEMO_MODE=false` build and `check:no-network` pass. `dist` has no test panel or "demo" text and no site URL.
- There is no approvals route. Two-person approval is gone everywhere: Save → `ChangeConfirmModal` → Confirm, with a double-send guard.
- The branch has not merged `redesign-v2` since `376a0a0`. Merge it (`1870b85` and later) before the next round.

Screens (demo build, 1440×900):
- Ledger, Operators and Tariffs match `Ledger.png`, `Operators.png` and `Tariffs.png`.
- Phones are shown in full. Cargo sizes are S–3XL.

Must fix
- `DashboardScreen.tsx:353-435` (`MoneyAndStatus`): the restored stats are incomplete.
  - Back: income, average order, total wallet balance, income over time, orders by status (list), income by route and by city.
  - Missing: completed/cancelled/expired order tiles, total passengers, total/blocked/online drivers, and the registrations chart.
  - With the real server this shows 2 tiles and 2 charts. `statsFromApi` (`httpMapper.ts:505-527`) does map online drivers and the completed/cancelled/expired counts, but no screen draws them.
- `DashboardScreen.tsx:56-59` and `MarketingScreen.tsx:51-60`: when `getStats` fails, "Daromad va buyurtmalar" just disappears. On a period change the old figures stay with no notice. Show an error with retry, and mark old figures as stale.
- `OperatorQueueView.tsx:42-48,67-78`:
  - `loadActive` has no request-order guard. A late `null` from the refresh after "finish" can overwrite the task that "Boshlash" just started. The card disappears and the next start fails with `ACTIVE_TASK_EXISTS`.
  - "Boshlash" is clickable before the active task has loaded (`:180`). The old QueueTab waited for it.
- Rule 2: `OperatorsBoard.tsx:42-45,188`: the supervisor board never refreshes, and the waiting time is computed once ("5 daq" forever). The old InProgressTab reloaded every 15 s with a ticking timer. The done column (`:173`) also lost the from/to date range and paging: "Hammasi" renders every entry.
- `docs/backend-gaps/admin.md`: duplicates and stale entries. One entry per endpoint.
  - Duplicates: ledger `kind`/`q`/`driver_id` (`:75`, `:127`, `:144-145`); Group 5 `:159`/`:70`, `:160`/`:69`, `:163`/`:77` and `:167`/`:77-79`.
  - Stale: `:75` `driver_id` on correction items, `:76` `GET /admin/v1/tariffs?q=&active=`, `:65` the `adminTariffsGet` fallback and the phone reveal, `:47` `wallet.correction.approve`, and the `:51` callback mapping.

Owner calls
- Tariffs in production: the new tariff model has no endpoint, so with the real server the Tariffs page shows only "not available yet" (`TariffsScreen.tsx:157-167`). The old screen edited the per-route tariffs on `/admin/v1/tariffs`, which exists. Either keep the old editor in http mode until the new endpoint exists, or accept that tariffs cannot be changed from the panel until then.
- Corrections in production: `POST /admin/v1/wallet/correction` returns `pending_approval`, and the creator cannot approve their own entry. With the approve step removed, no correction from the panel takes effect until the backend applies corrections on create. The UI says so and does not claim success (`LedgerScreen.tsx:193-203`). This is a backend task (`admin.md:134`).
- Marketing page for superadmin, owner and menejer: `ALL_SECTIONS` (`mockDb/db.ts:163`) has no `marketing`, so only the marketolog sees the funnel, commission chart and order types. The main doc says these roles see "hamma bo'lim va statistika".

Later
- Group 4:
  - `LedgerFixDialog.tsx:200-207`: the debt limit is no longer shown while typing a correction (rule 2).
  - `LedgerFixDialog.tsx:74`: a driver beyond the first 500 cannot be picked, and Save stays disabled with no reason.
  - `LedgerScreen.tsx:250`: the footer counts rows in the browser (max 500). Use the server's total, as in the design.
  - `LedgerScreen.tsx:61`: if the summary fails, the KPI tiles vanish.
  - Flags with nothing behind them in http: ledger summary, kind/q/period filters, `entry_id`, `note`/`driver_name` (`http.ts:552-567`, `httpMapper.ts:322-333`).
  - `AuditScreen.tsx:79-80,103`: old audit actions (`tariff.approve`, `wallet.correction.approve` and others) show as raw codes.
  - `NumberField.tsx:72-75` rounds 2500.5 to 2501 with no notice.
  - Developer wording in the UI: "Backend tasdiq bosqichini…" (`LedgerScreen.tsx:197`), "serverda hali yo'q… backend" (`TariffsScreen.tsx:163`).
  - `httpMapper.ts:179`: a missing `trips_count` becomes 0. Show "—".
  - `TariffsScreen.tsx:128-132`: if the cities request fails, the city filter is hidden with no notice.
  - The Dashboard period is no longer kept in the URL.
- Group 5:
  - `OperatorQueueView.tsx`: stats tiles vanish when they fail to load (`:49-55`); a failed refresh shows old data with no notice (`:101`); one shared `actionError` (`:198`); `CurrentTask` has no `key={task.id}` (`:106`).
  - `OperatorsBoard.tsx:211`: done cards show only the time, so with 7 or 30 days different days look the same.
  - The read-only orders and drivers windows lack the design's "faqat ko'ra olasiz" banner. Tarix opens on "Mening vazifalarim" (the design opens on "Buyurtmalar").
  - `http.ts:384`: `getStaffCounts` sends no `status`.
  - "Filtrlarni tozalash" is gone from Staff, Audit and Tarix.
  - Mock checks: `rejectQueueItem` and `finishTask` do not check the status or assignee; `getOperatorCounts` defaults to today; `avgHandleSec` counts from `waitingSinceAt`.
  - Raw `rgba` shadows (`OperatorsBoard.tsx:180`, `tariffParts.tsx:73`).

OK
- `DriverHistory` uses the server's `counts`, with StaleNotice.
- The "Safarlar" column is back and "Onlayn" stays out. There is one code-length fallback. The passenger id is shown in full.
- Operator results are exactly the five decided ones, with a reason required for "Rad etish". "Keyinga qoldirish" keeps the waiting time.
- Roles come from `me.sections`/`actions`. An operator sees only their own history, and the drivers list has no balance.
- Editing the result and comment in Tarix follows main doc §2.5 ("Natija va izohni tahrirlash mumkin").
- Staff: phone is required for every role, email for every role except operator. Pickable roles come from `creatableRoles`, and server errors are shown.
- No browser maths: tariff examples, balances and stats all come from the server. Sample numbers are only in mock and seed.
- The legacy cleanup leaves no imports behind. Complaints stays. No big new feature beyond the design.

## 2026-11-22, round 4 merge: driver into `redesign-v2`

Owner decision after round 4: the client restores both delivery features, swapping pickup and drop-off and reordering the drop-offs.

Merged `redesign-driver` at `750065f`, `--no-ff`, with no conflicts. Two commits came after the review (`8101dba`, `750065f`):
- the Home route line no longer blocks the offers (`FeedPage.directions` may be `null`), which fixes the round 4 "later" item;
- one city pair served both ways shows as "A ⇄ B".

Both were reviewed before the merge.
- Handoff: `docs/handoff-driver.md` has nothing open.
- `docs/backend-gaps.md` index: the driver line now lists the work flow, wallet and profile sections.
- After the merge, on `redesign-v2`: `npm ci` (driver), typecheck, `VITE_DEMO_MODE=false` build and `check:no-network` for all three apps, `cap sync` for the driver.

## 2026-11-22, round 4 (client and driver after the owner answers; admin later)

Checks: clean detached checkouts, `tsc -b --noEmit`, `VITE_DEMO_MODE=false npm run build`, `check:no-network`, grep of `dist`, `npx cap sync`. All pass for both. `dist` has no test panel or "demo" text. The only site URL in `dist` is the bare `https://xasanow.uz`. Neither app tracks `.env` any more. Both keep `SITE_URL` with its default in `src/config.ts`.
Also committed this round: `docs/izgo-asosiy-hujjat.md` with the owner's two journal rows (`417ec38`).

### redesign-client `c73e9d8..253cbd0` (6 commits): RED
Round 3 must-fix and restores, all done:
- MapPick: the address is cleared when the pin moves, when geocoding fails and when locating fails. "Bu joy" is disabled while there is no address (`MapPick.tsx:99,111,132,218`).
- Restored: the pickup ETA bubble (`capabilities.pickupEta`), the ETA and Tafsilotlar summary on saved places, and the version line in the menu.
- `SITE_URL` default in `config.ts:20`. `client/.env` is untracked, and `.env.example` and the handoff are updated.

New: the delivery flow in design v2 (`features/cargo/*`, four steps).
- It matches `Cargo.png`, `CargoContacts.png` and `CargoTerms.png` (demo build, 390×844).
- Body sizes are exactly S–3XL. Labels, specs and prices come from the server. The insurance fee exists only in `mock.ts`.
- uz/ru/en have 666 keys each.
- The deleted OrderSheet, class picker, wishes and the rest have no imports left.
- 60c5465 "sheets in the URL" is navigation plumbing (back closes the sheet, then goes to the previous step), not a new feature.

Must fix
- `CargoFlow.tsx:141-142,365,420`: when `getCargoRules` fails, nothing reports it and nothing retries.
  - On the "terms" step `step === "terms" && rules` is false, so the Yuk screen renders with step 3 lit.
  - Its "Davom etish" goes to Kontakt, and Kontakt leads back to the same screen. Payment is never reached.
  - Show an error with retry (`rulesQ.refetch`), as the old sheet did (`common.loadFailedRetry`).
- `CargoFlow.tsx:162-166`, `CargoTermsScreen.tsx:139`: when `getRideAlong` fails, "Kabinada hamroh" is just disabled with its normal caption, so it looks unavailable. Show the error with retry (the old `RideAlongRow` had `onRetry`).
- `HomeScreen.tsx:213`: after a delivery order only the payment entry is replaced. The flow, contacts and terms entries stay in history and all render Home, so Android back from tracking needs 3 extra presses that do nothing. Go back to the base entry before navigating to tracking.
- Rule 2, silent removals in the delivery flow (the old OrderSheet had them, c73e9d8 `OrderSheet.tsx:440,472`). Restore them, or the owner signs off:
  - swapping pickup and drop-off;
  - reordering the drop-offs.

Later
- `CargoFlow.tsx:313-317`: a network error in the contacts check shows under the receiver's name field.
- `CargoFlow.tsx:148`: if the profile does not load, the sender shows "—" with no retry.
- The contact name fields lost `maxLength` (`rules.riderNameMaxLength`).
- `CargoSheets.tsx:53`: an empty warehouse list shows an empty sheet.
- `CargoFlow.tsx:52`: `decodeSheet` does not check the `info:` topic.
- `HomeScreen.tsx:212`: `window.open` after `await` is blocked in mobile Safari (web build only; it matters once the server sends `payment.redirect_url`).
- `MenuDrawer.tsx:12`: `APP_VERSION = "1.1.0"` is hard-coded. Inject it at build time.
- `cargo.v2.insuranceDesc` ("Shartlari va narxi serverdan") is placeholder text from the PNG. Real text from the owner.
- `docs/backend-gaps/client.md:80` still says recent routes are used by "no screen". The insurance entry has four endpoint changes in one bullet; use one entry per endpoint.
- Unused key `class.title`. `httpMapper.ts:244` doc comment sits on the wrong function. Raw `border-white` in `HomeView.tsx:29`.
- The recent route still ignores `fromCityId` (round 3).
- The sender's own phone shows masked on Kontaktlar.

### redesign-driver `f82d972..19dbf19` (4 commits): GREEN
Round 3 must-fix, all done:
- `FinishedScreen.tsx:40`: cash only from the server's `cashToCollect`.
- `HomeScreen.tsx:209`: `AcceptedError` with retry when `getAccepted` fails and nothing is cached.
- `/delete-account` link kept (owner allowed it).
- Calls: `httpMapper.ts` `tripPassenger` reads `passenger { name, rating, call_number }` once the server sends it. Until then there is no call button. This is documented in `docs/backend-gaps/driver.md`. The old "number hidden" toast never dialled anyone either.

Restored (rule 2):
- Wallet: balance after each entry, the today card (earnings, trips, average, all from the server), the saved-cards line, and the debt amount with its limit.
- Home: the map card (`HomeMap.tsx`; drawn map without a token).
- Request: seat positions (`seat_ids`) on the card and the detail.
- Finished: the rating received.

Round 3 "later" items fixed:
- no false "request gone" while accepting;
- "after commission" only when the server sends a commission;
- `TripScreen` polls `getAccepted` every 20 s instead of 8 s;
- "Mening yo'nalishim" in http mode reads `GET /drivers/me/routes`;
- request-sound switch only with `capabilities.requestAlerts`;
- handoff shortened ("nothing open").

Screens (demo build, 390×844): Home, Wallet and Request match `Home.png`, `Wallet.png` and `Request.png`, plus the restored blocks. The map card on Home pushes the requests list down by one card height.

Later
- `http.ts` `feedDirections`: if the first `GET /drivers/me/routes` fails, `getFeed` fails too, so offers do not show until a retry. Fall back to `[]` for the route line instead.
- Unused key `caps.childSeatHint` (uz/ru/en).

## 2026-11-22, owner answers after round 3 (what each terminal does now)

New owner rule: no big new features, screens or flows that are neither in the design nor in the current app. Reviewers flag them. Small undesigned details and page transition animations are allowed.

Answers:
1. `/delete-account` is allowed. Links to `https://xasanow.uz` may use only `/terms`, `/privacy` and `/delete-account`.
2. Admin: the old stats come back, in the new style, as extra sections on Dashboard.
3. The `VITE_SITE_URL` default moves into code, and the `.env` files leave git.
4. Admin stays Uzbek only (no i18n needed).
5. Everything listed in round 3 under "silent removals" comes back, except the admin "Onlayn" column.

Shared changes by the reviewer (on `redesign-v2`, merge it into your branch):
- `check-no-network.mjs`: the build scan also accepts `/delete-account`. The source scan accepts the bare origin `https://xasanow.uz` in one file only: `<app>/src/config.ts`. The origin must be followed by a quote or similar, so no path, port or subdomain. Paths are added at runtime.
- `.gitignore` ignores `.env`. `DEPLOY.md` and `docs/native.md` describe the default in code.

Client terminal
- `src/config.ts`: `export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "https://xasanow.uz").replace(/\/+$/, "")`. Same behaviour as now, with an empty value turning the links off. `git rm client/.env`, and update `.env.example` and `docs/handoff-client.md`.
- Fix MapPick (round 3, must fix).
- Restore the pickup ETA bubble, ETA and the Tafsilotlar summary on saved places, and the version line in the menu.

Driver terminal
- `src/config.ts` default as above. `git rm driver/.env`, update `.env.example` and `docs/handoff-driver.md` (§1: shorten, it is done).
- Fix FinishedScreen cash, the AcceptedTrips error state, and the call button fallback in http mode (round 3, must fix).
- Restore in Wallet the balance after each entry, the today card, the card list and the debt amount. Restore the Home map, the seat positions before accepting, and the driver's rating on Finished.

Admin terminal
- Old stats as extra Dashboard sections, in the new style:
  - KPIs: income, average order, total wallet balance, completed/cancelled/expired orders, total passengers, total/blocked/online drivers;
  - charts: income over time, registrations, orders by status, income by route.
  
  Data from `getStats` as before, nothing computed in the browser.
- Fix `DriverHistory.tsx:132` (server `counts`).
- Restore the "Safarlar" column in the drivers list. The "Onlayn" column stays out.
- Strings stay Uzbek only.

## 2026-11-22, round 3 (client groups 3–4, driver groups 3–5, admin groups 2–3)

Heads: client `332481e`, driver `d43dafa`, admin `12b9ae3`. All three merged `redesign-v2` (round 2) first.
Checks: clean detached checkouts, `npm run typecheck`, `VITE_DEMO_MODE=false npm run build`, `check:no-network`, grep of `dist`, `npx cap sync` (client, driver; driver from its own `npm ci` because of the new `@capacitor/app`). All pass. `dist` has no test panel text and no mock marker. The `••••` hits are card numbers (last 4 digits), not phones. Driver native files for `@capacitor/app` are committed (`cap sync` leaves the tree clean).
Screens (demo build, headless Chrome): admin Dashboard and Drivers match `design-v2/admin/png/Dashboard.png` and `Drivers.png`. Phones are shown in full (the design PNG still masks them; the 2026-11-22 decision wins). Driver Wallet and Capabilities match `Wallet.png` and `Capabilities.png`: only S–3XL and loader help, no wishes. Client Home was not compared: the demo login waits for a review step in the test panel.
Also committed this round: `docs/izgo-asosiy-hujjat.md` v1.8 from the owner (`9d9371d`).

Owner questions (apply to more than one app)
- `client/.env` and `driver/.env` are now tracked. They hold only `VITE_SITE_URL=https://xasanow.uz` (public, no secret). The rules say no `.env` files. Either accept them, or move the value to `.env.production` and `.env.development` (both already tracked).
- Admin has no i18n: all strings are hard-coded Uzbek, as before the redesign (main doc §1 marks admin languages `[OCHIQ]`). Uzbek only, or uz/ru/en?

### redesign-client `30c2352..332481e` (4 commits): RED
Must fix
- `client/src/features/address/MapPick.tsx:87,171,198`: when `reverseGeocode` fails, the previous address stays in the title and "Bu joy" stays enabled, so the passenger confirms a place that is not under the pin. On error, clear `address` (or disable the button).
- Rule 2, silent removals. Restore them, or the owner signs off:
  - the pickup ETA bubble (`capabilities.pickupEta`, `getPickupEta`; no caller left, `client/src/features/home/HomeView.tsx:9-15`);
  - the ETA and the Tafsilotlar summary on saved places (`HomeView.tsx:117-143`);
  - the app version line in the side menu (`drawer.version` was deleted in uz/ru/en).

Later
- `HomeView.tsx:35,201-205`: in http mode a new user has no pickup and saved points carry `cityId: ""`, so the city pill and the Qayerdan field are hidden.
- `AddressFlow.tsx:49,83`: details typed on MapPick stay on the point after the pin moves.
- `MenuDrawer.tsx:39,86`: if `getBonusSummary` fails, the balance shows "…" forever.
- `HomeScreen.tsx:321`: a recent route ignores its `fromCityId`. `HomeView.tsx:270` splits the server's `label` text to get the city.
- `HomeScreen.tsx:89`: `getRecentRoutes` has no capability flag, so a network error also hides the section.
- Unused import `detailsSummary` (`HomeScreen.tsx:18`).
- Raw `text-white` and `bg-white` instead of tokens (`AddressSearch.tsx`, `MapPick.tsx`, `HomeView.tsx`).

OK: no prices, ETAs or sample numbers outside `mock.ts`. 54 new keys in uz/ru/en. No "demo" text. Saved-place `kind` and recent routes are documented in `docs/backend-gaps/client.md`. Changes stay in `client/` and the client docs.

### redesign-driver `673057d..d43dafa` (8 commits): RED
Must fix
- `driver/src/features/trip/FinishedScreen.tsx:39`: `cash = s?.cashToCollect ?? (payment === "cash" ? gross : undefined)`. That is a business assumption, wrong with promos or discounts. Show cash only when the server sends `cashToCollect`.
- `driver/src/features/home/HomeScreen.tsx:381` (`AcceptedTrips`): if `getAccepted` fails, nothing is shown. The old tab had an `ErrorState` with retry, so an accepted trip can vanish without a word.
- `driver/src/features/profile/SettingsScreen.tsx:161`: opens `${SITE_URL}/delete-account`. Owner decision: the apps link only to `/terms` and `/privacy`. Owner call: Google Play needs a deletion page, and the site has one (journal 2026-11-20). If the owner allows it, the decision and `check-no-network.mjs` (comment and `LEGAL_LINK_PATH`) get `/delete-account`. If not, drop the link until `DELETE /api/v1/drivers/me` exists.
- Rule 2, silent removals. Restore them, or the owner signs off:
  - Wallet: the "balance after" line per entry (the server sends it, `httpMapper.ts:460`), the today card (earnings, trips, average), the card list and the debt amount;
  - Home: the map and the seat positions before accepting;
  - Finished: the rating the driver received.
- Calls: http mode has no call button, because `callNumber` is never set by `httpMapper` (`trip/parts.tsx:105`). The old masked-call toast is gone. Documented in backend gaps (`call_number`), but the screen needs a fallback, or the owner accepts it.

Later
- `RequestScreen.tsx:38-43`: a poll during accept can show a false "request gone" toast. TripScreen already guards this.
- `RequestScreen.tsx:196,297`: the headline says "after commission" using `earnings.net`, but http sets net = price when the server sends no commission (`httpMapper.ts:221`).
- `HomeScreen.tsx:229`: in http mode `directions` is always `[]`, so "Yo'nalish tanlanmagan" always shows.
- `SettingsScreen.tsx:79-83`: the request-sound switch shows in http mode, where `requestAlerts` is off.
- `TripScreen.tsx:32-33`: http `getBooking` calls `getAccepted`, plus the 8 s poll, so GET /trips runs twice every 4–8 s.
- `RequestScreen.tsx:184` hex `#24364D`. Unused `caps.childSeat`, `option.*`, `childAge.*` keys.
- `docs/handoff-driver.md` §1 says DONE, but its second paragraph still says the check fails. Shorten it.

OK
- Round 2 fixes done: legal links come from `VITE_SITE_URL` (`registration/parts.tsx:387`, `SettingsScreen.tsx:94-95`); `getLegalLinks` and `/api/v1/legal` are removed; `getTopupOptions` (`http.ts:774`) asks the server and shows no presets or limits without one; the colour nits are fixed.
- Wishes, wheelchair and text-only options are removed (owner decision). Imkoniyatlarim keeps S–3XL and loader help only, hidden in http mode.
- Timers run from server times. No price, commission or waiting maths in components. i18n uz/ru/en 943 keys each, no gaps. Navigation links (`geo:`, `maps:` and others) are only opened, never fetched. The Android back button is handled through sheets and the router.

### redesign-admin `63575a8..12b9ae3` (4 commits): RED (YELLOW if the owner accepts the stats removal)
Must fix
- Rule 2: `admin/src/features/dashboard/StatsScreen.tsx` is deleted and `getStats` has no caller left. The new Dashboard drops these, and nothing records it:
  - KPIs: income, average order, total wallet balance, completed/cancelled/expired orders, total passengers, total/blocked/online drivers;
  - charts: income over time, registrations, orders by status, income by route.
  
  Bring them back (for example for the marketolog role), or the owner signs off.
- `admin/src/features/drivers/DriverHistory.tsx:132`: `{data.rows.length} ta safar` counts in the browser. Use the server's `data.counts`.

Later
- Group 4, unchanged by this diff: the two-person approval flow is still there (`approveAdjustment` `adapterTypes.ts:163`, `approveTariffProposal` `:172`, `tariff_second_approve` / `wallet_adjust_second_approve`, `pending_change` in `httpMapper.ts:454,471`, text in `WalletScreen.tsx:252`, `TariffsScreen.tsx:245`).
- Login code length: `http.ts:296,315` falls back to 4, `LoginScreen.tsx:38-39,57-58` to 6. Take it from the server; until then, use one fallback.
- `httpMapper.ts:648` fills missing days with 0 (contradicts the dashboard comment).
- `DashboardScreen.tsx:78`, `DriverHistory.tsx:50`: a failed refetch keeps old data with no notice. Use `StaleNotice` as `OrdersScreen` does.
- `OrderDetailPanel.tsx:235` cuts the passenger ID to 8 characters. In http mode it is the only passenger reference; show it in full or make it copyable.
- The drivers list lost the "Onlayn" and "Safarlar" columns (trips are now on the profile). Owner OK?
- `AuthAside.tsx:23-53` hex in the SVG. `http.ts:313` indentation.

OK
- Phones are shown in full everywhere (`formatPhone`). No masking or reveal is left. `maskedDestination` and the stale comment are fixed.
- S–3XL only, and `vehicle_type` is never shown. Chip counters come from the server (`ListCounts`, behind flags). "Qarz chegarasi" now uses the server's `atDebtLimit` (before, the browser computed it).
- New adapter methods are behind capability flags. No approvals route. "Shikoyatlar" stays. The login flow is right: email + code then phone + SMS, operator phone + SMS only.
- Earlier colour nits are fixed (`green-hover`, `row-hover` tokens). Group 3 endpoints are in `docs/backend-gaps/admin.md`.

## 2026-11-22, round 2 (client group 2, driver group 2, admin phone decision)

Owner decisions this round: keep "Shikoyatlar" in admin; admin shows phone numbers in full for every role (no masking, no reveal); legal links may point to `https://xasanow.uz` (terms and privacy only).
Same checks as round 1, plus `check:no-network` in http mode and a client build with `VITE_SITE_URL=https://xasanow.uz`.
Screens: client `Main` matches `design-v2/client/png/Main.png`; the legal names show without links because the build has no `VITE_SITE_URL`, which is expected.

**Merged into `redesign-v2`** (no fast-forward): client `30c2352` (`426d1b1`), driver `673057d` (`3b39fc4`), admin `63575a8` (`c2316de`). Later commits on the branches (client `cdf1bfa`, driver `e20a808`) were not reviewed and are not merged. Merged tree: `npm ci`, typecheck, `VITE_DEMO_MODE=false` build, `check:no-network` pass for all three apps; `cap sync` (client, driver) leaves `git status` clean.

### Shared changes applied by the reviewer (`ecb8449`)
- `shared/scripts/check-no-network.mjs`: the build scan accepts `https://xasanow.uz` only as a plain link, either the bare origin or followed by `/terms` or `/privacy`. Tested: `api.xasanow.uz`, `http://`, `wss://`, ports, look-alike hosts and `/delete-account` are rejected. The source scan is unchanged, and the origin never enters `connect-src`. The path rule only covers full URLs. When the app appends the path at runtime, reviewers check that it appends only `/terms` or `/privacy`. Today that is true for client `PhoneScreen.tsx:169-170`.
- `DEPLOY.md`, `docs/native.md`: `VITE_SITE_URL=https://xasanow.uz`.
- Full phones in admin: `docs/izgo-dizayn-v2.md`, `design-v2/PROMPTS.md`, `docs/backend-gaps.md` (index item and security note 4).
- **Not applied:** `docs/izgo-asosiy-hujjat.md` is read-only (owned by the main chat). The owner must apply handoff-admin §1 there: §2.5 operator line, F-07 "telefon maskalash", and a journal row. One more line contradicts the decision and needs an owner call: §10 F-22 "adminda maskalash" (receiver phone, intercom code).

### redesign-client `af6b0cc..30c2352` (2 commits): GREEN
- typecheck, build, `check:no-network` (http, empty API, and with the site URL) pass. `dist` is clean.
- Login, OTP and language screens use i18n keys in uz/ru/en. The code length comes from the server, or from the adapter until the server sends one, and is not hard-coded. Onboarding was removed; it had no inputs.
- `@capacitor/status-bar` added. Its generated native files are committed.
- Still open from round 1: `client/src/ui/States.tsx:138,147` hard-coded colours (nit). Old cargo names and old colours are planned for groups 5 and 6.
- New: `client/.env.example` says the network check does not allow the site host yet. That is no longer true; update the comment.

### redesign-driver `4922a11..673057d` (2 commits): GREEN
- typecheck, build, `check:no-network` pass. `dist` is clean. The test panel link on sign-in is behind `DEMO_MODE` (`SignIn.tsx:171`).
- Rule 2 OK: registration still sends name, city, birth date, car model, colour, plate, year, class, seats, documents and terms. It adds licence data, brand and service types. Gaps are documented in `docs/backend-gaps/driver.md` ("Redesign v2").
- Car brand list `httpMapper.ts:69` (Chevrolet … Damas, Labo) is the driver's own car, not cargo bodies. OK.
- Fix: legal links. The owner chose option B, so use `VITE_SITE_URL` + `/terms`, `/privacy` like the client. Drop `getLegalLinks` and the `GET /api/v1/legal` row in `docs/backend-gaps/driver.md`.
- Group 4: `driver/src/api/adapters/http.ts:738` `getTopupOptions` hard-codes presets and min/max (pre-existing). Take them from the server, or list the endpoint in backend gaps.
- Round 1 nits fixed.
- Not compared: the sign-in and registration screens. The sample data starts signed in, so no driver screenshot was taken.

### redesign-admin `c0cc33e..63575a8` (1 commit): GREEN
- typecheck, build, `check:no-network` pass. `MaskedPhone` and the reveal flow are removed. Phones are shown in full, formatted `+998 90 123 45 67`. No masking is left in `admin/src` (grep for `mask|phone_masked|•|reveal`). The only hits are the field name below and a stale comment.
- Nits: `maskedDestination` (`admin/src/api/types.ts:276,295`) now carries a full phone; rename it. Stale "phone reveal" comment at `admin/src/api/adapters/http.ts:175`.
- Carried over to group 4 (unchanged, already on `redesign-v2`): the two-person approval flow (see round 1). `docs/backend-gaps/admin.md` still asks for `Tariff.pending_change.values` "so the second approver can see"; drop it in group 4.
- Round 1 hover-colour nits still open (`Button.tsx:28,33`, `DataTable.tsx:161`).

## 2026-11-22, round 1 (group 1: tokens and base components)

Checks: rules scan of the diff, `npm run typecheck`, `VITE_DEMO_MODE=false npm run build`, grep of `dist`, `npx cap sync` (client, driver), headless screenshots of the kit galleries against `design-v2/*/png/State*.png`.
Each was built from a clean detached checkout at the branch head, not the terminal's own working tree.

### redesign-client `cdc64dc..af6b0cc` (2 commits): GREEN

OK
- typecheck and build pass; `dist` has no "Sinov paneli", no gallery (`/dev/ui` exists only under `import.meta.env.DEV`), no `mockAdapter` marker, no `pk.` token.
- Fonts bundled locally (Plus Jakarta Sans + Manrope for Cyrillic), no Google Fonts request.
- New strings in uz/ru/en (`state.*`). No business logic, no sample prices.
- `@capacitor/keyboard` 8.0.6 added; generated `capacitor.settings.gradle`, `capacitor.build.gradle`, `Package.swift` committed; `cap sync` passes. `appId` and versions unchanged.
- State screens (error / offline) match `StateError.png` / `StateOffline.png` in copy and structure.

To fix in a later group (not blocking)
- `client/src/lib/i18n/{uz,ru,en}.ts:155-160` still have `cargo.vehicle.spark/damas/labo/isuzu/fura`; they reach the bundle. Remove in group 6 (Cargo, S–3XL).
- `client/src/features/order/ClassCarArt.tsx:6-8`, `client/src/features/order/VehicleIllustration.tsx:53-54`: old blue/yellow `#264A9F` / `#F6BF0E`. Group 5.
- `client/src/ui/States.tsx:137,146`: hard-coded `#0b1524` / `#9fb0c3`; use the tokens (nit).
- Pre-existing: `about.contactPlaceholder` = `support@izgo.example` is in the bundle. Group 9.

### redesign-driver `cdc64dc..4922a11` (2 commits): GREEN

OK
- typecheck and build pass; `dist` clean (test panel and `/sinov/ui` gallery only behind `DEMO_MODE`).
- Fonts bundled locally; new strings in uz/ru/en; `cap sync` passes, no native changes.
- Commission % and wallet values are rendered from data (`l.commissionPct`, `w.commission.*`), nothing calculated.
- Floating Ink tab bar Asosiy / Hamyon / Tarix / Profil, offline banner, states: match the design.
- Default theme changed from night to light (design v2: light map and white sheets). Intended.

To fix (nit)
- Hard-coded colours instead of tokens: `driver/src/components/OfflineBanner.tsx:20` (`#3A2410`), `driver/src/features/wallet/WalletScreen.tsx:91` (`#F97066`), `driver/src/components/Switch.tsx:28`.

### redesign-admin `cdc64dc..c0cc33e` (2 commits): YELLOW

OK
- typecheck and build pass; `dist` has no test panel text.
- Fonts bundled locally. Sidebar groups Asosiy / Pul / Jamoa; no "Tasdiqlar" route or menu item.
- `ChangeConfirmModal` (old → new, Bekor qilish / Tasdiqlash, audit note) matches the 2-step decision.
- `MaskedPhone` never masks on the client; the reveal asks the server. (Superseded in round 2: admin shows full phones.)
- Header search: `ApiAdapter.globalSearch` with mock + http, hidden by `capabilities.globalSearch=false`, documented.

Must be done in group 4 (Money)
- The two-person approval flow is still in the adapter and screens: `admin/src/api/adapterTypes.ts:136,145` (`approveAdjustment`, `approveTariffProposal`), `admin/src/api/adapters/http.ts:527-581`, `admin/src/api/adapters/mock.ts:386-411,1001,1127` (`tariff_second_approve`, `wallet_adjust_second_approve`), `admin/src/features/tariffs/TariffsScreen.tsx:180`, `admin/src/features/wallet/WalletScreen.tsx:122`. Replace with Save → `ChangeConfirmModal` → Confirm (one request).

To fix in a later group
- Old colours: `admin/src/components/MapView.tsx:27,30`, `admin/src/features/dashboard/StatsScreen.tsx:25-26`. Group 3.
- Hover colours hard-coded: `admin/src/components/Button.tsx:28,33`, `admin/src/components/DataTable.tsx:161` (nit).

Process notes
- Admin wrote its backend gaps to `docs/backend-gaps/admin.md` (section "Redesign v2"), not to `docs/backend-gaps.md`. That file is the existing per-app detail file, so this is the better place. Client and driver should do the same (`docs/backend-gaps/<app>.md`, section `## Redesign v2`); the reviewer keeps the index in `docs/backend-gaps.md`.
- Open question for the owner: "Shikoyatlar" (complaints) is in the sidebar but not among the 20 design pages. Kept for now (rule 2: nothing disappears).

### Not checked this round
- Real device / simulator keyboard behaviour (client `@capacitor/keyboard`).
- Pixel comparison of full screens: group 1 has no full screens yet, only the kit galleries.
