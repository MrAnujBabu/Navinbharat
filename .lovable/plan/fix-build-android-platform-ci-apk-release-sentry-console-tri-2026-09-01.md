# Fix build → Android platform → CI + APK release → Sentry/console triage → audit

Aim: get a releasable Android APK out of this repo through GitHub Actions, then close out the 7 unresolved Sentry issues and the console noise behind them, then a final audit.

## Verified current state

- `android/` folder does **not** exist in this project → `npx cap sync android` cannot work until the platform is generated.
- `.github/workflows/` does **not** exist → there is no APK build, no Playwright, no Maestro pipeline (`e2e/` and `maestro/` folders are also absent).
- `package.json` already has `build`, `typecheck`, `lint`, `cap:sync`, `cap:android`, `guard:all`, `check:lockfile`, `test:e2e`.
- Sentry org `naveen-bharat`, project `javascript-react`: 7 unresolved issues, all last seen ~4 days ago, all 0 affected users:
  1. `TypeError: network error` (7 events, `/downloads`)
  2. `UnknownErrorException: network error` (3)
  3. `Error: TypeError: network error` (3, via `logger`) — double-report of #1
  4. `<unknown>` "Object captured as exception with keys: code, details, hint…" (3)
  5. `Error: {"code":"PGRST303","message":"JWT issued at future"}` (2)
  6. `InvalidPDFException: Invalid PDF structure.` (1, `/downloads`)
  7. `Error: Failed to connect to localhost/127.0.0.1:443` (1)
- `src/lib/sentry.ts` already has `classifyError` with a `network` bucket and a dedupe path; `src/lib/sentryTriage.ts` exists. Fixes extend these, not replace them.

## Work plan

### 1. Build green + Android platform
- Run `bun install`, `bun run typecheck`, `bun run lint`, `bun run build`, `bun run guard:all`, `bun run check:lockfile`; fix whatever fails.
- Generate the native platform with `npx cap add android`, then `npx cap sync android`.
- Pin the build so the APK is reproducible: numeric `versionName` wiring in `android/app/build.gradle`, `buildConfig` opt-out, no `minifyEnabled` on debug, keep `flatDir` for the Cordova bridge.
- Keep `webContentsDebuggingEnabled` off for release (already gated on `CAP_DEBUG`).

### 2. CI: APK build + release
New `.github/workflows/build-apk.yml` following the pinned stack: Node 24, `oven-sh/setup-bun@v2`, JDK 21 Temurin, Android SDK 35, node24-era action majors (`checkout@v5`, `setup-node@v5`, `setup-java@v5`, `cache@v5`, `upload-artifact@v6`, `download-artifact@v8`, `action-gh-release@v2`), `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"`.

Order: clean artifacts → checkout → numeric `APP_VERSION_NAME` → install → `typecheck` (tsgo, never tsc) → `build` → `cap sync android` → `gradlew assembleDebug --no-daemon --parallel --build-cache` → APK smoke check (MainActivity + `capacitor.plugins.json`) → upload artifact → GitHub Release on `v*` tags.

Second workflow `.github/workflows/playwright.yml`: Chromium-only projects, `bun install --frozen-lockfile`, `@playwright/test` presence guard, `playwright install --with-deps chromium`, build before serve.

Emulator-script rule applied preemptively: any `android-emulator-runner` script starts with `set -e`, never `set -o pipefail` (dash aborts on it).

### 3. Push to GitHub + release
Target repo: `https://github.com/MrAnujBabu/Navinbharat.git`.

Important: I cannot run `git add/commit/push` from here — this sandbox's remote is Lovable's internal git, and git state is managed by the platform. So the push happens one of two ways, your pick:
- **Lovable GitHub sync** (recommended): connect/point the project at `MrAnujBabu/Navinbharat` from the GitHub panel; everything I commit lands there automatically.
- **Your machine**: pull the Lovable code, `git remote add`/`set-url` to that repo, push `main`, then tag `v1.0.0` to trigger the release build.

Once pushed, the tag triggers the workflow and the APK is attached to the GitHub Release. I'll then monitor the run and fix failures using the CI signature table (illegal `pipefail`, node20 artifact deprecation, cold cache `tar` warning, missing APK artifact, Gradle `versionName`, plugin-not-bundled).

### 4. Sentry end-to-end resolution
Per issue, root cause → fix at the highest applicable level → verify:
- **#1/#2/#3 network error trio** — offline/flaky-data noise plus a genuine double report (thrown error *and* its `logger.error` console mirror). Fix: ensure the console-forward suppression wraps the logger path so one failure = one issue; drop reports when `navigator.onLine === false`; group remaining ones per upstream host so they read as availability telemetry, not app crashes.
- **#4 `<unknown>` object-with-keys** — a Supabase `PostgrestError` thrown as a bare object. Fix: normalize Postgrest errors into a real `Error` (message + code + hint as tags) before reporting, so the issue is titled and actionable.
- **#5 PGRST303 "JWT issued at future"** — device clock skew rejecting the access token. Fix: detect this code in the Supabase fetch/auth middleware, refresh the session once, and surface a "check device date & time" message instead of reporting it as an app error.
- **#6 InvalidPDFException** — non-PDF bytes reached the reader/offline save. Fix: reject responses whose first bytes aren't `%PDF` (and whose content-type isn't a PDF) before caching, show the reader's error state, and stop reporting it as an exception.
- **#7 Failed to connect to localhost:443** — a native WebView request against `localhost` (dev/sandbox origin leaking into a native build). Fix: trace the caller, force absolute Supabase/CDN origins in native builds, and filter this signature as environment noise.
- Then mark each issue resolved in Sentry, and keep `scripts/sentry-smoke.ts` wired into the release workflow so a broken DSN can't silently hide prod errors.
- Report written to `docs/observer/2026-09-01-sentry-triage.md`.

### 5. Console error triage
Walk every real `console.error` on the boot + `/downloads` + reader paths through capture → classify → locate → categorize → fix at the right level → verify. Bare `console.error(err)` in touched files becomes `reportError(err, { surface })`; provable noise gets narrow, source-local suppression only. Output a triage table in `docs/observer/2026-09-01-console-triage.md`.

### 6. Final audit
Senior-architect audit (12 categories, engineering + visual/motion) over the changed surfaces + the new CI, with severity-tagged findings, `file:line`, a rating out of 5, wins, and a fix plan. Written to `docs/observer/2026-09-01-final-audit.md`.

## Not in this plan
- Firebase / push re-enable (`PUSH_ENABLED` stays false — no `google-services.json`).
- Signed **release** (Play Store) APK — needs your keystore + secrets; this plan ships the debug APK via Actions. Say the word and I'll add the signing job with `secrets.ANDROID_KEYSTORE_*`.
- Supabase migrations / edge-function deploys.
- The remaining `any`/`exhaustive-deps` lint backlog beyond files touched here.
