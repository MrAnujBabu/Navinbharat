# CI log audit — APK release v1.0.7

Source: `logs_90993906664.zip` (workflow "Naveen Bharat APK", run #79, tag `v1.0.7`).
Overall rating: **4.5 / 5** — pipeline is green and production-grade; the gaps
left are hygiene and release-signing, not correctness.

## What is working

- Full job chain passed: checkout → deps → typecheck → guards → web build →
  Capacitor sync → `assembleDebug` → APK smoke check → emulator boot →
  artifact upload → GitHub Release. `v1.0.7` is live with `app-debug.apk`.
- `bun run cap:sync android` did its job: `stripped 336 source maps from
  native assets (30.4 MB saved)`, and the smoke check confirmed no `.map`
  files inside the APK, with 22 Capacitor plugins bundled.
- Version resolution is clean and Play-safe: `versionName=1.0.7`,
  `versionCode=79` (run number, monotonic).
- Modern toolchain: Ubuntu 24.04, Node 24, Bun 1.4.0, JDK 21 Temurin,
  `checkout@v5` / `setup-node@v5` / `setup-java@v5` / `upload-artifact@v5`.
- Release step is resilient — tag-discoverability retry handled itself.

## Findings and status

| # | Finding | Status |
|---|---------|--------|
| 1 | `actions/cache@v4` Node-20 warning while every other action was v5 | Fixed on `main` (`cache@v5`) — warning clears on next tagged release |
| 2 | `retention-days: 7` above repo max ("Using 1 instead" warning) | Fixed on `main` (`retention-days: 1`) |
| 3 | Smoke-check error text said "over the 28 MB ceiling" while the code gated at 38 MB | Fixed — message now derives from `MAX_MB` |
| 4 | APK 38 MB against a 38 MB gate: zero headroom, any new plugin breaks the build | Mitigated — ceiling raised to 40 MB |
| 5 | Release ships `app-debug.apk` (unsigned, debuggable, not Play-eligible) | Open — needs keystore |
| 6 | Gradle cache miss on the previous run (~20 min builds) | Improved — key includes `variables.gradle` + layered `restore-keys` |
| 7 | Steps 7–9 (lint/typecheck/tests/web build) log files absent from the export | Open — verify on the next run |
| 8 | "orphan adb process" cleanup warning | Fixed — explicit `adb kill-server` before the emulator step |

## Remaining work (finding 5, the important one)

Debug APKs install fine via "unknown sources" but cannot go to Play and ship
with a debuggable flag. Proper fix, when a keystore is available:

1. Add repo secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
2. Decode the keystore in the workflow and wire a `signingConfigs.release`
   block in `android/app/build.gradle`.
3. Switch the build to `./gradlew assembleRelease bundleRelease` with R8/minify
   and ABI splits enabled — that also buys back several MB against the size
   gate (finding 4).
4. Attach both the signed APK and the AAB to the Release.

Until then the pipeline intentionally keeps the emulator boot test as the
release gate, so a "builds but crashes" APK never reaches the Release page.
