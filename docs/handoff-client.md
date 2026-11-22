# Handoff: client (redesign v2)

Changes the client needs outside `client/`. The client terminal does not edit these files; the reviewer applies them.

## 1. Legal links: allow the public site in `check:no-network` (2026-11-22)

- **Why:** the login screen (design `Main`) and later `About` link to "Foydalanish shartlari" and "Maxfiylik siyosati". The pages live on the public site (`site/terms`, `site/privacy`). Opening them is a link to the system browser, not a network request from the app.
- **Client side (done):** the URL comes from `VITE_SITE_URL`; the default `https://xasanow.uz` is `SITE_URL` in `client/src/config.ts` (owner, round 3: no tracked `.env`, default in config code; the network check allows the bare origin in that file only). Empty: the names show as bold text without a link.
- **Done by the reviewer (round 2):** `check:no-network` accepts `https://xasanow.uz`, `/terms`, `/privacy` as plain links.
- **Done by the reviewer (after round 3):** the source scan accepts the bare origin in `src/config.ts`. Nothing more needed.
- **Links:** `https://xasanow.uz/terms`, `https://xasanow.uz/privacy` (the site already used in the stores).
