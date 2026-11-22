# Redesign v2: review log

Reviewer terminal (branch `redesign-v2`). One entry per review round, newest first.
Verdict per branch: **GREEN** = can be merged, **YELLOW** = can be merged, fix items in the next group, **RED** = must be fixed before merging.

## 2026-11-22, round 2 (client group 2, driver group 2, admin phone decision)

Owner decisions this round: keep "Shikoyatlar" in admin; admin shows phone numbers in full for every role (no masking, no reveal); legal links may point to `https://xasanow.uz` (terms and privacy only).
Same checks as round 1, plus `check:no-network` in http mode and a client build with `VITE_SITE_URL=https://xasanow.uz`.
Screens: client `Main` matches `design-v2/client/png/Main.png`; the legal names show without links because the build has no `VITE_SITE_URL`, which is expected.

### Shared changes applied by the reviewer (`ecb8449`)
- `shared/scripts/check-no-network.mjs`: the build scan accepts `https://xasanow.uz` only as a plain link, either the bare origin or followed by `/terms` or `/privacy`. Tested: `api.xasanow.uz`, `http://`, `wss://`, ports, look-alike hosts and `/delete-account` are rejected. The source scan is unchanged, and the origin never enters `connect-src`. The path rule only covers full URLs. When the app appends the path at runtime, reviewers check that it appends only `/terms` or `/privacy`. Today that is true for client `PhoneScreen.tsx:169-170`.
- `DEPLOY.md`, `docs/native.md`: `VITE_SITE_URL=https://xasanow.uz`.
- Full phones in admin: `docs/izgo-dizayn-v2.md`, `design-v2/PROMPTS.md`, `docs/backend-gaps.md` (index item and security note 4).
- **Not applied:** `docs/izgo-asosiy-hujjat.md` is read-only (owned by the main chat). The owner must apply handoff-admin §1 there: §2.5 operator line, F-07 "telefon maskalash", and a journal row. One more line contradicts the decision and needs an owner call: §10 F-22 "adminda maskalash" (receiver phone, intercom code).

### redesign-client `af6b0cc..30c2352` (2 commits): GREEN
- typecheck, build, `check:no-network` (http, empty API, and with the site URL) pass. `dist` is clean.
- Login, OTP and language screens use i18n keys in uz/ru/en. The code length comes from the server, or from the adapter until the server sends one, and is not hard-coded. Onboarding was removed; it had no inputs.
- `@capacitor/status-bar` added. Its generated native files are committed.
- Still open from round 1: `client/src/ui/States.tsx:138,147` hard-coded colours (nit). Old cargo names and old colours are planned for groups 5 and 6.
- New: `client/.env.example` says the network check does not allow the site host yet. That is no longer true; update the comment.

### redesign-driver `4922a11..673057d` (2 commits): GREEN
- typecheck, build, `check:no-network` pass. `dist` is clean. The test panel link on sign-in is behind `DEMO_MODE` (`SignIn.tsx:171`).
- Rule 2 OK: registration still sends name, city, birth date, car model, colour, plate, year, class, seats, documents and terms. It adds licence data, brand and service types. Gaps are documented in `docs/backend-gaps/driver.md` ("Redesign v2").
- Car brand list `httpMapper.ts:69` (Chevrolet … Damas, Labo) is the driver's own car, not cargo bodies. OK.
- Fix: legal links. The owner chose option B, so use `VITE_SITE_URL` + `/terms`, `/privacy` like the client. Drop `getLegalLinks` and the `GET /api/v1/legal` row in `docs/backend-gaps/driver.md`.
- Group 4: `driver/src/api/adapters/http.ts:738` `getTopupOptions` hard-codes presets and min/max (pre-existing). Take them from the server, or list the endpoint in backend gaps.
- Round 1 nits fixed.
- Not compared: the sign-in and registration screens. The sample data starts signed in, so no driver screenshot was taken.

### redesign-admin `c0cc33e..63575a8` (1 commit): GREEN
- typecheck, build, `check:no-network` pass. `MaskedPhone` and the reveal flow are removed. Phones are shown in full, formatted `+998 90 123 45 67`. No masking is left in `admin/src` (grep for `mask|phone_masked|•|reveal`). The only hits are the field name below and a stale comment.
- Nits: `maskedDestination` (`admin/src/api/types.ts:276,295`) now carries a full phone; rename it. Stale "phone reveal" comment at `admin/src/api/adapters/http.ts:175`.
- Carried over to group 4 (unchanged, already on `redesign-v2`): the two-person approval flow (see round 1). `docs/backend-gaps/admin.md` still asks for `Tariff.pending_change.values` "so the second approver can see"; drop it in group 4.
- Round 1 hover-colour nits still open (`Button.tsx:28,33`, `DataTable.tsx:161`).

## 2026-11-22, round 1 (group 1: tokens and base components)

