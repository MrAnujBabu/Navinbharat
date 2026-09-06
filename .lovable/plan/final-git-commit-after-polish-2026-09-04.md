# Final Git commit after polish

## Goal
Cut a clean, tagged release commit for the Naveen Bharat app and push it to the connected GitHub repository.

## Current state (verified)
- Working tree is clean: `git status --short` returns empty.
- TypeScript check passes (`tsc --noEmit -p tsconfig.app.json` exits 0).
- Roadmap shows lint is at 0 warnings / 0 errors and the audit is scored 5/5.
- Supabase project `cmbattmjwriiesibayfk` is connected; Razorpay secrets must be updated in the Supabase dashboard, not in code.
- GitHub remote `github.com/MrAnujBabu/Navinbharat.git` is the sync target.

## Proposed polish before commit
1. **Version bump** — move `package.json` version from `0.1.0` to a release version (suggest `1.0.0` for the first public APK release, or `0.9.0` if a final QA build is preferred).
2. **Changelog / README** — add a short `CHANGELOG.md` entry or update `README.md` with the release highlights (autoscroll verification, lint/typecheck green, APK build readiness).
3. **Final verification** — run the full test suite and build once more to confirm no regressions.

## Commit & release
1. Stage the version/changelog changes.
2. Create commit with message:
   ```
   release: v1.0.0 — polished reader, payments, and autoscroll

   - Import and integration of the Naveen Bharat Vite + Capacitor codebase
   - Supabase backend connected (project cmbattmjwriiesibayfk)
   - Autoscroll feature verified end-to-end
   - Lint and typecheck clean
   - APK build pipeline ready
   ```
3. Tag the commit as `v1.0.0` (or agreed version).
4. Push the commit and tag to `github.com/MrAnujBabu/Navinbharat.git`.

## Open items that stay out of this commit
- Razorpay live/test key rotation (done in Supabase dashboard, not code).
- Attaching the 3 approved PDFs to Amar Batch (content task in the live app).
- Sentry noise PR and 300-page reader memory re-measure (separate follow-ups).

## Technical note
Git operations (commit, tag, push) are handled by Lovable's Git sync or the user's local machine; the agent will prepare the code changes and commit message, then the user triggers the push via the Lovable GitHub connection or local CLI.
