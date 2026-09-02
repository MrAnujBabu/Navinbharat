/**
 * Toggle Android immersive mode (hide status bar + nav bar) while a video
 * is in fullscreen. Safe no-op on web / iOS — the bridge is only injected
 * by our Android wrapper (see MainActivity.java → ImmersiveBridge).
 */
type Bridge = { enter: () => void; exit: () => void };

const getBridge = (): Bridge | null => {
  if (typeof window === "undefined") return null;
  return (window as unknown as { AndroidImmersive?: Bridge }).AndroidImmersive ?? null;
};

export const enterImmersive = () => {
  try { getBridge()?.enter(); } catch { /* no-op */ }
};

export const exitImmersive = () => {
  try { getBridge()?.exit(); } catch { /* no-op */ }
};

let readerOwners = 0;

/**
 * Reference-counted reader ownership prevents two PDF shells from racing the
 * singleton Android WindowInsets controller during route transitions.
 */
export const acquireReaderImmersive = () => {
  readerOwners += 1;
  if (readerOwners === 1) enterImmersive();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    readerOwners = Math.max(0, readerOwners - 1);
    if (readerOwners === 0) exitImmersive();
  };
};

/**
 * Android drops back out of immersive mode on every configuration change, so
 * on rotation the system re-inserts the status-bar inset. The reader already
 * re-applied the hide, but only behind a 120ms debounce — long enough for the
 * white status-bar band to be visible (and screenshotted) at the top of a
 * landscape PDF. Re-assert immediately, then again once the rotation animation
 * settles, because Android re-applies its own insets at the end of it.
 *
 * Guarded by the ownership counters so this never fights normal app screens.
 */
let rotationGuardInstalled = false;
const isImmersiveOwned = () => readerOwners > 0 || fakeFullscreenOwners > 0;

export const installImmersiveRotationGuard = () => {
  if (rotationGuardInstalled || typeof window === "undefined") return;
  rotationGuardInstalled = true;
  let settle: number | null = null;
  const reassert = () => {
    if (!isImmersiveOwned()) return;
    enterImmersive();
    if (settle) window.clearTimeout(settle);
    settle = window.setTimeout(() => {
      if (isImmersiveOwned()) enterImmersive();
    }, 250);
  };
  window.addEventListener("orientationchange", reassert);
  window.addEventListener("resize", reassert);
  window.addEventListener("focus", reassert);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reassert();
  });
};

let installed = false;
export const installImmersiveAutoToggle = () => {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const onChange = () => {
    if (document.fullscreenElement || fakeFullscreenOwners > 0) enterImmersive();
    else exitImmersive();
  };
  document.addEventListener("fullscreenchange", onChange);
  fakeFullscreenListener = onChange;
  installImmersiveRotationGuard();
};


/**
 * Fake-fullscreen ownership, reported directly by the player.
 *
 * This replaces a `MutationObserver` on `document.body` with
 * `subtree: true` + `attributeFilter: ["class"]`, which re-ran a
 * document-wide `querySelector` on EVERY class change anywhere in the app —
 * the same jank pattern already removed from the autoscroll FAB.
 */
let fakeFullscreenOwners = 0;
let fakeFullscreenListener: (() => void) | null = null;

export const setFakeFullscreen = (on: boolean) => {
  const next = on ? fakeFullscreenOwners + 1 : fakeFullscreenOwners - 1;
  fakeFullscreenOwners = Math.max(0, next);
  if (fakeFullscreenListener) fakeFullscreenListener();
  else if (fakeFullscreenOwners > 0) enterImmersive();
  else if (typeof document !== "undefined" && !document.fullscreenElement) exitImmersive();
};