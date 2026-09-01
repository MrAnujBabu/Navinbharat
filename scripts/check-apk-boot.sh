#!/usr/bin/env bash
# Installs the debug APK on the running emulator, launches the main activity and
# fails if the process dies, ANRs, or logs a fatal exception. Run from the repo
# root inside reactivecircus/android-emulator-runner (adb is already on PATH and
# the device is booted).
set -euo pipefail

APK="android/app/build/outputs/apk/debug/app-debug.apk"
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

# Give the WebView time to load the bundled assets and run Capacitor bridge init.
sleep 25

echo "==> Checking process is alive"
PID="$(adb shell pidof "$PKG" | tr -d '\r' || true)"
if [ -z "$PID" ]; then
  echo "::error::$PKG is not running 25s after launch — it crashed on boot."
  adb logcat -d -v brief | tail -n 200
  exit 1
fi
echo "Alive as pid $PID"

echo "==> Scanning logcat for fatals"
LOG="$(adb logcat -d -v brief)"
if printf '%s' "$LOG" | grep -Eq "FATAL EXCEPTION|ANR in $PKG|E AndroidRuntime"; then
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
