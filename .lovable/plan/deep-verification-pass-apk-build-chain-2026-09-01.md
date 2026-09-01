# Deep verification pass + APK build chain

## What the screenshots actually show

The failing terminal is a **Replit workspace** (`~/workspace`, `replit.com/@anujk...`), a pnpm monorepo with `artifacts/api-server`, `artifacts/mockup-sandbox`, `scripts` packages. That is **not this project**. Three separate failures there:

1. `bun install` → the repo's `preinstall` script refuses bun ("Use pnpm instead") and exits 1.
2. `bun run build` → `artifacts/mockup-sandbox` `vite build` dies with `PORT environment variable is required`, so pnpm's recursive run fails first (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`).
3. `npx cap sync android` → npm chokes on an invalid package name `esbuild>@esbuild/darwin-arm64` (a corrupted/overrides entry in that repo's package.json).

This project (`naveen-bharat`) is a single-package Vite + Capacitor 7 app with `android/` present and no `preinstall` guard, so none of those three failures apply here. I will confirm that by running the exact chain locally rather than assuming.

## Plan

### 1. Run the requested chain here and prove it clean
- `bun install`
- `bun run build`
- `npx cap sync android`
- Then the repo health gates: `bun run lint`, `bun run typecheck`, `vitest run`, `bun run guard:all`.
- Fix anything that fails. Report the exact command output.
- `git add/commit/push origin main` cannot run from this sandbox (git state is managed by Lovable and the remote is internal). Push happens via the GitHub sync / your machine — I will tell you exactly what to run and which tag to cut.

### 2. Guidance for the Replit copy (no code changes here)
Short written fix list for that workspace: use `pnpm install` (not bun) because of the preinstall guard, set `PORT` before building `mockup-sandbox` or exclude it with a filter, and remove the malformed `esbuild>@esbuild/darwin-arm64` dependency entry before `cap sync`.

### 3. Sentry deep triage
- Pull unresolved issues for the project, bucket them (SEC / DATA / RELY / PERF / OBS / UX), and root-cause each to a `file:line` via ripgrep. Anything I cannot map gets marked UNMAPPED rather than guessed.
- Write the report to `docs/observer/2026-09-01-sentry-triage.md` in the skill's required format (summary table, breadcrumb-only warnings, P0/P1/P2 fix plan, wins, open questions).
- Apply P1/P2 low-risk fixes; surface any P0 security/GRANT/RLS item for your approval before touching it.

### 4. Safe-surface audit
Check every protected surface (PDF reader, video player, paid content routes) against the safety kit: `useProtectedSurface` instead of raw `useScreenProtection`, mount-guarded async setters, `SafeBoundary` wrapping, no hardcoded `text-white` on locked/buy CTAs. Fix violations.

### 5. Accessibility pass
Audit critical items first — missing `alt`, icon-only buttons without `aria-label`, unlabeled inputs, click handlers on non-interactive elements, `aria-hidden` over focusable children — then warnings (heading order, `h-screen` vs `h-dvh`, tap targets < 44px, focus-visible). Fix criticals in this pass, report the rest.

### 6. Final holistic audit
Combined senior-engineer + senior-designer report across the 12 categories with a 1–5 rating, written to `docs/observer/2026-09-01-full-audit.md` (updating the existing file), including the CI/APK build-chain state.

## Technical notes
- No stack pin changes: Node 24 / Bun / JDK 21 / SDK 35 / Gradle 8.11.1 stay as-is in `.github/workflows/build-apk.yml`; `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` stays.
- The "Node.js 20 is deprecated" and "Cache Android SDK … tar exit code 2" annotations are known non-blocking; I will not rewrite the workflow over them.
- `versionName` must stay numeric — the APK build takes it from the `v*` tag / dispatch input, never `main`.
