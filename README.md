# IZGO — Intercity Taxi Platform (Demo Frontends)

Three production-quality frontend demos for **IZGO**, an intercity taxi platform for Uzbekistan:

| App | Folder | Port | Audience |
|---|---|---|---|
| IZGO Client | `client/` | 5173 | Passengers (mobile web) |
| IZGO Driver | `driver/` | 5174 | Drivers (mobile web, dark mode) |
| IZGO Admin | `admin/` | 5175 | Operations team (desktop, ≥1280px) |

All three are **100% frontend demos** — there is no real backend. Every app ships its own
localStorage-backed mock database (seeded with the same underlying data — cities, drivers,
passengers, orders, tariffs) and talks to it through a single `ApiAdapter` interface.

## Running

Each app is an independent Vite project:

```bash
cd client && npm install && npm run dev   # http://localhost:5173
cd driver && npm install && npm run dev   # http://localhost:5174
cd admin  && npm install && npm run dev   # http://localhost:5175
```

Or via the repo's `.claude/launch.json` configurations: `izgo-client`, `izgo-driver`, `izgo-admin`.

## Demo mode

Every app is gated by `VITE_DEMO_MODE=true` (see each app's `.env`) and shows a **DEMO** badge.
A floating **Demo Control Panel** (bottom-right flask icon) lets you:

- **Bazani tiklash** — reset the local mock database back to its seeded state
- **Haydovchi topilmadi** — simulate "no driver found" for new ride requests
- **Sekin internet** — add artificial latency (slow network) to every mock request
- **Xatoliklarni qaytarish** — force a percentage of requests to fail
- **Hamyon limiti** — simulate a driver's wallet hitting its debt limit
- **Vaqtni tezlashtirish** — fast-forward simulated time (useful for seeing order/driver state changes)

## Shared verification flow

Every "send for review" interaction (OTP codes, card linking, wallet top-up, driver document
review, admin 2FA, two-person tariff approval, support ticket resolution) uses the same
`ReviewStatus` pattern: it shows "Tekshiruvga yuborildi" with an animated timeline and
auto-resolves to "approved" after 2–4 seconds. This is implemented once per app as a shared
`ReviewStatus` component and reused everywhere a review-like flow is needed.

## Architecture

- **React 18 + TypeScript + Vite + Tailwind CSS**
- `src/api/client.ts` exports a single `api` object. Every screen talks to the app only through
  this object — never directly to the mock database.
  - `src/api/adapters/mock.ts` — fully working mock adapter (business logic: pricing, distance,
    status transitions, commission, debt limits — all live here, never in components)
  - `src/api/adapters/http.ts` — empty stub that throws `NotImplemented`. To connect a real
    backend, implement this file; no UI code needs to change.
- `src/mockDb/` — localStorage-backed mock database + seed data generation
- `src/design/tokens.css` — CSS custom properties (colors, radii) shared design-system values
- `src/components/` — shared UI primitives (Card, Button, Badge, DataTable, ReviewStatus, etc.)

## What's intentionally fake

- No real network calls. A `check:no-network` npm script (run as part of `npm run build`'s CI
  equivalent) statically scans the bundle for `fetch`/`XMLHttpRequest`/external URLs and fails
  the build if any are found. `index.html` also sets a strict `connect-src 'self'` CSP.
- No real SMS/OTP, card processors, or maps — OTP codes, 2FA codes, and document images are all
  generated locally; the "map" is a static local SVG.
- No real secrets or PII — all phone numbers, driver documents, and admin credentials are
  synthetic demo data.
- Local Inter font subsets (latin + latin-ext) only — no external font CDNs.

## Per-app docs

See `client/README.md`, `driver/README.md`, `admin/README.md` for app-specific details.
