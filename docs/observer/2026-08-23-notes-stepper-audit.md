# Audit — 2026-08-23 — Notes sheet + page stepper pill (Obsidian pass)

**Rating: 4/5** — stepper geometry is now provably correct on both orientations and the
Obsidian export path is hardened with fallbacks; remaining gaps are polish-level
(no automated regression test for the pill geometry, debug badge is dev-only manual).

## Verification — stepper pill (mobile-view-expert)

Measured in a headless Chromium probe against the live dev server, real component,
scrolled state, `[data-page]` surface.

| Orientation | Viewport | Pill rect | Caret column | ▲ rect | ▼ rect | Both hit-testable |
|---|---|---|---|---|---|---|
| Portrait | 390×844 | h 44, w 78 | t121 b165 (h 44) | h 18 | h 18 | yes |
| Landscape | 844×390 | h 44, w 78 | t94 b138 (h 44) | h 18 | h 18 | yes |

Column height == pill height (44px) in both cases, so neither caret escapes the
`overflow-hidden` rounded mask. `elementFromPoint` at each caret centre returns the
caret itself → nothing overlays them. Screenshot evidence: `/tmp/browser/pill/portrait.png`
(both chevrons rendered inside the dark capsule, left of `2/24`).

Root cause of the original clip (fixed earlier): the global mobile rule in
`src/index.css` forced `min-height: 44px` on every `button`, so two stacked carets
needed 88px inside a 44px capsule. `.nb-tap-exempt` on the caret column
(`src/components/viewer/PageIndicatorPill.tsx:485`) exempts them; the column keeps a
legal target because the whole pill is 44px tall and the scrub label carries the
primary touch area.

## Findings

### [MEDIUM] [MAINT] Pill geometry has no regression test
**Where:** `src/components/viewer/PageIndicatorPill.tsx:473-515`
**Why:** the clip was caused by a *global* CSS rule, so any future tap-target sweep can
silently re-break it and nothing fails.
**Fix (backlog):** jsdom cannot measure this; add a Playwright geometry check to the
signed-smoke job asserting `caretColumn.height <= pill.height`.

### [MEDIUM] [RELY] Obsidian deep link cannot be confirmed
**Where:** `src/lib/reader/noteExport.ts` (`launchUri`)
**Why:** `obsidian://` either resolves or silently does nothing — the web layer gets no
callback. Handled by falling back to `window.location.href` and then to a file
share/download, plus Android 11+ package visibility
(`android/app/src/main/AndroidManifest.xml:39-42`, `obsidian` scheme + `md.obsidian`).
**Status:** mitigated, not eliminated — a device without Obsidian gets the `.md` share
sheet instead of a dead tap.

### [LOW] [OBS] Debug badge is manual
**Where:** `src/components/library/reader/NotesPanel.tsx`
Tap the "Notes" title to toggle the keyboard-inset / visible-area readout. Dev-only,
not shipped in the release bundle path — fine, but it means keyboard-inset regressions
are only caught by a human looking.

### [LOW] [VIS] Toolbar row density on 360px
Formatting row + callout row consume ~88px above the textarea on small Android. Acceptable
because the sheet height is now `100dvh - keyboardInset - 12px`, but on a 360×640 device
with the keyboard open the writing area drops to ~30% of the sheet. Reference: Bear/Obsidian
mobile collapse the secondary row behind a chevron. Backlog.

## Kepano / obsidian-skills conventions applied

- YAML frontmatter with `title`, `source`, `created`, `updated`, `tags`; existing user keys
  are preserved on re-export (merge, not overwrite) — covered by unit test.
- ATX headings normalised (`##Head` → `## Head`), bullets normalised to `-`, trailing
  whitespace and 3+ blank lines collapsed, file ends with a single newline.
- Sub-folder support inside the vault (`Vault/PDF Notes/Note.md`) with a live path preview.
- `obsidian://new` for create, `obsidian://open?vault=…&file=…` for reveal.
- Wikilink `[[` autocomplete sourced from the personal library titles.

## Sentry (sentry-triage lens)

0 unresolved issues for the org at time of audit. No new breadcrumb export supplied this
turn, so nothing to bucket. The pre-existing `forwardRef` warning in the app tree
(`Function components cannot be given refs`, emitted from `App` → provider chain) is still
present in console — noise class OBS, not a crash, filed as backlog.

## Capacitor lens (capacitor-bun-apk-build)

- Manifest `<queries>` change is additive; no Gradle, plugin or version drift. No workflow
  edit needed — next `workflow_dispatch` build picks it up.
- No new Capacitor plugin added, so `capacitor.settings.gradle` / `capacitor.build.gradle`
  are untouched and no `cap sync` diff is expected beyond the web bundle.

## Wins

- Both carets provably inside the capsule, both hit-testable, both orientations.
- Notes sheet renders above the reader layer (z 79 / overlay 78) — the "can't see where to
  write" class of bug is closed.
- Keyboard-aware sheet height + `scrollIntoView` on focus and on rotation.
- Export tests: 9/9 green, covering normalisation, frontmatter merge and URI building.

## Open questions

- Should the callout row collapse behind a chevron under 380px width?
- Do we want the pill geometry assertion in the signed-smoke job, or a cheaper CSS lint
  forbidding `min-height` overrides inside `.nb-tap-exempt` subtrees?
