#!/usr/bin/env bash
# IZGO release build for the mobile apps (client + driver).
#   bash ~/itax_frontend/scripts/release.sh android   -> signed .aab files for Google Play
#   bash ~/itax_frontend/scripts/release.sh ios       -> builds and opens Xcode (then Product > Archive)
#   bash ~/itax_frontend/scripts/release.sh all
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}"
KEYDIR="$HOME/izgo-keys"
KEYSTORE="$KEYDIR/izgo-release.jks"
OUT="$ROOT/release-output"
mkdir -p "$OUT"

# Java from Android Studio, Android SDK default location
if [ -z "${JAVA_HOME:-}" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
[ -n "${JAVA_HOME:-}" ] && export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

build_web() {
  local app="$1"
  echo "==> [$app] npm install + production build"
  cd "$ROOT/$app"
  grep -q '^VITE_DEMO_MODE=false' .env.local || { echo "!! $app/.env.local must have VITE_DEMO_MODE=false"; exit 1; }
  npm install --no-audit --no-fund
  npm run build
  if grep -rq "Sinov paneli" dist/assets; then echo "!! $app: demo code found in dist, stopping"; exit 1; fi
}

setup_keystore() {
  command -v keytool >/dev/null || { echo "!! Java not found. Install Android Studio first."; exit 1; }
  if [ ! -f "$KEYSTORE" ]; then
    echo "==> Creating the Google Play upload key: $KEYSTORE"
    echo "    Choose a strong password and WRITE IT DOWN. Losing it = you cannot update the apps."
    mkdir -p "$KEYDIR" && chmod 700 "$KEYDIR"
    read -r -s -p "New key password (min 6 chars): " P; echo
    read -r -s -p "Repeat password: " P2; echo
    [ "$P" = "$P2" ] || { echo "!! Passwords differ"; exit 1; }
    keytool -genkeypair -v -keystore "$KEYSTORE" -alias izgo -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass "$P" -keypass "$P" -dname "CN=IZGO, O=IZGO, C=UZ"
  else
    read -r -s -p "Key password for $KEYSTORE: " P; echo
  fi
  for app in client driver; do
    local f="$ROOT/$app/android/keystore.properties"
    printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=izgo\nkeyPassword=%s\n' "$KEYSTORE" "$P" "$P" > "$f"
    chmod 600 "$f"
  done
}

android() {
  [ -d "$ANDROID_HOME" ] || { echo "!! Android SDK not found at $ANDROID_HOME. Install Android Studio and open it once."; exit 1; }
  setup_keystore
  for app in client driver; do
    build_web "$app"
    echo "==> [$app] cap sync android + bundleRelease"
    npx cap sync android
    echo "sdk.dir=$ANDROID_HOME" > android/local.properties
    (cd android && ./gradlew --no-daemon bundleRelease)
    cp android/app/build/outputs/bundle/release/app-release.aab "$OUT/izgo-$app.aab"
  done
  echo "==> Done: $OUT/izgo-client.aab and $OUT/izgo-driver.aab (upload to Google Play Console)"
}

ios() {
  for app in client driver; do
    build_web "$app"
    echo "==> [$app] cap sync ios"
    npx cap sync ios
  done
  echo "==> Opening both apps in Xcode. In each: Signing & Capabilities -> Team, then Product -> Archive -> Distribute App."
  (cd "$ROOT/client" && npx cap open ios)
  (cd "$ROOT/driver" && npx cap open ios)
}

case "$TARGET" in
  android) android ;;
  ios) ios ;;
  all) android; ios ;;
  *) echo "usage: release.sh android|ios|all"; exit 1 ;;
esac
