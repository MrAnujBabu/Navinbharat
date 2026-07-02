import { useEffect, useRef } from "react";
import { hideStatusBar, showStatusBar } from "../lib/nativeChrome";
import { enterImmersive, exitImmersive } from "../lib/androidImmersive";

/**
 * YouTube-style status-bar auto-hide during video playback.
 *
 * Problem this fixes (audit F-STATUSBAR-01, landscape APK):
 *   In landscape APK, the Android status bar remained visible for the
 *   entire video because immersive mode only fired on fake-fullscreen
 *   transitions, never on plain playback. Users saw a persistent
 *   time/battery strip over the video.
 *
 * Behavior (matches YouTube / MX Player):
 *   - When `isPlaying` flips to true, wait `delayMs` (default 3000ms)
 *     of *uninterrupted* playback, then hide the status bar AND enter
 *     Android immersive mode (belt-and-suspenders — StatusBar.hide()
 *     alone doesn't cover the Android system nav bar).
 *   - When `isPlaying` flips to false (pause / end / seek-scrub), the
 *     pending timer is cancelled AND the bar is restored immediately.
 *   - Cleanup on unmount always restores the bar so navigating away
 *     mid-playback doesn't leave the app in a hidden-chrome state.
 *
 * Native-only (both helpers no-op on web).
 *
 * Optional `disabled` lets the caller skip the whole effect (e.g. on
 * live-lesson chat overlays where the operator wants the clock visible).
 */
export function useVideoStatusBarHide(opts: {
  isPlaying: boolean;
  delayMs?: number;
  disabled?: boolean;
}) {
  const { isPlaying, delayMs = 3000, disabled = false } = opts;
  const timerRef = useRef<number | null>(null);
  const hiddenRef = useRef(false);

  useEffect(() => {
    if (disabled) return;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const restore = () => {
      clearTimer();
      if (!hiddenRef.current) return;
      hiddenRef.current = false;
      void showStatusBar();
      exitImmersive();
    };

    if (!isPlaying) {
      restore();
      return;
    }

    // Playing → schedule hide.
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      hiddenRef.current = true;
      void hideStatusBar();
      enterImmersive();
    }, delayMs);

    return clearTimer;
  }, [isPlaying, delayMs, disabled]);

  // Always restore on unmount — never orphan a hidden status bar.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (hiddenRef.current) {
        void showStatusBar();
        exitImmersive();
      }
    },
    [],
  );
}