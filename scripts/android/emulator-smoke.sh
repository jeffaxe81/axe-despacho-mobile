#!/usr/bin/env bash
# Synthetic Android emulator smoke: APK startup/lifecycle and defensive defaults.
# No credentials, real incidents, GPS coordinates or backend access are used.
set -Eeuo pipefail

APK="artifacts/android-apk/app-debug.apk"
PKG="com.axesistemas.axedespacho"
ACTIVITY="com.axesistemas.axedespacho/.MainActivity"
OUT="artifacts/android-emulator-smoke"
mkdir -p "$OUT"

fail() {
  printf 'ANDROID_EMULATOR_SMOKE_FAIL: %s\n' "$*" >&2
  exit 1
}
command -v adb >/dev/null || fail "ADB not installed"
test -s "$APK" || fail "Debug APK not found: $APK"

adb wait-for-device
API="$(adb shell getprop ro.build.version.sdk | tr -d '\r[:space:]')"
case "$API" in
  34|35|36) ;;
  *) fail "Unexpected API level $API (expected 34, 35 or 36)" ;;
esac

echo "== Installing lab APK on emulator API $API =="
adb install -r -t "$APK" >/dev/null || fail "APK installation failed"
adb shell pm path "$PKG" | tr -d '\r' | grep -F "package:" >/dev/null ||
  fail "Package not installed"

# App must be debuggable in this test. A release package must not be substituted.
adb shell run-as "$PKG" id >/dev/null ||
  fail "Expected debug-only APK; run-as refused"

# Background location must not be requested while the operational service is
# unavailable. On this clean emulator we explicitly revoke all location grants.
if adb shell dumpsys package "$PKG" | grep -Fq "android.permission.ACCESS_BACKGROUND_LOCATION"; then
  fail "Premature background location permission detected"
fi
for permission in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION; do
  adb shell pm revoke "$PKG" "android.permission.$permission" >/dev/null 2>&1 ||
    fail "Could not revoke lab location permission $permission"
done

start_and_verify() {
  local label="$1"
  local launch
  launch="$(adb shell am start -W -n "$ACTIVITY" 2>&1)" ||
    fail "Activity launch failed at $label: $launch"
  printf '%s\n' "$launch" > "$OUT/launch-$label.txt"
  if grep -Eq 'Error:|Exception:|Permission Denial|does not exist' <<< "$launch"; then
    fail "Unexpected Activity launch error at $label"
  fi
  local seen=""
  for _ in $(seq 1 15); do
    seen="$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r[:space:]' || true)"
    if [[ -n "$seen" ]]; then break; fi
    sleep 2
  done
  [[ -n "$seen" ]] || fail "App process not alive at $label"
  echo "SMOKE_PASS: $label: pid=$seen"
}

start_and_verify "cold-start"
sleep 4
adb shell input keyevent KEYCODE_HOME
sleep 2
start_and_verify "return-from-home"

# Screen lock must not turn a native lab APK into an operational GPS client.
adb shell input keyevent KEYCODE_POWER
sleep 2
adb shell input keyevent KEYCODE_POWER
adb shell wm dismiss-keyguard >/dev/null 2>&1 || true
start_and_verify "screen-lock-return"

# Re-launch from a killed process to exercise WebView initialization from scratch.
adb shell am force-stop "$PKG"
start_and_verify "force-stop-restart"
sleep 3

# No location foreground service is allowed to start merely by launching a
# demo APK with location permissions denied.
service_dump="$(adb shell dumpsys activity services "$PKG" 2>/dev/null || true)"
if grep -Eq 'ServiceRecord\{[^}]*AxeLocationLabService' <<< "$service_dump"; then
  fail "Lab GPS service was started without explicit user consent"
fi

adb exec-out screencap -p > "$OUT/emulator-api-$API.png" ||
  fail "Could not capture synthetic emulator screen"
test -s "$OUT/emulator-api-$API.png" || fail "Empty screenshot"

printf '{"result":"PASS","device":"android_emulator","api_level":%s,"checks":["install","debuggable","location_permission_denied","cold_start","home_return","screen_lock_return","force_stop_restart","no_automatic_gps_lab_service"],"real_environment_homologation":false,"production_approved":false}\n' "$API" \
  > "$OUT/evidence.json"
echo "ANDROID_EMULATOR_SMOKE_PASS: API $API; lab-only APK; no production authorization"
