# Audit: Reader rotation frame + landscape session (2026-08-21)

**Rating: 4/5** — the rotation-frame approach is the right architecture and the chrome now rotates as one unit with correct cleanup, but portalled surfaces (Notes sheet, toasts) and safe-area axes are still portrait-oriented inside the rotated frame, and the landscape geometry has never been proven on a device.

**Scope:** `src/lib/rotationFrame.ts`, `src/hooks/usePortalHost.ts`, `src/components/library/DocReaderShell.tsx`, `src/components/viewer/{ReaderOverlays,AutoScrollFab,AutoScrollSheet,ChipGrid,PageIndicatorPill}.tsx`, `src/components/video/{PdfViewer,FastPdfReader}.tsx`, `src/lib/{pdfFit,screenOrientation,fetchDocumentBlob,warmPdfSource}.ts`, `src/services/personalLibrary.ts`, `supabase/functions/pdf-proxy/index.ts`, `src/index.css` rotation rules.

## Findings

### [HIGH] [UX] Notes sheet and toasts render unrotated in pseudo-landscape
**Where:** `src/components/library/DocReaderShell.tsx:574-589` (Radix `Sheet`), plus every `sonner` toast fired from the reader (`:312`, `:350`).
**Why it matters:** Radix `SheetContent` and the sonner toaster portal to `document.body`, which is outside the rotated frame (`:370-375`). In pseudo-landscape the page is rotated 90° but the Notes sheet and every toast still slide in along the physical bottom — the exact class of mismatch this session set out to remove for the FAB/chip. The user sees a sideways page with an upright sheet across it.
**Fix:** give `SheetContent` a `container={usePortalHost()}` (Radix supports a portal container prop) and mount a reader-scoped `<Toaster/>` into the same host while `pseudoLandscape` is true, or suppress the sheet and use the in-frame notes panel in landscape.

### [MEDIUM] [VIS] Safe-area insets use the physical axis inside the rotated frame
**Where:** `AutoScrollFab.tsx:250`, `AutoScrollSheet.tsx:323`, `PageIndicatorPill.tsx:434`, `DocReaderShell.tsx:520,537`.
**Why it matters:** `rotationFrameStyle()` already remaps the notch to `padding-left` (`src/lib/rotationFrame.ts:19-28`) and `index.css` zeroes `.safe-area-top` inside the frame, but the FABs, chip and speed sheet still add `env(safe-area-inset-bottom/right)` on their own edges. After a 90° rotation those edges are the physical left/bottom, so the padding lands on the wrong side: on an iPhone the home-indicator gap appears along the wrong border and the FAB drifts. On Android insets are usually 0, which is why it has not been visible yet.
**Fix:** thread a `rotated` flag (context from the frame) and compute offsets from plain px when set, or expose `--reader-inset-bottom` on the frame and have children read the CSS var instead of `env()`.

### [MEDIUM] [SEC] Cached-PDF signed URL lived 6 hours — **fixed this turn**
**Where:** `supabase/functions/pdf-proxy/index.ts:26`.
**Why it matters:** the Vedantu/Archive fast path 302s to a Supabase signed URL. The enrollment gate (`authorizeUrl`) runs before the redirect, but the redirect target itself is a bearer URL anyone can replay. A 6-hour TTL made paid notes shareable in a WhatsApp group for most of a study day.
**Fix applied:** TTL reduced to 30 minutes (longer than any reading session, short enough that a leaked link dies fast). `pdf-cache` bucket confirmed private.

### [MEDIUM] [RELY] Rotation/fullscreen re-measure is timer-based, not event-based
**Where:** `DocReaderShell.tsx:222-240`.
**Why it matters:** two fixed timeouts (220 ms / 260 ms) approximate when the frame transform and the fullscreen transition settle. On a slow low-RAM Android the layout can land after the timer, leaving one stale measurement until the next resize — the letterbox the user reported. Timers are cleared correctly, so this is a correctness-of-timing issue, not a leak.
**Fix:** listen for `transitionend` on the frame plus a `ResizeObserver` on the frame element, and keep the timeout only as a backstop.

### [MEDIUM] [OBS] Rotation path emits no breadcrumb
**Where:** `DocReaderShell.tsx:183-199`.
**Why it matters:** `lockOrientation` failing → `shouldCssRotate` → pseudo-landscape is the branch most likely to misbehave per-device, and nothing is recorded. When a student reports "landscape is broken", there is no way to tell which branch they hit.
**Fix:** `addBreadcrumb({ category: "reader", message: "rotate", data: { locked, pseudo, vw, vh } })` — the helper is already imported at `:15`.

### [LOW] [A11Y] Frame-level tap handler swallows nothing, but the rotate FAB has no `role` state text
**Where:** `DocReaderShell.tsx:509-524`. `aria-pressed` is set and the label flips, which is correct; the `title` stays "Rotate to landscape" even when active. Minor screen-reader/tooltip mismatch.

### [LOW] [MAINT] `AutoScrollFab.tsx` still holds the sheet trigger + portal + state after the split
**Where:** `src/components/viewer/AutoScrollFab.tsx` (280 lines). The `AutoScrollSheet`/`ChipGrid` split helped, but the FAB still owns portal, timing and preset state. Acceptable; flagged for the next touch.

### N/A
- **AUTHZ / DATA** — no schema, role or policy changes in scope this session.
- **CONFIG** — no new env or hardcoded URL introduced; `pdf-proxy` host allow-list is explicit.

## Wins

- The rotation frame is the correct fix: a `transform` on the center column establishes a containing block, so `fixed` chrome inside it rotates with the page instead of needing per-element transforms.
- `usePortalHost` now tracks fullscreen **and** the rotation frame via a custom event, with full listener cleanup (`src/hooks/usePortalHost.ts:14-27`).
- Header height is measured (`ResizeObserver`) instead of hardcoded 48px — this is what actually killed the white strip on notched devices (`DocReaderShell.tsx:65-76`).
- `pdf-proxy` gates the fast-path redirect behind `authorizeUrl` before any cache hit, and de-dupes concurrent warm-ups per isolate.
- Download fetch is aborted on unmount; back-button sentinel is pushed/cleaned once; no duplicate `App.addListener`.
- 412 tests pass, typecheck clean.

## Fix Plan

1. HIGH — portal the Notes sheet and reader toasts into the rotation frame.
2. MEDIUM — CSS-var based safe-area insets for in-frame chrome; event-driven re-measure; rotation breadcrumb.
3. LOW — rotate-FAB `title` state, further `AutoScrollFab` slimming.

## Open questions

- Should pseudo-landscape be suppressed entirely inside the Capacitor build (where the native orientation lock normally succeeds), leaving CSS rotation as a web-only fallback? That would delete the whole class of portal/inset mismatches on device.

## Verification status

Device/emulated verification of the rotated chrome **was not completed** — see the observer report for details.
