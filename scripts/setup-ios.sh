#!/bin/bash
# IZGO: client va driver ilovalariga Capacitor (iOS + Android) qo'shadi va iOS loyihasini yaratadi.
# Ishga tushirish: bash ~/itax_frontend/scripts/setup-ios.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for APP in client driver; do
  echo ""
  echo "=== $APP ==="
  cd "$ROOT/$APP"
  echo "-> Capacitor paketlari o'rnatilmoqda"
  npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
  echo "-> Web build (ichki ma'lumot bilan, sinov uchun)"
  VITE_DEMO_MODE=true npm run build
  if [ ! -d ios ]; then
    echo "-> iOS loyihasi yaratilmoqda"
    npx cap add ios
  fi
  if [ ! -d android ]; then
    echo "-> Android loyihasi yaratilmoqda"
    npx cap add android
  fi
  npx cap sync
done

echo ""
echo "=== TAYYOR. client iOS loyihasi Xcode'da ochilmoqda ==="
cd "$ROOT/client"
npx cap open ios
