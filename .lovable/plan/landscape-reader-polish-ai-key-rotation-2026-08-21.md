# Landscape reader polish + AI key rotation

Scope: the PDF reader opened from the Downloads page (`DocReaderShell`), plus one key rotation. Nothing else is touched.

## 1. White stripe at the top in landscape

What happens now: the reader hides the Android status bar once, when it opens (`hideStatusBar()` + immersive lock in `DocReaderShell`). When the screen rotates, Android brings the system bars back and nothing re-applies the hide, so a white band appears across the top in landscape.

Fix:
- Re-apply `hideStatusBar()` and the immersive lock whenever the orientation or viewport changes while the reader is open (orientationchange / visualViewport resize / app resume), debounced so it does not thrash on every resize frame.
- Keep the PDF surface at `top: 0` in landscape even while the header is visible (the header itself already carries the safe-area padding), so no white safe-area gap is left behind the header.

## 2. Page does not fill the width in landscape (empty space on both sides)

What happens now: the rotate button first asks the OS for a real orientation lock; when that call reports failure the reader falls back to rotating its own surface in CSS (`pseudoLandscape`). If the device also rotates for real, the surface ends up sized to the short screen edge and the page renders as a narrow centred column with blank space on both sides — the state in screenshot 1. Screenshot 2 (portrait, page edge-to-edge) is the target ratio.

Fix:
- Only apply the CSS rotation when the viewport is still portrait. If the viewport is already landscape (real rotation happened), drop `pseudoLandscape` so the surface uses the normal full-bleed layout.
- Watch orientation while landscape is active and clear the CSS rotation as soon as the real rotation lands.
- Size the page from the reader surface itself rather than the window: feed the scroll container's own width into the fit calculation and re-measure on rotation, so the page always renders edge-to-edge at the correct aspect ratio, in both real and CSS landscape.
- No change to zoom, page quality (DPR budget), autoscroll, or the page chip.

## 3. Rotate the AI key

`chatbot` (Naveen Bharat Agent) and `resolve-doubt` (Ask Doubt) both authenticate with the same Lovable AI Gateway key. Rotating it once covers both functions; no code change is required and the functions keep working after rotation.

## Verification

- Unit tests for the fit-width helper and the landscape decision logic.
- Full test suite must stay green.
- Device check needs a fresh APK: open a PDF from Downloads, rotate, confirm no white stripe and the page fills the width.

## Technical notes

- Files: `src/components/library/DocReaderShell.tsx` (status-bar re-apply, pseudo-landscape guard, surface top offset), `src/components/video/FastPdfReader.tsx` + `src/lib/pdfFit.ts` (container-based width measurement), `src/lib/nativeChrome.ts` only if a re-apply helper is needed.
- Key rotation runs through the AI Gateway rotate tool; the new value is stored as the project secret the edge functions already read.
