# Fullscreen reader: hide system bars + rotate Notes sheet & toasts

Two changes, both presentation-only.

## 1. No status bar (time / battery / notch icons) in fullscreen PDF

Today the reader calls `hideStatusBar()` and the Android immersive bridge on mount and re-applies on rotation/resume. The bars still come back because:

- The native bridge uses transient-bars-by-swipe behaviour, so any swipe or tap near the top edge brings the status bar back and nothing re-hides it.
- Nothing re-applies immersive when the activity regains focus (returning from the app switcher, a dialog, or a permission sheet).
- The web layer never puts the status bar in overlay mode, so when it does reappear it pushes the page down instead of floating over it.

Fix:

- Re-hide the system bars whenever the Android window regains focus and whenever the insets controller reports the bars visible again while the reader owns immersive mode (native `MainActivity` side, keeping the existing ref-counted enter/exit API unchanged).
- In `DocReaderShell`, also set the status bar to overlay mode while the reader is open and restore it on unmount, so a transient bar never re-introduces the white strip or shifts layout.
- Keep the existing re-apply hooks (orientation change, resize, visibilitychange) and add one on `focus` for the web/Capacitor WebView.
- Restore normal bars on unmount exactly as today (no change to the release path).

Result: in the PDF reader (portrait, landscape and pseudo-landscape) the page uses the whole screen, and a swipe-revealed bar auto-hides again after a moment.

## 2. Notes sheet and toasts inside the rotation frame (HIGH finding)

In pseudo-landscape the reader is rotated 90° by the rotation frame. The autoscroll FAB and page pill already portal into that frame, but the Notes sheet (Radix `Sheet`) and Sonner toasts still portal to `document.body`, so they render sideways relative to the rotated page.

Fix:

- Give the Notes `SheetContent` an explicit portal container resolved through the existing `usePortalHost()` hook, so it mounts inside the rotation frame when one exists and falls back to the fullscreen element / body otherwise.
- Render a reader-scoped Sonner toaster inside the rotation frame while the reader is open, and suppress the global one for reader-originated toasts, so "Saved", "Added to My Library" and error toasts appear upright and inside the rotated viewport.
- Sheet sizing switches from `h-[70vh]` to a frame-relative height so it covers the correct 70% of the rotated frame rather than 70% of the physical viewport.

## Technical notes

- Files touched: `android/app/src/main/java/com/naveenbharat/app/MainActivity.java`, `src/lib/nativeChrome.ts`, `src/components/library/DocReaderShell.tsx`, `src/components/ui/sheet.tsx` (optional `container` prop pass-through), possibly a small `ReaderToaster` component.
- No business logic, payment, RLS or data changes.
- Native change requires `npx cap sync android` and a fresh APK to verify; the web layer is verifiable in preview.
- Verification: rotate into landscape in the reader, open Notes, trigger a toast, swipe down from the top edge and confirm the bar auto-hides again.
