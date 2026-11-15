# IZGO — Intercity Taxi Platform (Frontends)

Three frontends for **IZGO**, an intercity taxi platform for Uzbekistan:

| App | Folder | Port | Audience |
|---|---|---|---|
| IZGO Client | `client/` | 5173 | Passengers (mobile web) |
| IZGO Driver | `driver/` | 5174 | Drivers (mobile web, dark mode) |
| IZGO Admin | `admin/` | 5175 | Operations team (desktop, ≥1280px) |

Every app talks to its data through a single `ApiAdapter` interface with two implementations:
the real backend (`api/openapi.yml`, http adapter) and a localStorage-backed sample-data mode
(mock adapter, seeded with the same cities, drivers, passengers, orders and tariffs in all three).

## Running

Each app is an independent Vite project:

```bash
cd client && npm install && npm run dev   # http://localhost:5173
cd driver && npm install && npm run dev   # http://localhost:5174
cd admin  && npm install && npm run dev   # http://localhost:5175
```

Or via the repo's `.claude/launch.json` configurations: `izgo-client`, `izgo-driver`, `izgo-admin`.

## Modes and configuration

Each app reads two variables (see `.env.example`; put local overrides in `.env.local`):

- `VITE_DEMO_MODE=true` — built-in sample data (mock adapter, no network). `npm run dev` uses this
  by default (`.env.development`). Production builds default to `false`.
- `VITE_DEMO_MODE=false` — the real backend (http adapter, `shared/http`). `VITE_API_URL` is the
  backend base URL; when it is empty, `npm run dev` proxies `/api`, `/admin` and `/ws` to
  `VITE_DEV_PROXY_TARGET` (default `http://localhost:8000`), and a production build shows the
  "no server" screen.

Deployment: see [DEPLOY.md](DEPLOY.md). Contract gaps: see [docs/backend-gaps.md](docs/backend-gaps.md).
Shared HTTP-layer tests: `node --test 'shared/**/*.test.ts'` (Node ≥ 22.6, no packages).

## Sample-data mode

With `VITE_DEMO_MODE=true`, a floating **Sinov paneli** (test panel) lets you:

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
  - `src/api/adapters/http.ts` + `src/api/httpMapper.ts` — the real backend (`api/openapi.yml`)
    through the shared layer in `shared/http`. Features the contract lacks are reported through
    `api.capabilities` and hidden in the UI.
  - The build picks one adapter (`@active-adapter` alias in `vite.config.ts`), so the http build
    contains no mock data and the sample-data build contains no network code.
- `src/mockDb/` — localStorage-backed mock database + seed data generation
- `src/design/tokens.css` — CSS custom properties (colors, radii) shared design-system values
- `src/components/` — shared UI primitives (Card, Button, Badge, DataTable, ReviewStatus, etc.)

## Network rules

- `npm run check:no-network` scans the sources and, after a build, `dist/`. In sample-data mode
  there must be no network code at all. In http mode only `shared/http` may call the network, and
  the only origin allowed is `VITE_API_URL`'s. The CSP `connect-src` is generated from it at build
  time: `'self'` only while it is empty.

## What's fake in sample-data mode
- No real SMS/OTP, card processors, or maps — OTP codes, 2FA codes, and document images are all
  generated locally; the "map" is a static local SVG.
- No real secrets or PII — all phone numbers, driver documents, and admin credentials are
  synthetic demo data.
- Local Inter font subsets (latin + latin-ext) only — no external font CDNs.

## Per-app docs

See `client/README.md`, `driver/README.md`, `admin/README.md` for app-specific details.
