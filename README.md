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

Client and driver read a third one:

- `VITE_MAPBOX_TOKEN` — a Mapbox **public** token (`pk.…`) turns on the interactive map, in both
  modes. Put it in `client/.env.local` and `driver/.env.local` (gitignored), never in a tracked
  file. Empty: the drawn SVG map is used and the build has no Mapbox code. See [The map](#the-map).

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

## The map

`shared/map/` holds the map of the client and driver apps (admin has none):

- `MapView.tsx` — the one reusable `<MapView />` (Mapbox GL JS): markers, route lines, camera.
  Each app wraps it in `src/components/LiveMap.tsx` (its token, theme and label language).
  Default centre: Tashkent `[69.2401, 41.2995]`.
- `useRoute.ts` — the road route between points from the Mapbox Directions API
  (`https://api.mapbox.com/directions/v5/mapbox/driving/`), called straight from the browser with
  the public token only (never the IZGO session). Any failure draws a straight line instead.
- `useGeolocation.ts` — the device's GPS position; sample-data mode passes mock coordinates.
- `geo.ts`, `directions.ts`, `route.ts` — pure code with tests (`node --test 'shared/**/*.test.ts'`).

What each app shows:

| App | Screen | Map |
|---|---|---|
| Client | Home | Full-screen map behind the sheet, the passenger's position, the pickup pin |
| Client | Order sheet | Pickup, drop-off and stops with the road route |
| Client | Tracking, history | The route and, once a driver is assigned, the car moving live |
| Driver | Home | Full-screen map behind the feed sheet (its handle opens the whole map), the driver's position; for the accepted trip the road to the passenger and on to the destination |

The map is built in only when `VITE_MAPBOX_TOKEN` is set (the `@map-provider` alias, picked at
build time like `@active-adapter`). Without the token — and whenever the map cannot be shown
(no WebGL, offline, a refused token) — every screen falls back to its drawn SVG map.

In sample-data mode the coordinates are mock ones made by the mock adapters: addresses around
each city's centre, a passenger in the centre of Tashkent, a driver who starts a couple of
kilometres from the pickup, and a car that moves along the drawn route as the order's timeline
advances. With the real backend the car's position is expected as a `driver.location` WebSocket
event, which the backend does not send yet ([docs/backend-gaps.md](docs/backend-gaps.md)).

## Network rules

- `npm run check:no-network` scans the sources and, after a build, `dist/`. In sample-data mode
  there must be no network code at all. In http mode only `shared/http` may call the network, and
  the only origin allowed is `VITE_API_URL`'s. The CSP `connect-src` is generated from it at build
  time: `'self'` only while it is empty.
- The map is the one exception, and only in a build with `VITE_MAPBOX_TOKEN`: Mapbox code and
  hosts may appear only in the lazily loaded `mapboxRuntime` chunk (from
  `shared/map/mapboxRuntime.ts`, the only file allowed to import `mapbox-gl`), and the CSP gains
  exactly the Mapbox hosts and `blob:` workers. So a sample-data build **with** the token does
  reach Mapbox (tiles and routes) — and nothing else. Without the token the rules are unchanged.

## What's fake in sample-data mode
- No real SMS/OTP or card processors — OTP codes, 2FA codes, and document images are all
  generated locally. The map is a static local SVG unless `VITE_MAPBOX_TOKEN` is set; with it
  the map and routes are real, the positions on it are mock coordinates.
- No real secrets or PII — all phone numbers, driver documents, and admin credentials are
  synthetic demo data.
- Local Inter font subsets (latin + latin-ext) only — no external font CDNs.

## Per-app docs

See `client/README.md`, `driver/README.md`, `admin/README.md` for app-specific details.
