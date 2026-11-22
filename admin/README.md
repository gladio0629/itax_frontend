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

## Pages

Dashboard (KPIs + weekly revenue chart) · Driver verification (document review + approve/reject)
· Drivers / Passengers (search, sort, pagination, detail drawer, phone reveal) · Orders (table +
map detail drawer) · Wallet ledger · Tariffs (two-person approval: propose → second admin
approves via `ReviewStatus` → applied) · Support tickets · Risk & fraud flags · Roles &
permissions matrix · Audit log · Settings.

## Notable patterns

- **Phone reveal**: phone numbers are masked by default; clicking "Ko'rsatish" reveals them and
  writes a `phone_reveal` entry to the audit log (visible immediately on the Audit page).
- **Two-person tariff approval**: proposing a tariff change requires a second admin to approve it
  through the same `ReviewStatus` component used for 2FA login, with the
  "Ikkinchi adminga yuborildi" copy.
- Sidebar badge counts (pending verifications, open tickets, flagged risk items) refresh on every
  route change.

Use the floating Demo Control Panel (bottom-left) to reset the database or simulate
"no driver found", slow internet, forced errors, wallet limit, or fast-forwarded time.
