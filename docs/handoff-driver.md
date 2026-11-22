# Handoff: driver redesign v2 → shared files / reviewer

Changes the driver app needs outside `driver/`. Nothing here was edited by the driver terminal.

## 1. Legal links (terms, privacy) — owner decision needed

The owner asked for links to the driver terms and the privacy policy on Main and next to the registration checkbox.
`shared/scripts/check-no-network.mjs` fails on any hardcoded external URL in `src/` and in `dist/`, so the driver app
cannot contain `https://xasanow.uz/terms/` itself. Today the links come from the adapter (`getLegalLinks`):
sample data returns `example.com` placeholders, the real backend has no endpoint yet, so the real build shows the
names as plain text.

Pick one:
- **A (backend):** add `GET /api/v1/legal` → `{ terms_url, privacy_url }` (see `docs/backend-gaps/driver.md`,
  "Redesign v2"). No shared change.
- **B (shared check):** allow plain links (not network calls) to the public site host in
  `shared/scripts/check-no-network.mjs` (e.g. an `INERT_HOSTS`-style list for `xasanow.uz`), then the driver can read
  `VITE_TERMS_URL` / `VITE_PRIVACY_URL`. Affects client and admin checks too.
