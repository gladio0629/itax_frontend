# Update v3 (2026-11-24): operator rights, manager requests, back buttons, miniven seats

Driver app: no changes.

## 0. Setup (once, in a normal terminal)

```bash
cd /home/gladio/p/project_hat/onlyfront
git checkout redesign-v2
git status                       # must be clean
unzip -o ~/Downloads/izgo-update-v3.zip -d .
git add design-v2 docs
git commit -m "Design update v3: operator screens, manager requests, miniven seats"

git worktree add ../of-ops-cards  -b admin-ops-cards
git worktree add ../of-ops-orders -b admin-ops-orders
git worktree add ../of-admin-back -b admin-back
git worktree add ../of-client-van -b client-van

for w in of-ops-cards of-ops-orders of-admin-back; do
  cp admin/.env.local ../$w/admin/ 2>/dev/null
  (cd ../$w/admin && npm install)
done
cp client/.env.local ../of-client-van/client/ 2>/dev/null
(cd ../of-client-van/client && npm install)
```

Open 5 terminals, run `claude` in each:

| Terminal | Folder | Prompt |
|---|---|---|
| A Operator cards | `../of-ops-cards` | section A |
| B Operator orders + requests | `../of-ops-orders` | section B |
| C Admin back buttons | `../of-admin-back` | section C |
| D Client miniven | `../of-client-van` | section D |
| R Reviewer | `onlyfront` (branch `redesign-v2`) | section R |

---

## Common block (for reference; already inside A, B, C, D)

```
Rules for this task:
- Read first: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md (section 2.5, especially "Operator huquqlari (2026-11-24)"), docs/izgo-dizayn-v2.md.
- Do not send me a plan and do not wait for my OK. Start right away.
- Decide small things yourself: transitions, animations, spacing, empty/loading/error states, component split, naming, mock data. Do not ask me about them.
- Do not add anything that is not in the design or the docs. No big refactors. Do not rewrite working code outside your scope.
- Ask me only if the design contradicts the docs on a business rule, or an existing input would disappear.
- No business logic in the frontend. Which action buttons appear (cancel, restart search, unlock SMS limit, resend code, etc.) comes from the server as a list of allowed actions; the mock returns it. Money, statuses, counts: from the server.
- New data: extend ApiAdapter, realistic data in mockAdapter, httpAdapter calls the endpoint you expect. Put new adapter methods in a new file per domain where possible, so other terminals' changes do not conflict. Describe every new endpoint in docs/backend-gaps.md under "## admin (operator, 2026-11-24)" (client: "## client (miniven, 2026-11-24)").
- Roles and visible sections from getMe(); the server is the real check.
- Phone numbers are shown in full everywhere in admin. No driver level and no SOS in operator screens.
- After each group: typecheck, build (also with VITE_DEMO_MODE=false), commit. Never commit failing code. Do not push.
- When finished: tell me in Uzbek, 3–5 short lines, what is done.
```

## Shared route contract (admin, A and B use it)

```
/op/queue                      OperatorView            (B)
/op/search                     OpSearch                (A)
/op/orders                     OperatorHistory         (B)
/op/orders/:id                 OpOrder / OpOrderCargo  (B), cancel modal OpCancel (B)
/op/drivers                    OperatorDrivers         (A)
/op/drivers/:id/:tab?          OpDriver + tabs         (A)  tabs: docs, wallet, trips, cancels, reviews, sms, notes
/op/passengers                 OpPassengers            (A)
/op/passengers/:id/:tab?       OpPassenger + tabs      (A)  tabs: orders, pay, bonus, sms, notes
/op/tasks                      OpMyTasks               (B)
/requests                      ManagerRequests + ManagerRequestConfirm modal (B), roles: manager, owner, superadmin
Query param ?request=<passenger|driver|order>:<id> on any operator page opens the "Menejerga so'rov" modal (OpRequest) (B).
If the app already has routes for the operator queue/history/drivers, keep the existing prefix and the same tails.
```

---

## A. Operator cards terminal

