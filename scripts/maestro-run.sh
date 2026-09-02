#!/usr/bin/env bash
# Install an APK on the connected device/emulator and run the Maestro suite.
#
#   scripts/maestro-run.sh                    # all flows, uses build/app-*.apk if present
#   scripts/maestro-run.sh --tags smoke       # smoke pair only
#   APK=/path/to/Naveen-Bharat.apk scripts/maestro-run.sh
#
# Credentials: export MAESTRO_EMAIL / MAESTRO_PASSWORD. Flows degrade to
# public-surface assertions when they are unset, so a missing secret never
# turns into a silent green run on the authenticated paths.
set -euo pipefail

APP_ID="com.naveenbharat.app"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro not found. Install it with:"
  echo "  curl -Ls https://get.maestro.mobile.dev | bash"
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found — start an Android emulator or connect a device first."
  exit 1
fi

if [ -z "$(adb devices | awk 'NR>1 && $2=="device"')" ]; then
  echo "No Android device/emulator is connected (adb devices is empty)."
  exit 1
fi

APK="${APK:-}"
if [ -z "$APK" ]; then
  APK="$(ls -t android/app/build/outputs/apk/*/*.apk 2>/dev/null | head -n1 || true)"
fi

if [ -n "$APK" ] && [ -f "$APK" ]; then
  echo "Installing $APK"
  adb install -r -g "$APK"
else
  echo "No APK given and none built — expecting $APP_ID to already be installed."
  adb shell pm list packages | grep -q "$APP_ID" || {
    echo "$APP_ID is not installed. Build one first: bun run build && bun run cap:sync && (cd android && ./gradlew assembleDebug)"
    exit 1
  }
fi

mkdir -p maestro-artifacts
export MAESTRO_CLI_NO_ANALYTICS=1

echo "Running Maestro flows…"
maestro test .maestro \
  --format junit \
  --output maestro-artifacts/report.xml \
  "$@"
