#!/usr/bin/env bash
# Installs the debug APK on the running emulator, launches the main activity and
# fails if the process dies, ANRs, or logs a fatal exception. Run from the repo
# root inside reactivecircus/android-emulator-runner (adb is already on PATH and
# the device is booted).
set -euo pipefail

OUT="android/app/build/outputs/apk/debug"
# CI renames the Gradle output to the product name; a plain local
# `./gradlew assembleDebug` still leaves app-debug.apk. Accept either.
APK="$OUT/Naveen-Bharat.apk"
[ -f "$APK" ] || APK="$OUT/app-debug.apk"
PKG="$(grep -m1 'applicationId' android/app/build.gradle | sed -E 's/.*"(.*)".*/\1/')"
: "${PKG:?could not read applicationId from android/app/build.gradle}"

echo "==> Package: $PKG"
test -f "$APK" || { echo "::error::APK missing at $APK"; exit 1; }

adb wait-for-device
adb shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 2; done'
adb logcat -c

echo "==> Installing"
adb install -r -g "$APK"

echo "==> Launching"
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null

# The GitHub runner emulator can stall for minutes between install and launch, so
# poll for a live process instead of assuming a fixed cold-start window.
echo "==> Waiting for the process to come up (up to 120s)"
PID=""
for i in $(seq 1 40); do
  PID="$(adb shell pidof "$PKG" | tr -d '\r' || true)"
  if [ -n "$PID" ]; then break; fi
  # A hard crash shows up in logcat immediately — fail fast instead of waiting.
  # Scope this to OUR package: the emulator's shared logcat routinely contains
  # fatals from unrelated system apps, which would abort the poll on iteration 1.
  if adb logcat -d -v brief | grep -E -A 4 "FATAL EXCEPTION|ANR in " | grep -q "$PKG"; then break; fi
  sleep 3
done

if [ -z "$PID" ]; then
  echo "::error::$PKG never came up — it crashed on boot or failed to launch."
  adb logcat -d -v brief | grep -Ei "$PKG|FATAL EXCEPTION|AndroidRuntime|Capacitor" | tail -n 120
  exit 1
fi
echo "Alive as pid $PID"

# Let the WebView finish loading the bundled assets and the Capacitor bridge,
# then confirm the process survived that window (catches delayed JS crashes).
sleep 20
PID="$(adb shell pidof "$PKG" | tr -d '\r' || true)"
if [ -z "$PID" ]; then
  echo "::error::$PKG died while loading the web assets."
  adb logcat -d -v brief | grep -Ei "$PKG|FATAL EXCEPTION|AndroidRuntime|Capacitor|net::ERR_" | tail -n 120
  exit 1
fi

echo "==> Scanning logcat for fatals"
LOG="$(adb logcat -d -v brief)"
if printf '%s' "$LOG" | grep -E -A 4 "FATAL EXCEPTION|ANR in |E AndroidRuntime" | grep -q "$PKG"; then
  echo "::error::fatal exception during boot"
  printf '%s' "$LOG" | grep -E -A 30 "FATAL EXCEPTION|E AndroidRuntime" | head -n 120
  exit 1
fi

# A blank white screen usually shows up as the WebView failing to load index.html.
if printf '%s' "$LOG" | grep -Eq "net::ERR_|Failed to load resource: file:///android_asset"; then
  echo "::error::WebView failed to load bundled assets — check cap sync / dist output"
  printf '%s' "$LOG" | grep -E "net::ERR_|android_asset" | head -n 40
  exit 1
fi

echo "✅ APK boots cleanly on the emulator."

# ---------------------------------------------------------------------------
# App Links only verify when assetlinks.json carries the SHA-256 of the cert
# the installed APK is actually signed with. A rebuilt debug keystore silently
# breaks every https:// deep link, so assert the match here.
# ---------------------------------------------------------------------------
FP=""
# apksigner reads the v2/v3 APK Signature Scheme blocks; keytool only sees the
# legacy v1 JAR signature, which Gradle no longer always writes. Try both, and
# never let the extraction itself abort the smoke test.
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
APKSIGNER="$(ls "$SDK_ROOT"/build-tools/*/apksigner 2>/dev/null | tail -n 1 || true)"
if [ -n "$APKSIGNER" ]; then
  FP="$("$APKSIGNER" verify --print-certs "$APK" 2>/dev/null | grep -m1 -i "SHA-256 digest" | sed -E 's/.*: *//' | tr -d ' \r' || true)"
  # apksigner prints the digest unseparated; assetlinks stores colon-separated.
  if [ -n "$FP" ]; then
    FP="$(printf '%s' "$FP" | tr 'a-f' 'A-F' | sed -E 's/(..)/\1:/g; s/:$//')"
  fi
fi
if [ -z "$FP" ] && command -v keytool >/dev/null 2>&1; then
  FP="$(keytool -printcert -jarfile "$APK" 2>/dev/null | grep -m1 "SHA256:" | sed 's/.*SHA256: *//' | tr -d ' \r' || true)"
fi

if [ -z "$FP" ]; then
  echo "⚠️  could not read the APK signing certificate — skipping the assetlinks cross-check."
else
  echo "==> APK signing SHA-256: $FP"
  if ! grep -qi "$FP" public/.well-known/assetlinks.json; then
    echo "::error::APK fingerprint $FP is not in public/.well-known/assetlinks.json — Android App Links will not verify."
    exit 1
  fi
  echo "Fingerprint matches assetlinks.json."
fi

# ---------------------------------------------------------------------------
# Deep-link smoke: the manifest claims a custom scheme and Android App Links.
# A typo in either intent-filter is invisible to a plain launch test.
# ---------------------------------------------------------------------------
echo "==> Deep link: com.naveenbharat.app://buy-course"
adb shell am start -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE \
  -d "com.naveenbharat.app://buy-course" >/tmp/deeplink.out 2>&1 || true
cat /tmp/deeplink.out
if grep -qi "Error\|Activity not started, unable to resolve" /tmp/deeplink.out; then
  echo "::error::custom-scheme deep link did not resolve to $PKG"
  exit 1
fi

sleep 6
PID="$(adb shell pidof "$PKG" | tr -d '\r' || true)"
if [ -z "$PID" ]; then
  echo "::error::$PKG died handling the deep link."
  adb logcat -d -v brief | grep -Ei "$PKG|FATAL EXCEPTION|AndroidRuntime" | tail -n 80
  exit 1
fi

echo "==> Declared App Link domains"
adb shell pm get-app-links "$PKG" || true

echo "✅ Deep links resolve and the app survives them."