```
You work in admin/ on branch admin-ops-cards. Task: the operator's passenger and driver screens from design-v2/admin.

Rules for this task:
- Read first: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md (section 2.5, especially "Operator huquqlari (2026-11-24)"), docs/izgo-dizayn-v2.md.
- Do not send me a plan and do not wait for my OK. Start right away.
- Decide small things yourself: transitions, animations, spacing, empty/loading/error states, component split, naming, mock data. Do not ask me about them.
- Do not add anything that is not in the design or the docs. No big refactors. Do not rewrite working code outside your scope.
- Ask me only if the design contradicts the docs on a business rule, or an existing input would disappear.
- No business logic in the frontend. Which action buttons appear (cancel, restart search, unlock SMS limit, resend code, etc.) comes from the server as a list of allowed actions; the mock returns it. Money, statuses, counts: from the server.
- New data: extend ApiAdapter, realistic data in mockAdapter, httpAdapter calls the endpoint you expect. Put new adapter methods in a new file per domain where possible, so other terminals' changes do not conflict. Describe every new endpoint in docs/backend-gaps.md under "## admin (operator, 2026-11-24)" (client: "## client (miniven, 2026-11-24)").
- Roles and visible sections from getMe(); the server is the real check.
- Phone numbers are shown in full everywhere in admin. No driver level and no SOS in operator screens.
- After each group: typecheck, build (also with VITE_DEMO_MODE=false), commit. Never commit failing code. Do not push.
- When finished: tell me in Uzbek, 3–5 short lines, what is done.

Route contract (shared with the other admin terminal):
/op/queue                      OperatorView            (B)
/op/search                     OpSearch                (A)
/op/orders                     OperatorHistory         (B)
/op/orders/:id                 OpOrder / OpOrderCargo  (B), cancel modal OpCancel (B)
/op/drivers                    OperatorDrivers         (A)
/op/drivers/:id/:tab?          OpDriver + tabs         (A)  tabs: docs, wallet, trips, cancels, reviews, sms, notes
/op/passengers                 OpPassengers            (A)
/op/passengers/:id/:tab?       OpPassenger + tabs      (A)  tabs: orders, pay, bonus, sms, notes
/op/tasks                      OpMyTasks               (B)
/requests                      ManagerRequests + ManagerRequestConfirm modal (B), roles: manager, owner, superadmin
Query param ?request=<passenger|driver|order>:<id> on any operator page opens the "Menejerga so'rov" modal (OpRequest) (B).
If the app already has routes for the operator queue/history/drivers, keep the existing prefix and the same tails.

Screens (design-v2/admin/<Name>.dc.html is the spec):
1. OpSearch: one search field (phone, name, order ID, plate), results grouped: passengers, drivers, orders. Order results link to /op/orders/:id.
2. OpPassengers: list with status filters and pagination.
3. Passenger card: OpPassenger (Umumiy) + tabs OpPassengerOrders, OpPassengerPay, OpPassengerBonus, OpPassengerSms, OpPassengerNotes. Profile header with "Qo'ng'iroq" (tel: link) and "Menejerga so'rov" (sets ?request=passenger:<id>). SMS tab: "Limitni ochish" and "Kodni qayta yuborish" call the adapter, shown only if the server allows. Notes tab: add a note. Order rows link to /op/orders/:id.
4. OperatorDrivers: list (no "Faqat ko'rish" banner), row opens /op/drivers/:id.
5. Driver card: OpDriver (Umumiy) + tabs OpDriverDocs, OpDriverWallet, OpDriverTrips, OpDriverCancels, OpDriverReviews, OpDriverSms, OpDriverNotes. Read-only for money, documents and blocking. Same header buttons as the passenger card (?request=driver:<id>).

The "Menejerga so'rov" modal itself, the operator sidebar and the order pages are built by another terminal. You only set the query param and link to the routes. Breadcrumbs as in the design.
Order: 1–2, then 3, then 4–5. Commit after each.
```

## B. Operator orders and requests terminal

