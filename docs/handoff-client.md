# Handoff: client (redesign v2)

Changes the client needs outside `client/`. The client terminal does not edit these files; the reviewer applies them.

## 1. Legal links: allow the public site in `check:no-network` (2026-11-22)

- **Why:** the login screen (design `Main`) and later `About` link to "Foydalanish shartlari" and "Maxfiylik siyosati". The pages live on the public site (`site/terms`, `site/privacy`). Opening them is a link to the system browser, not a network request from the app.
- **Client side (done):** the URL comes from `VITE_SITE_URL`; the default `https://xasanow.uz` is in `client/.env` (owner, 2026-11-22). Empty: the names show as bold text without a link.
- **Done by the reviewer (round 2):** `check:no-network` accepts `https://xasanow.uz`, `/terms`, `/privacy` as plain links.
- **Needed in `shared/scripts/check-no-network.mjs`:** with `VITE_SITE_URL` set, its origin ends up in `dist/` as a plain `<a href>` and the build scan rejects it as an unknown host. Proposal: read `VITE_SITE_URL` like `VITE_API_URL` and accept its origin in the **build** scan only as an inert link host (it must not be added to `connect-src`). The source scan stays as it is (the URL is never hard-coded in `src/`).
- **Links:** `https://xasanow.uz/terms`, `https://xasanow.uz/privacy` (the site already used in the stores).
