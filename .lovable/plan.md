## Goal

Make the GitHub debug APK workflow stop failing falsely, produce useful logs when a real Android error happens, and add guardrails so future app changes are caught earlier.

## Root cause found

The current debug build command pipes Gradle output through `grep -vE ...` with `set -o pipefail`:

```bash
./gradlew ... 2>&1 | grep -vE '...filtered notes...' || exit $?
```

If Gradle succeeds but the only output is filtered Java `Note:` lines, `grep` returns exit code `1` because it printed no lines. With `pipefail`, the whole step fails even though the APK build can be successful. That matches your log: no real Gradle error is shown, only `Process completed with exit code 1`.

## Implementation plan

1. **Fix false failure in Debug APK build**
  - Replace `grep -vE ... || exit $?` with a safe Bash pattern that always exits with Gradle’s status, not the filter’s status.
  - Keep log filtering, but use `tee + sed` or explicit `PIPESTATUS[0]` so “no printable output” does not fail the workflow.
  - Save the raw Gradle output to a file such as `android/build-debug.raw.log`.
2. **Apply the same safe logging to signed release builds**
  - The release build uses the same fragile pipe pattern.
  - Harden it the same way so release APK builds do not get false failures either.
3. **Make real Gradle failures diagnosable**
  - On failure, print a clear tail of the raw Gradle log.
  - Re-run or append a diagnostic command with `--stacktrace` only when the first build fails, so normal runs stay fast but failures become actionable.
  - Upload raw logs as artifacts on failure, not only Gradle report folders that may be empty.
4. **Add a Debug APK preflight/doctor step**
  - Before `assembleDebug`, verify:
    - `android/gradlew` exists and is executable.
    - Node modules for Capacitor Android plugins exist after install.
    - `android/app/src/main/assets/public` exists after `cap sync android`.
    - SDK 36 and build-tools 36 are available.
    - expected Gradle files exist: `android/build.gradle`, `android/app/build.gradle`, `android/variables.gradle`.
  - Fail early with a readable message if the project is out of sync.
5. **Add a local CI helper script**
  - Move the repeated debug/release Gradle wrapper logic into a small script, for example `scripts/ci/run-gradle-apk.sh`.
  - This avoids duplicated brittle pipe logic in YAML and makes future fixes safer.
  - Workflow calls the script for `debug` or `release`.
6. **Improve APK artifact resilience**
  - After the build, list discovered APK paths before selecting the final APK.
  - If expected output path changes after Gradle/Capacitor updates, the workflow will show exactly what was produced.
7. **Verification after implementation**
  - Run a local syntax check on the helper script.
  - Run the project build check for web bundle warnings.
  - Do not claim native CI is fully fixed until the GitHub workflow is re-run, because the real APK runner environment is GitHub Actions.

## Expected result

- The current false debug APK failure should stop.
- If a real Gradle/Kotlin/AAPT error happens later, the workflow will show the exact failing lines instead of only `Process completed with exit code 1`.
- Debug APK builds become more stable across frequent website/app changes.

## Important note

No one can honestly guarantee a workflow will “never fail” after future dependency, SDK, or code changes. This plan makes failures much less likely and makes any real future failure immediately visible and fixable.

&nbsp;

Use skills when you require. Must Use Capicitor skill  
**Progress tracker:**  
- [ ] 1. webapp-to-capacitor  
- [ ] 2. capacitor-best-practices  
- [ ] 3. capacitor-deep-linking  
- [ ] 4. capacitor-keyboard  
- [ ] 5. capacitor-offline-first  
- [ ] 6. capacitor-performance  
- [ ] 7. capacitor-plugins  
- [ ] 8. capacitor-security  
- [ ] 9. capacitor-splash-screen  
- [ ] 10. capacitor-testing  
- [ ] 11. debugging-capacitor  
- [ ] 12. ionic-design  
- [ ] 13. ios-android-logs  
- [ ] 14. safe-area-handling  
- [ ] 15. tailwind-capacitor  
- [ ] 16.capacitor-back-button  
- [ ] 17.asset-optimization  
- [ ] 18.senior-architect-audit  
- [ ] 19.capacitor-video-player-master