Checks: rules scan of the diff, `npm run typecheck`, `VITE_DEMO_MODE=false npm run build`, grep of `dist`, `npx cap sync` (client, driver), headless screenshots of the kit galleries against `design-v2/*/png/State*.png`.
Each was built from a clean detached checkout at the branch head, not the terminal's own working tree.

### redesign-client `cdc64dc..af6b0cc` (2 commits): GREEN

OK
- typecheck and build pass; `dist` has no "Sinov paneli", no gallery (`/dev/ui` exists only under `import.meta.env.DEV`), no `mockAdapter` marker, no `pk.` token.
- Fonts bundled locally (Plus Jakarta Sans + Manrope for Cyrillic), no Google Fonts request.
- New strings in uz/ru/en (`state.*`). No business logic, no sample prices.
- `@capacitor/keyboard` 8.0.6 added; generated `capacitor.settings.gradle`, `capacitor.build.gradle`, `Package.swift` committed; `cap sync` passes. `appId` and versions unchanged.
- State screens (error / offline) match `StateError.png` / `StateOffline.png` in copy and structure.

To fix in a later group (not blocking)
- `client/src/lib/i18n/{uz,ru,en}.ts:155-160` still have `cargo.vehicle.spark/damas/labo/isuzu/fura`; they reach the bundle. Remove in group 6 (Cargo, S–3XL).
- `client/src/features/order/ClassCarArt.tsx:6-8`, `client/src/features/order/VehicleIllustration.tsx:53-54`: old blue/yellow `#264A9F` / `#F6BF0E`. Group 5.
- `client/src/ui/States.tsx:137,146`: hard-coded `#0b1524` / `#9fb0c3`; use the tokens (nit).
- Pre-existing: `about.contactPlaceholder` = `support@izgo.example` is in the bundle. Group 9.

### redesign-driver `cdc64dc..4922a11` (2 commits): GREEN

OK
- typecheck and build pass; `dist` clean (test panel and `/sinov/ui` gallery only behind `DEMO_MODE`).
- Fonts bundled locally; new strings in uz/ru/en; `cap sync` passes, no native changes.
- Commission % and wallet values are rendered from data (`l.commissionPct`, `w.commission.*`), nothing calculated.
- Floating Ink tab bar Asosiy / Hamyon / Tarix / Profil, offline banner, states: match the design.
- Default theme changed from night to light (design v2: light map and white sheets). Intended.

To fix (nit)
- Hard-coded colours instead of tokens: `driver/src/components/OfflineBanner.tsx:20` (`#3A2410`), `driver/src/features/wallet/WalletScreen.tsx:91` (`#F97066`), `driver/src/components/Switch.tsx:28`.

### redesign-admin `cdc64dc..c0cc33e` (2 commits): YELLOW

OK
- typecheck and build pass; `dist` has no test panel text.
- Fonts bundled locally. Sidebar groups Asosiy / Pul / Jamoa; no "Tasdiqlar" route or menu item.
- `ChangeConfirmModal` (old → new, Bekor qilish / Tasdiqlash, audit note) matches the 2-step decision.
- `MaskedPhone` never masks on the client; the reveal asks the server. (Superseded in round 2: admin shows full phones.)
- Header search: `ApiAdapter.globalSearch` with mock + http, hidden by `capabilities.globalSearch=false`, documented.

Must be done in group 4 (Money)
- The two-person approval flow is still in the adapter and screens: `admin/src/api/adapterTypes.ts:136,145` (`approveAdjustment`, `approveTariffProposal`), `admin/src/api/adapters/http.ts:527-581`, `admin/src/api/adapters/mock.ts:386-411,1001,1127` (`tariff_second_approve`, `wallet_adjust_second_approve`), `admin/src/features/tariffs/TariffsScreen.tsx:180`, `admin/src/features/wallet/WalletScreen.tsx:122`. Replace with Save → `ChangeConfirmModal` → Confirm (one request).

To fix in a later group
- Old colours: `admin/src/components/MapView.tsx:27,30`, `admin/src/features/dashboard/StatsScreen.tsx:25-26`. Group 3.
- Hover colours hard-coded: `admin/src/components/Button.tsx:28,33`, `admin/src/components/DataTable.tsx:161` (nit).

Process notes
- Admin wrote its backend gaps to `docs/backend-gaps/admin.md` (section "Redesign v2"), not to `docs/backend-gaps.md`. That file is the existing per-app detail file, so this is the better place. Client and driver should do the same (`docs/backend-gaps/<app>.md`, section `## Redesign v2`); the reviewer keeps the index in `docs/backend-gaps.md`.
- Open question for the owner: "Shikoyatlar" (complaints) is in the sidebar but not among the 20 design pages. Kept for now (rule 2: nothing disappears).

### Not checked this round
- Real device / simulator keyboard behaviour (client `@capacitor/keyboard`).
- Pixel comparison of full screens: group 1 has no full screens yet, only the kit galleries.
