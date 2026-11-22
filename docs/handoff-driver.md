# Handoff: driver redesign v2 → shared files / reviewer

Changes the driver app needs outside `driver/`. Nothing here was edited by the driver terminal.

## 1. Legal links: network-check exception (option B, same as client) — DONE in `ecb8449`

The app links to `${SITE_URL}/terms` and `${SITE_URL}/privacy` (plain `<a target="_blank">`, never fetched).

## 2. Account deletion page: `/delete-account` (owner allowed it, 2026-11-22)

Sozlamalar → "Akkauntni o'chirish" links to `${SITE_URL}/delete-account` until `DELETE /api/v1/drivers/me`
exists. The check passes today (the bundle holds only the bare origin; the path is joined at runtime), but the
owner decision and `shared/scripts/check-no-network.mjs` should name it: add `delete-account` to
`LEGAL_LINK_PATH` and to the comments that say "terms and privacy only".

`driver/.env` is no longer tracked. The site default (`https://xasanow.uz`) is in `driver/vite.config.ts`
(`define: __SITE_URL_DEFAULT__`), outside the source scan; `VITE_SITE_URL` still overrides it. The client can do
the same if it drops `client/.env`.
