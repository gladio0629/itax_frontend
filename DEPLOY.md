# Deploying IZGO (client, driver, admin)

Each app is a static single-page app. Deploy each one as its **own site** on Vercel, Netlify or
Cloudflare Pages (all have free plans). All three sites use the same repository.

| App | Root / base directory | Build command | Output folder |
|---|---|---|---|
| Client (passengers) | `client` | `npm run build` | `dist` |
| Driver | `driver` | `npm run build` | `dist` |
| Admin | `admin` | `npm run build` | `dist` |

The build also reads `shared/` (one level above each app), so the host must check out the
whole repository. All three hosts do this by default. On Vercel, keep **"Include files outside
the Root Directory in the Build Step"** turned on (also the default).

## Environment variables (set on every site)

| Variable | Value now | Meaning |
|---|---|---|
| `VITE_API_URL` | *(leave empty)* | Backend base URL, e.g. `https://api.example.com` |
| `VITE_DEMO_MODE` | `false` | `true` would ship the built-in sample data instead of the backend |
| `VITE_MAPBOX_TOKEN` | *(client and driver only)* | Mapbox **public** token (`pk.…`) for the interactive map. Empty: the apps show the drawn map and the build contains no Mapbox code |
| `NODE_VERSION` | `20` | Only needed on Cloudflare Pages / Netlify if their default is older |

While `VITE_API_URL` is empty, the deployed apps open and show "Server bilan aloqa yo'q.
Keyinroq urinib ko'ring." with a retry button. That is expected.

`VITE_*` values are baked in at **build** time. After changing one, redeploy.

### The map token

`VITE_MAPBOX_TOKEN` ends up in the JavaScript every visitor downloads — that is how a Mapbox
public token is meant to be used, and why it must be a `pk.` token, never a secret `sk.` one.
In the Mapbox account, restrict it to the 3 site URLs (*Tokens → URL restrictions*) so it cannot
be reused elsewhere. Set it in the host's environment variables (or in `.env.local` for local
work, which is gitignored) — never in a tracked file. Admin has no map and ignores it.

## Vercel

1. **Add New → Project**, then import the repository.
2. Set **Root Directory** to `client`. Vercel detects Vite, so leave the build command
   (`npm run build`) and output (`dist`) as detected.
3. Add the environment variables above, then click **Deploy**.
4. Repeat steps 1–3 for `driver` and `admin`.

`vercel.json` in each app holds the SPA fallback and the security headers.

## Netlify

1. **Add new site → Import an existing project**, then pick the repository.
2. Set **Base directory** to `client`, **Build command** to `npm run build` and **Publish directory**
   to `dist`. Netlify shows it as `client/dist`.
3. Under **Environment variables**, add the variables above, then click **Deploy**.
4. Repeat steps 1–3 for `driver` and `admin`.

`public/_redirects` (SPA fallback) and the generated `_headers` (security headers) are copied
into `dist` by the build.

## Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git**, then pick the repository.
2. Set **Framework preset** to `None`, **Build command** to `npm run build`, **Build output
   directory** to `dist` and, under *Advanced*, **Root directory** to `client`.
3. Add the environment variables above, then click **Save and Deploy**.
4. Repeat steps 1–3 for `driver` and `admin`.

Cloudflare Pages reads the same `_redirects` and `_headers` files as Netlify.

## Later: when the backend URL is known

1. On each of the 3 sites, set `VITE_API_URL` to the backend URL, e.g. `https://api.izgo.uz`.
2. Redeploy each site.

The build writes that origin, plus its `wss://` form for the WebSocket, into the
Content-Security-Policy `connect-src` automatically. You don't need to edit any file.

**The backend must:**
- Be served over **HTTPS** (and `wss://` for `/ws`). An `https://` page cannot call an `http://` API.
- Allow **CORS** from the 3 hosted domains, e.g. `https://izgo-client.vercel.app`, the driver
  domain and the admin domain. Allow methods `GET, POST, PUT, PATCH, DELETE, OPTIONS` and
  request headers `Authorization, Content-Type, X-App, Idempotency-Key`. Without CORS the browser
  blocks every request, and the apps show their "no connection" message.

## What the security headers do

- `Content-Security-Policy`: scripts, styles and fonts load from the site itself only.
  `connect-src` is `'self'` plus the `VITE_API_URL` origin and its `wss://` origin, or only `'self'`
  while it is empty. `frame-ancestors 'none'` blocks embedding.
- With `VITE_MAPBOX_TOKEN` (client and driver), the build adds exactly what Mapbox GL JS needs:
  `connect-src https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com`,
  `worker-src 'self' blob:` / `child-src blob:` for the map's web worker and `blob:` in `img-src`.
  `script-src` stays `'self'`. Without the token none of this is added.
- `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- Netlify and Cloudflare send all of these from the generated `dist/_headers`. Vercel reads
  `vercel.json` before the build, so it can't use a generated file. There, `vercel.json` sends
  the static headers (with `frame-ancestors 'none'`), and the build-generated `<meta>` CSP in
  `index.html` restricts `connect-src`.

## Checking a build locally

```bash
cd client
VITE_DEMO_MODE=false npm run build      # http build; VITE_API_URL empty → "no server" screen
npm run check:no-network                # sources + dist: only the API origin may be reached
npm run preview                         # http://localhost:5173
```
