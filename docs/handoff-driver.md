# Handoff: driver redesign v2 → shared files / reviewer

Changes the driver app needs outside `driver/`. Nothing here was edited by the driver terminal.

## 1. Site links (`/terms`, `/privacy`, `/delete-account`) — DONE in `ecb8449` and `1870b85`

`SITE_URL` default is in `driver/src/config.ts` (bare origin only); `VITE_SITE_URL` overrides it. `driver/.env` is
not tracked.

Nothing open.
