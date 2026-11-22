# IZGO mobile apps (Capacitor)

Two native apps are built from the web apps:

| App | Folder | App ID | Name |
|---|---|---|---|
| Passenger | `client/` | `uz.izgo.client` | IZGO |
| Driver | `driver/` | `uz.izgo.driver` | IZGO Driver |

The admin panel is a website on Vercel (`admin.xasanow.uz`), not a native app.

## Configuration

Each app's `.env.local` (gitignored):

```
VITE_API_URL=https://api.xasanow.uz
VITE_DEMO_MODE=false
VITE_MAPBOX_TOKEN=pk....
```

Public site links (`/terms`, `/privacy`, and `/delete-account` in the driver app) open `https://xasanow.uz` in the system browser. The default is in each app's `src/config.ts` (`SITE_URL`); `VITE_SITE_URL` overrides it. `check:no-network` accepts only this origin as a plain link, never in `connect-src`, and in sources only as the bare origin in `src/config.ts`.

Release builds stop if `VITE_DEMO_MODE` is not `false` or if the test panel is found in `dist/`.

Backend must allow these origins (Kong CORS and `WS_ALLOWED_ORIGINS`): `capacitor://localhost` (iOS) and `https://localhost` (Android).

## Release builds

```
bash scripts/release.sh android   # signed .aab files -> release-output/
bash scripts/release.sh ios       # build, sync, open Xcode
```

Android needs Android Studio installed and opened once (SDK + Java).
On the first run the script creates the upload key `~/izgo-keys/izgo-release.jks`
and asks for a password. **Keep the key file and password safe and backed up** —
without them the apps cannot be updated. The key is outside the repo; the generated
`android/keystore.properties` files are gitignored.

iOS: in Xcode select your Team under Signing & Capabilities (both apps), then
Product → Archive → Distribute App → App Store Connect.

## What is set up

- App icons and splash screens from `brand/izgo-logo.jpeg` (blue background `#264C9F`).
- Location permission (foreground only) on Android and iOS, Uzbek permission texts.
- Portrait only. `ITSAppUsesNonExemptEncryption = false` (no export-compliance question).
- Android: versionName 1.0.0 / versionCode 1, release signing from `keystore.properties`.
- iOS: version 1.0 / build 1.

Bump `versionCode` (Android, `android/app/build.gradle`) and the build number (Xcode)
for every new upload.

## Not done yet

- **Push notifications** — needs Firebase files and a backend endpoint for device tokens
  (see `docs/backend-gaps.md`). When ready: install `@capacitor/push-notifications`,
  put `google-services.json` in `android/app/` and `GoogleService-Info.plist` in
  `ios/App/App/` (both gitignored), enable Push Notifications capability in Xcode.
- **Background location for drivers** — not requested; needs a product decision and
  extra store review.
- **Secure token storage** (Keychain/Keystore) — planned (security item F-27).
