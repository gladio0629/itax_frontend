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

- Bottom tabs: **Asosiy** (passenger request feed: Yangi so'rovlar / Qabul qilinganlar), **Hamyon** (Bugungi daromad, balance, ledger), **Tarix** (past trips), **Profil**.
- **Asosiy** sits on a full-screen map (`src/features/home/HomeMap.tsx`): the feed is a sheet over
  it, and the sheet's handle opens the whole map. It shows the driver's position and, for the
  accepted trip, the road to the passenger and on to the destination. With `VITE_MAPBOX_TOKEN`
  (in `.env.local`) it is the interactive Mapbox map from `../shared/map`; without it, the drawn
  night-city map. In sample-data mode the positions are mock coordinates from the mock adapter.
- `src/api/adapterTypes.ts` is the whole contract between screens and the backend. Screens
  render what the adapter returns and send requests; commission, debt limit and level, which
  requests a driver sees (Yo'nalishlarim + Imkoniyatlarim), seats, first-accept-wins, trip
  stages, bonus levels, filtering and pagination are all computed in
  `src/api/adapters/mock.ts`.
- `src/mockDb/driverDb.ts` holds the driver's local demo state (seeded relative to "now", and
  re-anchored daily so "today" is never empty). `src/seed/generate.ts` is the seed shared with
  client/admin and stays identical across apps.
- i18n: `src/lib/i18n/{uz,ru,en}.ts` + `useT()`. `uz` is the source; ru/en are typed against it.
- Design tokens: `src/design/tokens.css` + `tailwind.config.ts` (radius 8/12/16, weights
  500/700, one easing curve, two shadow levels).

## Demo

- New drivers go through sign-up (phone + OTP, personal, car, documents), then pick Yo'nalishlarim. Demo OTP: `0000`.
- **Profil → Demo boshqaruv**: role presets (new driver, active, near/at the debt limit, bonus
  active), new request (random / all details / cargo), another driver takes a request, seats
  full, debt limit, slow internet, error mode, reset. The mock market emits a request every 20–40 s.
- Every verification (OTP, documents, accepting a request, top-up, card link, trip steps, profile changes, support
  requests) goes through the shared `submitForReview` → `ReviewStatus` pattern.
