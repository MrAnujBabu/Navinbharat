# Maestro Android E2E

Black-box UI tests that run against the **installed Android app**, not the web
build. Playwright (`bun run test:e2e`) still covers the web surface; Maestro
covers what only a real WebView-in-Capacitor build can break: cold boot,
rotation, hardware back, airplane mode, and the payment sheet.

## Flows

| File | What it protects |
| --- | --- |
| `common/launch.yaml` | Cold launch with cleared state, splash actually clears, no ANR/crash dialog |
| `common/login.yaml` | Reusable sign-in; no-ops when credentials are absent |
| `01-boot.yaml` | Landing renders; background → resume does not white-screen (`smoke`) |
| `02-auth.yaml` | Login form is interactive; with creds, lands on Dashboard (`smoke`) |
| `03-library-pdf-landscape.yaml` | The v1.1.13 regression: in landscape the page chip is hidden and the notch bands are painted (no white strips) |
| `04-course-buy-sheet.yaml` | Payment surface opens and cancels back into the app |
| `05-back-button.yaml` | Hardware back never dead-ends or kills the app mid-stack |
| `06-offline.yaml` | Airplane mode shows our offline surface, not `net::ERR_*` |

## Running locally

```bash
curl -Ls https://get.maestro.mobile.dev | bash   # once
bun run build && bun run cap:sync
(cd android && ./gradlew assembleDebug)

# start an emulator or plug in a device, then:
export MAESTRO_EMAIL=...        # optional
export MAESTRO_PASSWORD=...     # optional
bun run test:maestro            # all flows
bun run test:maestro:smoke      # boot + auth only
```

`scripts/maestro-run.sh` installs the newest APK it finds under
`android/app/build/outputs/apk/`, or set `APK=/path/to/Naveen-Bharat.apk`.

## Credentials

Flows read `MAESTRO_EMAIL` / `MAESTRO_PASSWORD` from the environment — never
put an account in YAML. In CI they come from the `E2E_EMAIL` / `E2E_PASSWORD`
repository secrets. When they are unset, the authenticated flows fall back to
asserting the public surface and **skip** the reader flow rather than passing
green on a login wall.

## CI

`.github/workflows/maestro.yml` builds a debug APK and runs the suite on an
API 34 `pixel_6` emulator for every PR and push to `main`. Screenshots, the
JUnit report, and Maestro's debug bundle upload as the `maestro-android`
artifact.

The APK release workflow calls this workflow with `include_tags: smoke`, so a
red emulator run blocks the signed release build.
