# IZGO Admin

Team-only operations dashboard. Desktop-first: full sidebar at ≥1280px, icon-rail sidebar from 1024px. Port 5175.

```bash
npm install
npm run dev          # http://localhost:5175
npm run typecheck
npm run build
npm run check:no-network
```

## Sign-in

Doc 2.5, design Main + Verify. Nothing is remembered on the device: every logout means a full sign-in.

- Staff with email (superadmin, owner, menejer, marketolog): email → email code, then the staff phone → SMS code.
- Operator: "Operatormisiz? Telefon bilan kiring" → phone → SMS code.

Sample-data build (`VITE_DEMO_MODE=true`): the code is shown under the boxes ("Sinov kodi").
Accounts: kamola@izgo.example / +998 90 000 00 01 (superadmin), behzod@… / …02 (owner),
javlon@… / …03 (menejer), shahnoza@… / …04 (marketolog), operator +998 90 000 00 05.

## Pages (design v2)

Dashboard (KPIs, 14-day chart, top routes, recent orders, attention cards) · Orders (+ `/orders/:id`
detail panel: timeline, price lines, edit, cancel, send to operator) · Drivers (+ `/drivers/:id`
profile, history, documents; block/unblock, edit, archive; no manual approval) · Passengers ·
Complaints · Hamyon va to'lovlar (read-only ledger + `/wallet/fix` correction entry) · Tariflar
(fuel price per litre, class and body markups, extra fees, level commissions) · Operators
(supervisors: Navbat / Jarayonda / Bugungi tasdiqlanganlar board; operator: `/operators` current task
with five results and postpone, `/operators/history` own tasks + read-only orders, `/operators/drivers`
read-only drivers without balance) · Staff (+ `/staff/new`) · Audit log · Marketing (`/marketing`,
read-only; marketolog, superadmin, owner, menejer) · Profile.

## Notable patterns

- **Two-step confirmation (decision 2026-11-22):** a tariff change or a correction entry is made by
  one person: Save → `ChangeConfirmModal` (old → new) → Confirm sends one request; Cancel discards.
  No second approver, no "Tasdiqlar" page. The server writes the audit entry.
- **No business logic in the browser:** prices, examples, totals, levels, debt-limit badges, counts
  and timelines come from the adapter (the mock plays the server). `null` = not reported = hidden.
- **Phones are shown in full** for every role (decision 2026-11-22).
- **Capabilities:** the http adapter calls the endpoints it expects; features the backend lacks stay
  hidden behind `api.capabilities` (see `docs/backend-gaps/admin.md`).

Use the floating test panel (bottom-right, sample-data build only) to reset the data or simulate
slow internet, forced errors and other scenarios.
