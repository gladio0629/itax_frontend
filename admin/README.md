# IZGO Admin

Team-only operations dashboard. Desktop-first: full sidebar at ≥1280px, icon-rail sidebar from 1024px. Port 5175.

```bash
npm install
npm run dev          # http://localhost:5175
npm run typecheck
npm run build
npm run check:no-network
```

## Demo login

Login requires an email + password + 2FA code (all local, no real auth):

- `kamola@izgo.uz` / `javlon@izgo.uz` / `shahnoza@izgo.uz` — password: `demo1234`
- The 2FA code is shown directly in the UI copy ("Demo kod: ...") after requesting it.

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

Use the floating Demo Control Panel (bottom-right) to reset the database or simulate
"no driver found", slow internet, forced errors, wallet limit, or fast-forwarded time.
