# Redesign v2: setup and prompts for 4 Claude Code terminals

## 0. Setup (do this once, yourself, in a normal terminal)

```bash
cd /home/gladio/p/project_hat/onlyfront
git status                      # must be clean; commit or stash first
git pull
git checkout -b redesign-v2

# unzip izgo-redesign-v2.zip here, so you get ./design-v2 and ./docs/*.md
unzip ~/Downloads/izgo-redesign-v2.zip -d .
git add design-v2 docs/izgo-asosiy-hujjat.md docs/izgo-dizayn-v2.md
git commit -m "Add redesign v2 design sources and docs"

# one working copy per app (separate folders, separate branches)
git worktree add ../onlyfront-client -b redesign-client
git worktree add ../onlyfront-driver -b redesign-driver
git worktree add ../onlyfront-admin  -b redesign-admin

# each copy needs its own node_modules and .env.local
for a in client driver admin; do
  cp client/.env.local ../onlyfront-$a/client/ 2>/dev/null
  cp driver/.env.local ../onlyfront-$a/driver/ 2>/dev/null
  cp admin/.env.local  ../onlyfront-$a/admin/  2>/dev/null
done
# then run your usual install (npm install) inside each copy / app folder
```

Open 4 terminals and run `claude` in each:

| Terminal | Folder | Prompt |
|---|---|---|
| 1 Client | `../onlyfront-client` | section 1 |
| 2 Driver | `../onlyfront-driver` | section 2 |
| 3 Admin | `../onlyfront-admin` | section 3 |
| 4 Reviewer | `onlyfront` (branch `redesign-v2`) | section 4 |

To see a result locally: in that folder run the app's dev command (client 5173, driver 5174, admin 5175).

---

## 1. Client terminal

```
You are rebuilding the IZGO passenger app (client/) to the new design v2.

First read: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md, docs/izgo-dizayn-v2.md.
Then study the current client/ code: routes, screens, components, stores, ApiAdapter (mock + http), i18n, Capacitor setup. Give me a short map (in Uzbek): which current screen maps to which design file, which design screens are new, and which data each screen needs from the adapter. Wait for my OK.

After my OK, work in this order, one group at a time, commit after each:
1. Design tokens and base components: colors, Plus Jakarta Sans font (bundle it locally, no Google Fonts request at runtime), radii, primary button (60px, green, arrow circle), input field (68px, label on top, focus ring), chips, segmented control, bottom sheet, dark header, icon set, empty/loading/error/offline states (StateEmpty, StateLoading, StateError, StateOffline).
2. Login: Main, Otp, Language, KbMain, KbOtp.
3. Home: Home, HomeEmpty, Menu.
4. Address: Address, MapPick, AddressDetails, KbAddress, KbDetails.
5. Passenger order: Trip (stops up to 3, seat picker, car class), Extras ("Bagaj va izoh": luggage count, comment, order for another person), Time, Payment (methods, promo, price lines from server), KbTime, KbPayment, KbExtras.
6. Cargo: Cargo (scope, drop-offs, body S–3XL), CargoContacts, CargoTerms, KbCargoContacts.
7. Trip live: Search, NoDriver, Driver, Arrived, OnTrip, Rate, KbRate.
8. History and bonus: History, HistoryDetail, KbHistory, Bonus.
9. Settings: Settings, Account (incl. delete account), Notifications, Help, About, KbAccount, KbHelp.

Keyboard (Kb*) screens are not separate routes: they show how the same screen must look when the keyboard is open (dark top shrinks, white sheet and main button stay above the keyboard). Implement that behaviour on the real screen and test it in the iOS simulator / Android emulator if you can.

Wishes/options are removed. Cargo uses body sizes S–3XL. All prices, price lines, ETA, seat availability come from the server.
Stay inside client/. Shared changes go to docs/handoff-client.md. Missing endpoints go to docs/backend-gaps.md under "## client (redesign v2)".
After each group: typecheck, build, commit, then tell me in Uzbek what is done and what I should look at.
```

---

## 2. Driver terminal

```
You are rebuilding the IZGO Driver app (driver/) to the new design v2.

First read: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md, docs/izgo-dizayn-v2.md.
Then study the current driver/ code: routes, tabs, screens, stores, ApiAdapter (mock + http), registration flow, wallet, Capacitor setup. Give me a short map (in Uzbek): current screen → design file, new screens, data each screen needs. Wait for my OK.

After my OK, work in this order, one group at a time, commit after each:
1. Design tokens and base components (same values as the client design: colors, Plus Jakarta Sans bundled locally, radii, buttons, inputs, chips, bottom sheet, floating dark tab bar Asosiy / Hamyon / Tarix / Profil, slide-to-confirm button if the design uses it), empty/loading/error/offline states.
2. Login and registration: Main, Otp, RegPersonal, RegLicense, RegCar, RegSelfie, RegReview (automatic check, no manual approval).
3. Work flow: Home (my route + request list, Accept / Reject, no online/offline toggle), Request (countdown), OrderDetail (cargo request with body size), ToPickup, Waiting (free minutes then paid, values from server), OnTrip (SOS), Finished (commission, cash reminder, rate passenger).
4. Wallet: Wallet (debt limit), WalletDebt (blocked state), TopUp (Payme / Click / card).
5. Profile: History, Profile, Level, Capabilities, Notifications, Settings (incl. delete account).

Wishes/options are removed (decision 2026-11-22): Capabilities keeps only cargo body sizes S–3XL and "help as loader". Request cards show no wish badges (child, AC, big luggage); luggage count and passenger comment may stay.
Commission %, level, balance, debt limit, earnings, waiting price: all from the server.
Stay inside driver/. Shared changes go to docs/handoff-driver.md. Missing endpoints go to docs/backend-gaps.md under "## driver (redesign v2)".
After each group: typecheck, build, commit, then tell me in Uzbek what is done and what I should look at.
```

