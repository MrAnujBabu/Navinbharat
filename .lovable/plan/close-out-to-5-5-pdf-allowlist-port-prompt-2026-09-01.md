# Close out to 5/5 + PDF allowlist port prompt

## 1. Answer: is the admin PDF tab done?

Verified now:
- **Code: done.** `src/pages/AdminTrustedHosts.tsx` manages the allowlist; `supabase/functions/pdf-proxy/index.ts` reads `public.trusted_hosts` (60s cache) and accepts both `pdf` and `frame` categories.
- **Database: not done.** The live `trusted_host_category` enum currently has `frame, image, media, website, script, connect` — no `pdf` value. The SQL sits unapplied at `docs/db/2026-08-31-trusted-hosts-pdf-category.sql`.

So the feature is code-complete but inert on the live project until the enum value and seed rows land.

## 2. Work to do

### A. Apply the pending PDF allowlist migration
Run the migration that adds the `pdf` enum value and seeds the two starter hosts (`cwmediabkt99.crwilladmin.com`, `ncert.nic.in`), then re-deploy `pdf-proxy` so it picks up the new category. Verify by reading back the rows.

### B. Reusable prompt for your other project
New file `docs/porting/PROMPT-admin-pdf-allowlist.md` — a copy-paste prompt describing the whole feature so another project can rebuild it: `trusted_hosts` table + category enum, admin-only RLS + grants, the admin CRUD page, the proxy edge function with cached allowlist lookup, and the accept-list behaviour.

### C. Remaining audit findings (4/5 → 5/5)
1. **[HIGH VIS]** Replace the 5 hardcoded `bg-black`/`text-white` occurrences in `src/pages/Course.tsx` and `src/pages/LessonView.tsx` with a new `--video-scrim` / `--overlay` token pair in `src/index.css`, so video overlays follow the theme.
2. **[HIGH OBS]** Add an emulator boot smoke job to `.github/workflows/build-apk.yml` (`reactivecircus/android-emulator-runner`, install APK, assert no fatal exception in logcat) so a broken JS bundle can't pass as a release.
3. **[MEDIUM CONFIG]** Add the explicit "server-to-server / CI only, CORS intentionally absent" comment to `supabase/functions/security-regression/index.ts` so repo-wide CORS greps stop re-flagging it. `resolve-storage-pdf` already imports the shared CORS helper — no change needed.
4. **[MEDIUM DATA]** Add `supabase/functions/_shared/SERVICE_ROLE_USAGE.md` plus a guard script wired into `guard:all` that fails when a service-role client is created without a one-line "why RLS bypass is required" comment.
5. **[LOW UX]** Login copy/redirect mismatch: default post-login destination becomes `/dashboard` (page promises "your courses"), keeping any `location.state.from`.
6. **Login bootstrap bug** found by the e2e suite: typing during auth bootstrap is discarded. Fix by keeping the form mounted/controlled through `authLoading` instead of remounting, and add an e2e regression case that types immediately on load.

### D. Re-verify and re-audit
`bun run lint` (already at 0 warnings), `tsgo --noEmit`, `bun run build`, `bunx vitest run`, `bun run test:e2e`, then rewrite `docs/observer/2026-09-01-full-audit.md` with the closed findings and the updated rating.

## 3. What still can't happen from here

`git push` to `github.com/MrAnujBabu/Navinbharat.git`, the tagged APK release, and Sentry issue resolution against the live org need your machine or the GitHub sync — this sandbox's git remote is Lovable-internal and has no JDK/Android SDK. Everything above is committed here so a `v*` tag on your side triggers `build-apk.yml`.

## Technical notes

- Migration is enum + seed only; `ADD VALUE IF NOT EXISTS` on an existing type, no table rewrite. Enum additions can't run inside a transaction with dependent inserts in some Postgres versions — the seed insert runs as a separate statement.
- Scrim token: `--video-scrim` defined per theme in `src/index.css`, consumed as `bg-[hsl(var(--video-scrim))]` so dark mode adapts.
- The service-role guard script is a `rg`-based check, matching the existing `scripts/guard-*` pattern.