```
You work in admin/ on branch admin-ops-orders. Task: operator navigation, queue, orders and the "Menejerga so'rov" flow, plus the manager "So'rovlar" page, from design-v2/admin.

Rules for this task:
- Read first: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md (section 2.5, especially "Operator huquqlari (2026-11-24)"), docs/izgo-dizayn-v2.md.
- Do not send me a plan and do not wait for my OK. Start right away.
- Decide small things yourself: transitions, animations, spacing, empty/loading/error states, component split, naming, mock data. Do not ask me about them.
- Do not add anything that is not in the design or the docs. No big refactors. Do not rewrite working code outside your scope.
- Ask me only if the design contradicts the docs on a business rule, or an existing input would disappear.
- No business logic in the frontend. Which action buttons appear (cancel, restart search, unlock SMS limit, resend code, etc.) comes from the server as a list of allowed actions; the mock returns it. Money, statuses, counts: from the server.
- New data: extend ApiAdapter, realistic data in mockAdapter, httpAdapter calls the endpoint you expect. Put new adapter methods in a new file per domain where possible, so other terminals' changes do not conflict. Describe every new endpoint in docs/backend-gaps.md under "## admin (operator, 2026-11-24)" (client: "## client (miniven, 2026-11-24)").
- Roles and visible sections from getMe(); the server is the real check.
- Phone numbers are shown in full everywhere in admin. No driver level and no SOS in operator screens.
- After each group: typecheck, build (also with VITE_DEMO_MODE=false), commit. Never commit failing code. Do not push.
- When finished: tell me in Uzbek, 3–5 short lines, what is done.

Route contract (shared with the other admin terminal):
/op/queue                      OperatorView            (B)
/op/search                     OpSearch                (A)
/op/orders                     OperatorHistory         (B)
/op/orders/:id                 OpOrder / OpOrderCargo  (B), cancel modal OpCancel (B)
/op/drivers                    OperatorDrivers         (A)
/op/drivers/:id/:tab?          OpDriver + tabs         (A)  tabs: docs, wallet, trips, cancels, reviews, sms, notes
/op/passengers                 OpPassengers            (A)
/op/passengers/:id/:tab?       OpPassenger + tabs      (A)  tabs: orders, pay, bonus, sms, notes
/op/tasks                      OpMyTasks               (B)
/requests                      ManagerRequests + ManagerRequestConfirm modal (B), roles: manager, owner, superadmin
Query param ?request=<passenger|driver|order>:<id> on any operator page opens the "Menejerga so'rov" modal (OpRequest) (B).
If the app already has routes for the operator queue/history/drivers, keep the existing prefix and the same tails.

Screens (design-v2/admin/<Name>.dc.html is the spec):
1. Operator sidebar: Navbat, Qidiruv, Buyurtmalar, Haydovchilar, Yo'lovchilar, Tarix (pages of other terminals are linked by route). Manager sidebar: add "Marketing" (read-only) and "So'rovlar" with a pending count.
2. OperatorView (Navbat): update to the new design, full phone numbers.
3. OperatorHistory (Buyurtmalar): no "Faqat ko'rish" banner, row opens /op/orders/:id.
4. OpOrder and OpOrderCargo: status timeline, drivers notified, route and stops, last location, price lines and payments, cargo details. Actions: call passenger, call driver, "Qidiruvni qayta boshlash", "Bekor qilish", "Menejerga so'rov". Each action is shown only if the server allows it. Passenger and driver blocks link to /op/passengers/:id and /op/drivers/:id.
5. OpCancel: modal, reason is required, then the adapter call.
6. OpRequest: "Menejerga so'rov" modal opened by ?request=<type>:<id> from any operator page. Request types as in the design (refund, compensation, penalty cancel, ledger correction, block/unblock, phone change, cancel deletion request), amount where needed, reason required, linked order optional.
7. OpMyTasks (Tarix → Mening vazifalarim): my requests with status (Kutilmoqda / Tasdiqlandi / Rad etildi with the manager's reason) and resolved calls.
8. ManagerRequests and ManagerRequestConfirm: filters, "Tasdiqlash" / "Rad etish" (reason required). For money requests "Tasdiqlash" opens the old → new modal first, then confirm. The server applies the change and writes the audit log.

Order: 1–3, then 4–5, then 6–7, then 8. Commit after each.
```

## C. Admin back buttons terminal

```
You work in admin/ on branch admin-back. Task: a "← Orqaga" back button on every admin page that is reached from another page.

Rules for this task:
- Read first: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md (section 2.5, especially "Operator huquqlari (2026-11-24)"), docs/izgo-dizayn-v2.md.
- Do not send me a plan and do not wait for my OK. Start right away.
- Decide small things yourself: transitions, animations, spacing, empty/loading/error states, component split, naming, mock data. Do not ask me about them.
- Do not add anything that is not in the design or the docs. No big refactors. Do not rewrite working code outside your scope.
- Ask me only if the design contradicts the docs on a business rule, or an existing input would disappear.
- No business logic in the frontend. Which action buttons appear (cancel, restart search, unlock SMS limit, resend code, etc.) comes from the server as a list of allowed actions; the mock returns it. Money, statuses, counts: from the server.
- New data: extend ApiAdapter, realistic data in mockAdapter, httpAdapter calls the endpoint you expect. Put new adapter methods in a new file per domain where possible, so other terminals' changes do not conflict. Describe every new endpoint in docs/backend-gaps.md under "## admin (operator, 2026-11-24)" (client: "## client (miniven, 2026-11-24)").
- Roles and visible sections from getMe(); the server is the real check.
- Phone numbers are shown in full everywhere in admin. No driver level and no SOS in operator screens.
- After each group: typecheck, build (also with VITE_DEMO_MODE=false), commit. Never commit failing code. Do not push.
- When finished: tell me in Uzbek, 3–5 short lines, what is done.

1. Create one small back-button component in the style of the design (see the "Orqaga" link in design-v2/admin/Verify.dc.html: icon + text, top-left, above the page title or next to the breadcrumb). It goes to the previous page in history, or to a given parent route if there is no history (opened by direct link).
2. Add it to every existing detail or sub page: order detail, driver profile, driver history, driver wallet/ledger views opened from a driver, passenger detail, ledger fix, tariff edit, staff add/edit, audit entry, and any other page reached by clicking from a list or another page. Find them all by checking the routes; do not change list pages that are top-level sidebar items.
3. Keep scroll position and filters of the list when going back if the list already keeps them; do not build a new state system for it.

Commit. Then wait. When I write "yangi sahifalar": run `git merge redesign-v2` into your branch and add the same back button to all new operator and manager detail pages (/op/passengers/:id, /op/drivers/:id, /op/orders/:id, /requests detail if any). Build, commit, tell me.
```