---

## 3. Admin terminal

```
You are rebuilding the IZGO Admin web panel (admin/) to the new design v2.

First read: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md (section 2.5 roles), docs/izgo-dizayn-v2.md.
Then study the current admin/ code: routes, role/permission handling (getMe), pages, tables, ApiAdapter (mock + http), login flow, Vercel config. Give me a short map (in Uzbek): current page → design file, new pages, pages to remove, data each page needs. Wait for my OK.

After my OK, work in this order, one group at a time, commit after each:
1. Layout and tokens: dark left sidebar (groups Asosiy / Pul / Jamoa, active item green bar), header with search, white cards, tables with filters and pagination, status badges, masked phones, confirmation modal component, Plus Jakarta Sans bundled locally. Responsive: works from 1280 px down to tablet; tables scroll inside their box.
2. Login: Main (email + email code), Verify (phone + SMS code). Operator: phone + SMS only. No "remember device".
3. Main: Dashboard, Orders, OrderDetail, Drivers (block / unblock only, no manual approval), DriverProfile, DriverHistory, Passengers.
4. Money: Ledger (read-only ledger), LedgerFix (correction entry), Tariffs (fuel price per litre for gas and petrol, per-class and per-body markup as percent or sum, extra fees, level commissions).
   Two-step confirmation (decision 2026-11-22): Save → modal shows old → new → Confirm applies, Cancel discards. No second person, no "Tasdiqlar" page. Remove any existing approvals page/route.
5. Team: Operators (Navbat / Jarayonda / Bugungi tasdiqlanganlar), OperatorView, OperatorHistory and OperatorDrivers (read-only for operator, no balance), Staff, StaffAdd (only roles the current user may create), Audit, Marketing (read-only stats).

Sections and actions are shown by role from getMe(); the server is the real check. The tariff "example" column is display only: if the server returns an example price, show it; do not calculate prices in the frontend.
Stay inside admin/. Shared changes go to docs/handoff-admin.md. Missing endpoints go to docs/backend-gaps.md under "## admin (redesign v2)".
After each group: typecheck, build, commit, then tell me in Uzbek what is done and what I should look at.
```

---

## 4. Reviewer terminal

```
You are the reviewer and integrator for the IZGO redesign v2. You work in the main folder on branch redesign-v2. Three other Claude Code sessions are working in git worktrees on branches redesign-client, redesign-driver, redesign-admin.

First read: design-v2/RULES.md, docs/izgo-asosiy-hujjat.md, docs/izgo-dizayn-v2.md, design-v2/PROMPTS.md.

When I say "tekshir" (or every time I ask), do this for each branch that has new commits:
1. git fetch / look at the new commits on that branch (git log redesign-v2..redesign-<app>, git diff).
2. Check the rules:
   - no business logic: search the diff for price/commission/discount/fee calculations, hard-coded sample numbers from the design (120 000, 150 000, 10%, 5%, -50 000, 500 so'm, etc.), status decided on the client;
   - wishes/options fully removed; cargo uses S–3XL; admin has no approvals page and uses Save → modal → Confirm;
   - no secrets, no .env files committed, no "demo" text in the UI, test panel only under VITE_DEMO_MODE;
   - i18n keys added for new strings (client uz/ru/en);
   - the app stayed inside its own folder; shared needs are in docs/handoff-<app>.md.
3. Build check in that worktree: typecheck and build with VITE_DEMO_MODE=false; then grep dist for "Sinov paneli" and for mock-only markers. For client and driver also run `npx cap sync` dry check if available (do not open Xcode).
4. Compare a few screens with design-v2/<app>/png/*.png (run the dev server and take screenshots if Playwright is available; otherwise review the JSX against the .dc.html). Note visible differences.
5. Write a short report to docs/review-log.md (date, branch, commit range, OK / problems with file:line) and tell me in Uzbek: what is good, what must be fixed, which terminal must fix it (I will paste your fix list into that terminal).
6. Only when I say "birlashtir": merge the green branch into redesign-v2 (no fast-forward), apply the handoff-<app>.md shared changes yourself, resolve conflicts, run all three builds, commit. Never push, never touch master, never force.

Also keep docs/backend-gaps.md consistent across the three apps (one entry per endpoint, no duplicates) and, when I ask, produce one prompt in Uzbek for the backend chat listing every new endpoint and field.
```

---

## Notes

- `design-v2/` and `docs/` are on `redesign-v2`; every worktree branch starts from it, so all terminals see the same files.
- Store releases (1.0) come from `master`. Nothing here touches `master` until you decide.
- Before the next store build: bump Android `versionCode` and iOS build number.
