# Observer Report — 2026-08-21 — reader rotation / landscape session

**Window observed:** this session (landscape rotation → chrome rotation), plus carry-over from the 2026-08-20 reader turns
**Scope:** PDF reader landscape, rotation frame, My Library import, pdf-proxy warm cache, assetlinks

## Incomplete

- [ ] **Landscape geometry never verified end-to-end** — evidence: "I couldn't complete the live device-emulated login check — the sandbox login run kept timing out on the auth redirect". Root cause is now known: `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged`, so no managed session can be injected and the UI login is the only path — it does not complete reliably in the sandbox. Next action: run `e2e/reader-landscape-visual.spec.ts` in CI where credentials work, or smoke it on a device with the checklist below.
- [ ] **Rotated-frame portal gap** — the Notes sheet and sonner toasts still portal to `document.body`, outside the rotation frame (`src/components/library/DocReaderShell.tsx:574-589`). Same bug class the session fixed for the FAB and page chip. Filed HIGH in the audit.
- [ ] **Safe-area axes inside the rotated frame** — FAB/chip/speed-sheet still use `env(safe-area-inset-bottom|right)` on rotated edges (`AutoScrollFab.tsx:250`, `PageIndicatorPill.tsx:434`, `AutoScrollSheet.tsx:323`). Invisible on Android (insets 0), wrong on iOS.

## Follow-ups deferred

- [ ] **Fresh APK run** — user was asked to `git pull && npx cap sync android` and confirm rotated chrome. Blocker: no device in the sandbox.
- [ ] **Leaked-password protection** — still a manual Supabase dashboard toggle, carried from the security turn; unchanged in `docs/audit/INDEX.md`.
- [ ] **Reader page-bridge failure counter** in `/debug/diagnostics` — still listed as pending in `docs/audit/INDEX.md`.

## Linked to current work

- Rotation frame ↔ the 2026-08-20 fullscreen/resume turn — both re-measure the surface after a layout swap; the fullscreen re-measure effect (`DocReaderShell.tsx:234-240`) exists specifically because the earlier turn's fix did not cover locally-stored My Library docs.
- White-strip fix ↔ the earlier hardcoded 48px offset — now measured via `ResizeObserver` (`:65-76`), which is what actually resolved the notched-device strip.
- `pdf-proxy` warm cache ↔ the perf turn for Vedantu/Archive.org — the fast path 302s to a signed URL; this session's audit shortened that URL's life from 6h to 30min.

## Dropped

- Nothing the user asked for in this session went unaddressed. The 20x autoscroll chip, minimal page chip, fullscreen icon, resume-blank-page recovery, assetlinks fingerprint and "Add to My Library" fix were all applied and verified in-repo.

## Risks / ignored findings

- **Timer-based re-measure** (220ms / 260ms) after rotation and fullscreen — accepted because it is cheap and always cleared, but a slow device can settle after the timer and keep one stale measurement.
- **Pseudo-landscape only exists because the OS lock can fail** — on device the native lock usually succeeds, so the CSS path (and its portal/inset quirks) may be near-dead code in production. Worth confirming before investing more in it.
- **`external_unmanaged` Supabase** means no automated authenticated E2E in this sandbox at all — every "verified in browser" claim for logged-in surfaces is weaker than it looks.

## Repo cross-check (claims vs disk)

| Claim | Status |
| --- | --- |
| `src/lib/rotationFrame.ts` created | present, 72 lines |
| `usePortalHost` tracks rotation frame | present, `src/hooks/usePortalHost.ts:14-27` |
| Landscape visual regression spec | present, `e2e/reader-landscape-visual.spec.ts` |
| Assetlinks real SHA-256 | present in `public/.well-known/assetlinks.json` |
| `pdf-cache` bucket private | confirmed via `storage.buckets` query |
| Tests green | 412 passed / 7 skipped, build OK |

## Device smoke checklist (stand-in for the missing verification)

1. Open a My Library PDF → tap rotate → header, back arrow, autoscroll FAB and page chip must all read landscape with the page.
2. Page must fill the full width (no black side bars), no white strip above the header.
3. Rotate back → chrome upright, page re-measures within ~1s.
4. Open Notes while rotated → note whether the sheet is upright (known HIGH finding).
5. Background the app 5 min → resume → page renders, no blank screen.

## Notes on visibility

Tool activity (file edits, migrations, security scans, Playwright runs) is not in the chat search index; every claim above was cross-checked against the repo or the database directly.
