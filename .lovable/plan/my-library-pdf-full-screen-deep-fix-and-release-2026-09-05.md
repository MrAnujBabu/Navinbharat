# My Library PDF full-screen deep fix and release

## Goal
Saved and downloaded PDFs opened from **My Library** will use the complete phone viewport in the installed Android/PWA app. The title/header and white status-area strip will not occupy document space, while Auto-scroll, Download, Back, rotate, search and notes remain reachable in portrait and landscape.

## Confirmed audit findings
- My Library local PDFs correctly reach the shared PDF reader through `FolderView → UniversalFileViewer → DocReaderShell`.
- Installed PWA/native mode currently forces `fullPage`, but the same mode also renders four synthetic safe-area bands. Their top/bottom size is held by native status/navigation-bar CSS variables even after immersive mode starts, so a pale strip can remain by design.
- Full-page chrome is controlled by overlapping layers: React fullscreen state, Capacitor StatusBar calls, the custom Android immersive bridge, body background classes and safe-area overlays. This creates rotation/resume timing races and makes the visible result device-dependent.
- PDF canvas width already follows the measured reader container, but the shell does multiple delayed relayouts. Fullscreen and orientation transitions need one authoritative viewport measurement so the first page immediately refits to the final screen width.
- Existing tests mostly check source strings; they do not prove actual visible geometry or native chrome behavior.

## Implementation
1. **Create one full-page state owner**
   - Consolidate installed-app, fullscreen-button and landscape behavior into one reader mode.
   - Use one enter/reapply/exit lifecycle for Android immersive chrome and restore the normal app status bar only when the reader closes or explicitly exits full-page.
   - Remove competing status-bar calls and delayed ownership races.

2. **Remove the white-strip source**
   - Do not render synthetic top/bottom safe-area bands while My Library full-page mode owns the Android system bars.
   - Paint the reader/root with the normal document surface during the short native transition, without introducing a black screen.
   - Keep safe-area handling only for floating controls when system bars are actually visible.

3. **Make the PDF fill the usable screen**
   - Give the PDF stage an exact fixed `100dvh`/edge-to-edge viewport in full-page mode, with no header reservation.
   - Refit the canvas from the final measured container after fullscreen, orientation and app-resume changes.
   - Preserve the PDF aspect ratio: portrait pages fill screen width and scroll vertically; landscape pages refit to the landscape width without distortion or cropping.

4. **Keep controls accessible**
   - Keep Auto-scroll and Download visible above gesture/navigation areas in both orientations.
   - Keep Back, rotate, search and notes accessible through compact overlay chrome without restoring the large title bar.
   - Verify taps do not accidentally reveal the removed header in forced full-page mode.

5. **Regression and device-level verification**
   - Replace brittle source-text checks with rendered behavior tests for local routing, fullscreen entry/exit, status-bar ownership, cleanup and control visibility.
   - Test portrait, landscape, fullscreen toggle, rotation, background/resume, offline local PDF and downloaded-link PDF.
   - Run focused reader tests, the full test suite, type check, production build and Android dependency/sync checks.
   - Validate the built APK package/signature and capture Android-sized screenshots showing no top strip and visible Auto-scroll/Download controls.

6. **GitHub and APK release**
   - Sync the audited changes to `MrAnujBabu/Navinbharat` without replacing its Android/Actions files.
   - Create the next unused version tag, run the APK workflow, verify the workflow and downloadable APK, then provide commit, release, Actions and direct APK links.
   - Phone installation remains a manual tap on the APK link; I can verify the APK but cannot remotely install it on the device.

## Technical scope
Primary areas: My Library local-file routing, PDF reader shell, fullscreen hook, Android status/immersive helpers, PDF fit measurement, reader surface styles and focused reader tests. Stored documents and library data will not be deleted or migrated.
