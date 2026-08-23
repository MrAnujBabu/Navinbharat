# Deep PDF Reader Stability Fix

## Goal
Eliminate the Capacitor fullscreen crash/freeze and the intermittent “Couldn't load the document / Still rendering…” failure in Courses and My Courses, without changing autoscroll behavior or unrelated screens.

## Confirmed current-state risks
- The two full-page readers do not share one fullscreen lifecycle: `DocumentReader` uses CSS-only fullscreen, while `DocReaderShell` separately changes immersive/status-bar state and keeps additional fullscreen state. The native reader already enters immersive mode on mount, so the fullscreen button can perform redundant native chrome transitions while a large PDF is rendering.
- PDF health is communicated through global `window` events (`pdf-ready`, `pdf-progress`, `pdf-error`) without a document/reader identity. A stale event from an unmounting, retrying, or concurrently mounted reader can mark the active reader ready or failed incorrectly.
- The parent reader has a fixed 25-second render watchdog. The uploaded recording shows a healthy download advancing from 7% to 12%, but the parent can still replace it with the timeout overlay if parsing/canvas paint takes longer after bytes arrive.
- Retry paths can overlap: the parent remount watchdog, FastPdfReader transport retry, stream-stall fallback, and whole-file fallback each have independent state. On Android this can duplicate PDF buffers/workers and increase freeze/OOM risk.
- The native whole-file fallback uses `CapacitorHttp` with `arraybuffer`; for a large PDF this can create multiple full-size copies (native response, base64/ArrayBuffer, Blob, Uint8Array, pdf.js worker transfer). That is unsafe on low-memory Android and can turn a recoverable slow stream into an app crash.

## Implementation

### 1. Make fullscreen a single safe state machine
- Consolidate fullscreen behavior for `DocumentReader` and `DocReaderShell` behind one reader-fullscreen hook/controller.
- On Capacitor, never call the browser Fullscreen API and never remount/reparent the PDF. Toggle only React chrome visibility and reference-counted native immersive mode.
- Make transitions idempotent and tap-locked while a transition is in flight; restore status/navigation bars exactly once on exit/unmount.
- Keep the PDF component, URL, worker, scroll position, autoscroll FAB, and page pill mounted across fullscreen changes.
- Preserve web browser fullscreen behavior, with rejection handling and cleanup.

### 2. Scope PDF lifecycle events to the active document
- Add a stable `readerId`/load generation to progress, first-byte, ready, proxy, and error signals.
- Make `DocumentReader`, `ReaderProgress`, `PdfViewer`, and `FastPdfReader` ignore events from stale retries or another reader.
- Cancel timers, requestAnimationFrame callbacks, network controllers, and fallback work when a generation is superseded or the reader unmounts.

### 3. Replace the false timeout with progress-aware recovery
- Track separate phases: resolving, receiving bytes, parsing, first-page rendering, ready, suspended, and failed.
- Do not show an error while bytes/progress heartbeats are still moving.
- Give parsing/first canvas paint a bounded, source-aware window after download progress, rather than reusing one fixed 25-second timer.
- On a genuine stall, perform one controlled soft remount first; show the error overlay only after the bounded recovery fails.
- Preserve the last rendered PDF behind a non-destructive loading layer during retry instead of washing out the document.

### 4. Prevent Android memory spikes and duplicate fallback work
- Introduce a single-flight retry/fallback coordinator so only one recovery path can run per reader generation.
- Keep streaming/range loading as the primary path.
- Add a strict size/memory guard before whole-file `CapacitorHttp` fallback; large or unknown-size PDFs must not be materialized through native arraybuffer/base64.
- Explicitly destroy superseded pdf.js loading tasks/documents and release obsolete fallback buffers/blob URLs.
- Pause the crash-shield heartbeat during known heavy PDF decode/fullscreen transitions so legitimate long work is not misclassified as a freeze, while retaining the cooldown and OOM protections.

### 5. Polish the recovery UI without changing reader features
- Keep the existing reader layout and controls.
- Replace the generic timeout copy with phase-specific, human wording: reconnecting, preparing pages, or source unavailable.
- Keep Retry as the primary action, maintain 44px touch targets and safe-area spacing, and prevent FAB/error/header overlap at 360–430px and landscape heights.
- Keep semantic tokens, ghost fullscreen control, short motion, reduced-motion behavior, and haptic parity.

### 6. Regression and security coverage
- Unit-test fullscreen idempotency, rapid repeated taps, unmount during transition, and native/web branch selection.
- Test stale PDF events, retry generation isolation, continuous-progress timeout extension, parsing delay, background/resume, offline/expired auth, and large-file fallback refusal.
- Test Courses and My Courses opening the same PDF through their actual launch paths.
- Verify proxy authentication/authorization remains server-enforced; do not weaken enrollment checks, expose tokens in diagnostics, or add an external bypass for paid PDFs.
- Run typecheck, targeted PDF/reader tests, the full test suite, production build/bundle guards, and responsive Playwright checks at 360, 375, 390, and 430 widths.
- For the native-only failure, provide an Android validation checklist: rapid fullscreen taps, background/resume during load, 20 repeated opens, memory trim, and logcat checks for OOM/renderer termination.

## Expected result
Fullscreen changes only the surrounding chrome and cannot restart the PDF. Active downloads/parsing are not mislabeled as failures, stale reader events cannot corrupt the current reader, and large-PDF recovery remains bounded in memory instead of freezing or crashing the WebView.