## D. Client miniven terminal

```
You work in client/ on branch client-van. Task: miniven seat selection on the Trip screen.

Rules for this task:
- Read first: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md (section 2.5, especially "Operator huquqlari (2026-11-24)"), docs/izgo-dizayn-v2.md.
- Do not send me a plan and do not wait for my OK. Start right away.
- Decide small things yourself: transitions, animations, spacing, empty/loading/error states, component split, naming, mock data. Do not ask me about them.
- Do not add anything that is not in the design or the docs. No big refactors. Do not rewrite working code outside your scope.
- Ask me only if the design contradicts the docs on a business rule, or an existing input would disappear.
- No business logic in the frontend. Which action buttons appear (cancel, restart search, unlock SMS limit, resend code, etc.) comes from the server as a list of allowed actions; the mock returns it. Money, statuses, counts: from the server.
- New data: extend ApiAdapter, realistic data in mockAdapter, httpAdapter calls the endpoint you expect. Put new adapter methods in a new file per domain where possible, so other terminals' changes do not conflict. Describe every new endpoint in docs/backend-gaps.md under "## admin (operator, 2026-11-24)" (client: "## client (miniven, 2026-11-24)").
- Roles and visible sections from getMe(); the server is the real check.
- Phone numbers are shown in full everywhere in admin. No driver level and no SOS in operator screens.
- After each group: typecheck, build (also with VITE_DEMO_MODE=false), commit. Never commit failing code. Do not push.
- When finished: tell me in Uzbek, 3–5 short lines, what is done.

Spec: design-v2/client/TripVan.dc.html (compare with Trip.dc.html; the difference is the seat map). When the "Miniven" class is selected, the seat map switches to the minivan cabin: front row driver (not selectable) + 1 seat, 2nd row 3 seats, 3rd row 3 seats. Other classes keep the current sedan map. Card height and car image size as in the design. Switching class clears seats that do not exist in the new layout.
- The seat layout (rows, seat ids, free/busy) and the seat count on each class tile come from the server per class; the mock returns sedan and minivan layouts. "Butun mashina" stays enabled only when the server says no seat is taken.
- Price stays from the server for the chosen class and seats.
- Add new strings to uz/ru/en.
Build, test on the iOS simulator if possible, commit.
```

## R. Reviewer terminal

```
You are the reviewer for update v3. Main folder, branch redesign-v2. Branches: admin-ops-cards, admin-ops-orders, admin-back, client-van. Driver is not changed.

Read: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md (2.5 "Operator huquqlari (2026-11-24)"), docs/izgo-dizayn-v2.md, design-v2/PROMPTS-v3.md.

When I say "tekshir", for each branch with new commits:
1. Look at the diff against redesign-v2.
2. Check: no frontend business logic (action buttons from server flags, no price/commission/status calculations, no hard-coded design numbers); full phone numbers in admin; no "Faqat ko'rish" banner on operator Buyurtmalar/Haydovchilar; operator cannot change money, block, tariffs, staff, audit, export; no level and no SOS in operator screens; refund/compensation/block go only through "Menejerga so'rov"; manager confirm shows old → new for money; routes follow the contract in PROMPTS-v3.md; new endpoints listed in docs/backend-gaps.md without duplicates; no secrets, no "demo" text, test panel only under VITE_DEMO_MODE; client strings in uz/ru/en.
3. Typecheck and build in that worktree (also VITE_DEMO_MODE=false).
4. Short report to docs/review-log.md and to me in Uzbek: OK or fix list per terminal (I paste it there).

When I say "birlashtir": merge in this order, no fast-forward: client-van, admin-ops-cards, admin-ops-orders, admin-back. Resolve conflicts (router, sidebar, adapter index) keeping both sides. Run all three builds, commit. Then tell me to send "yangi sahifalar" to terminal C; after C finishes, merge admin-back again. Never push, never touch master, never force.
At the end, when I ask: one prompt in Uzbek for the backend chat with every new endpoint from docs/backend-gaps.md "## admin (operator, 2026-11-24)" and "## client (miniven, 2026-11-24)".
```
