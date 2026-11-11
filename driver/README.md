# IZGO Driver

Driver-facing mobile web app. Navy night theme by default (light theme in Profil). Port 5174.

```bash
npm install
npm run dev          # http://localhost:5174
npm run typecheck
npm run build
npm run check:no-network
```

## Structure

- Bottom tabs: **Asosiy** (map cockpit, active order), **Hamyon** (Bugungi daromad, balance, ledger), **Tarix** (past trips), **Profil**.
- `src/api/adapterTypes.ts` is the whole contract between screens and the backend. Screens
  render what the adapter returns and send requests; commission, debt limit and level, offer
  timing, trip stages, bonus levels, filtering and pagination are all computed in
  `src/api/adapters/mock.ts`.
- `src/mockDb/driverDb.ts` holds the driver's local demo state (seeded relative to "now", and
  re-anchored daily so "today" is never empty). `src/seed/generate.ts` is the seed shared with
  client/admin and stays identical across apps.
- i18n: `src/lib/i18n/{uz,ru,en}.ts` + `useT()`. `uz` is the source; ru/en are typed against it.
- Design tokens: `src/design/tokens.css` + `tailwind.config.ts` (radius 8/12/16, weights
  500/700, one easing curve, two shadow levels).

## Demo

- New drivers go through a 4-step sign-up (phone + OTP, personal, car, documents). Demo OTP: `0000`.
- **Profil → Demo boshqaruv**: role presets (new driver, online, near/at the debt limit, bonus
  active, offline), an incoming order, a trip at each stage, slow internet, error mode, reset.
- Every verification (OTP, documents, top-up, card link, trip steps, profile changes, support
  requests) goes through the shared `submitForReview` → `ReviewStatus` pattern.
