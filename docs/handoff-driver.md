# Handoff: driver redesign v2 → shared files / reviewer

Changes the driver app needs outside `driver/`. Nothing here was edited by the driver terminal.

## 1. Legal links: network-check exception (decided: option B, same as client) — DONE in `ecb8449`

Main and the selfie step link to `${VITE_SITE_URL}/terms` and `${VITE_SITE_URL}/privacy`
(`driver/.env`: `VITE_SITE_URL=https://xasanow.uz`; `driver/src/config.ts` → `SITE_URL`). They are plain
`<a target="_blank">` links opened in the system browser, never fetched.

`shared/scripts/check-no-network.mjs` flags the site host in `dist/` (the source has no hardcoded URL), so
`npm run check:no-network` in `driver/` fails on a build until the reviewer allows the public site host as a
link-only host (for example an `INERT_HOSTS`-style entry for `xasanow.uz`, or reading `VITE_SITE_URL`'s host). The
same exception covers the client.
