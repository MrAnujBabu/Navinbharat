// Naveen Bharat — Native chrome (status bar, keyboard, haptics) for Capacitor.
// All Capacitor plugin APIs are dynamically imported and only run on native
// platforms, so the web bundle stays lean and SSR-safe.

const getCapacitor = async () => {
  try {
    return (await import("@capacitor/core")).Capacitor;
  } catch {
    return null;
  }
};

function hslVarToHex(varName: string): string {
  if (typeof window === "undefined") return "#000000";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!raw) return "#000000";
  const parts = raw.split(/\s+/);
  if (parts.length < 3) return "#000000";
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = l - c / 2;
  const to255 = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

let statusBarMod: typeof import("@capacitor/status-bar") | null = null;

async function loadStatusBar() {
  const Capacitor = await getCapacitor();
  if (!Capacitor?.isNativePlatform?.()) return null;
  try {
    if (!statusBarMod) statusBarMod = await import("@capacitor/status-bar");
    return statusBarMod;
  } catch {
    return null;
  }
}

/**
 * Hide the native status bar. YouTube-style immersive playback:
 * called by `useVideoStatusBarHide` after 3s of continuous playback so
 * landscape APK video no longer bleeds into a persistent status strip.
 * Safe no-op on web / iOS-without-plugin.
 */
export async function hideStatusBar() {
  const mod = await loadStatusBar();
  if (!mod) return;
  await mod.StatusBar.hide().catch(() => {});
}

/**
 * Restore the native status bar. Paired with `hideStatusBar` — called on
 * pause, video end, unmount, or when the user reveals player chrome.
 */
export async function showStatusBar() {
  const mod = await loadStatusBar();
  if (!mod) return;
  await mod.StatusBar.show().catch(() => {});
}

/**
 * Put the status bar in overlay mode (true) or let the system reserve a strip
 * for it (false). Immersive surfaces (PDF reader) set overlay=true so that a
 * transient, swipe-revealed bar floats over the page instead of pushing the
 * layout down and re-introducing the white strip.
 */
export async function setStatusBarOverlay(overlay: boolean) {
  const mod = await loadStatusBar();
  if (!mod) return;
  await mod.StatusBar.setOverlaysWebView({ overlay }).catch(() => {});
}

/**
 * Paint the Android status-bar strip. The document reader sets it black so a
 * swipe-revealed bar (or a system-forced re-show on rotation) blends with the
 * black reader surface instead of flashing a white strip.
 */
export async function setStatusBarBackground(color: string): Promise<void> {
  const Capacitor = await getCapacitor();
  if (!Capacitor?.isNativePlatform?.() || Capacitor.getPlatform() !== "android") return;
  const mod = await loadStatusBar();
  if (!mod) return;
  await mod.StatusBar.setBackgroundColor({ color }).catch(() => {});
}

/**
 * Enter the reader's immersive status-bar state as ONE awaited sequence.
 *
 * The three calls used to be fired as independent `void` promises from
 * DocReaderShell, each doing its own dynamic `import()`. Their resolution
 * order was not guaranteed, so on Android `setOverlaysWebView(true)` could
 * land AFTER `hide()` and re-apply window flags that brought the bar back —
 * painted with the app's warm-white theme colour (`#F7F4EE` from
 * capacitor.config.ts). That is the white strip above the page.
 *
 * Order that actually holds on Android:
 *   1. overlay = true      → bar floats over the WebView, never reserves a strip
 *   2. style   = Dark      → light icons, in case the user swipes it back in
 *   3. background = transparent → nothing white can be painted behind it
 *   4. hide()              → last, so no later call re-shows it
 */
export async function enterImmersiveStatusBar(): Promise<void> {
  const mod = await loadStatusBar();
  if (!mod) return;
  const Capacitor = await getCapacitor();
  const isAndroid = Capacitor?.getPlatform?.() === "android";
  const { StatusBar, Style } = mod;
  await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  if (isAndroid) {
    // #AARRGGBB — fully transparent so the black reader surface shows through
    // even if Android forces the bar back (rotation, resume, edge swipe).
    await StatusBar.setBackgroundColor({ color: "#00000000" }).catch(() => {});
  }
  await StatusBar.hide().catch(() => {});
}

/**
 * Leave the immersive status-bar state and hand the bar back to the theme.
 * Awaited in order for the same reason as above.
 */
export async function exitImmersiveStatusBar(theme: "light" | "dark"): Promise<void> {
  const mod = await loadStatusBar();
  if (!mod) return;
  await mod.StatusBar.show().catch(() => {});
  await mod.StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  await applyStatusBarForTheme(theme);
}



export async function applyStatusBarForTheme(theme: "light" | "dark") {
  const Capacitor = await getCapacitor();
  if (!Capacitor?.isNativePlatform?.()) return;
  // A theme flip (or app boot) while the PDF reader owns the system bars must
  // not reset overlay mode — `setOverlaysWebView({ overlay: false })` makes
  // Android reserve a status-bar strip again, which is painted with the light
  // theme colour above the black reader. Bail out entirely while owned.
  const { isImmersiveOwned } = await import("./androidImmersive");
  if (isImmersiveOwned()) return;
  try {
    if (!statusBarMod) statusBarMod = await import("@capacitor/status-bar");
    const { StatusBar, Style } = statusBarMod;
    // Overlay = false so the system reserves its own strip for the status bar
    // and the WebView starts cleanly below it. This prevents the status bar
    // from painting on top of full-bleed content like inline video players.
    // Fullscreen video still uses Android immersive mode (MainActivity) to
    // hide the status bar entirely during landscape playback.
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    await StatusBar.setStyle({
      style: theme === "dark" ? Style.Dark : Style.Light,
    }).catch(() => {});
    if (Capacitor.getPlatform() === "android") {
      // Match the app's themed surface so the status-bar strip blends with
      // the chrome instead of showing a black bar.
      const bg = hslVarToHex("--background");
      await StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
    }
  } catch {
    // plugin not installed in native shell yet — silently skip
  }
}

// Track keyboard listener subscriptions so re-init (HMR / theme flip) doesn't
// stack duplicates that thrash CSS vars and leak memory.
import type { PluginListenerHandle } from "@capacitor/core";
const kbSubs: PluginListenerHandle[] = [];

async function initKeyboard() {
  const Capacitor = await getCapacitor();
  if (!Capacitor?.isNativePlatform?.()) return;
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    if (Capacitor.getPlatform() === "ios") {
      await Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
    }
    const setKbVar = (px: number) =>
      document.documentElement.style.setProperty("--nb-keyboard-h", `${Math.round(px)}px`);
    const push = async (p: Promise<PluginListenerHandle>) => {
      try { kbSubs.push(await p); } catch { /* ignore */ }
    };
    await Promise.all([
      push(Keyboard.addListener("keyboardWillShow", (info) => {
        document.body.classList.add("kb-open");
        setKbVar(info?.keyboardHeight ?? 0);
      })),
      push(Keyboard.addListener("keyboardDidShow", (info) => setKbVar(info?.keyboardHeight ?? 0))),
      push(Keyboard.addListener("keyboardWillHide", () => {
        document.body.classList.remove("kb-open");
        setKbVar(0);
      })),
      push(Keyboard.addListener("keyboardDidHide", () => setKbVar(0))),
    ]);
  } catch {
    // ignore
  }
}

let initialized = false;
export async function initNativeChrome(theme: "light" | "dark" = "light") {
  const Capacitor = await getCapacitor();
  if (!Capacitor?.isNativePlatform?.() || initialized) return;
  initialized = true;
  // Tag the root so CSS can apply native-specific tweaks.
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("is-native");
    const platform = Capacitor.getPlatform?.();
    if (platform) document.documentElement.classList.add(`platform-${platform}`);
  }
  await Promise.all([applyStatusBarForTheme(theme), initKeyboard()]);
}

/** Tear down keyboard listeners and allow re-init. Call on HMR dispose or full teardown. */
export async function disposeNativeChrome() {
  while (kbSubs.length) {
    const sub = kbSubs.pop();
    try { await sub?.remove(); } catch { /* ignore */ }
  }
  initialized = false;
}

// ── Haptics wrappers ───────────────────────────────────────────────
// Device-local user toggle (`setHapticsEnabled(false)` to silence).
// Persisted via safeGet/safeSet — no auth round-trip needed for a UX pref,
// and Safari-private / SSR contexts won't throw.
import { safeGet, safeSet } from "./storage";
const HAPTICS_KEY = "nb_haptics_enabled";

export function getHapticsEnabled(): boolean {
  return safeGet(HAPTICS_KEY) !== "0";
}
export function setHapticsEnabled(enabled: boolean): void {
  safeSet(HAPTICS_KEY, enabled ? "1" : "0");
}

let hapticsMod: typeof import("@capacitor/haptics") | null = null;
async function getHaptics() {
  if (!getHapticsEnabled()) return null;
  const Capacitor = await getCapacitor();
  if (!Capacitor?.isNativePlatform?.()) return null;
  try {
    if (!hapticsMod) hapticsMod = await import("@capacitor/haptics");
    return hapticsMod;
  } catch {
    return null;
  }
}

export async function tapLight() {
  const m = await getHaptics();
  if (!m) return;
  await m.Haptics.impact({ style: m.ImpactStyle.Light }).catch(() => {});
}
export async function tapMedium() {
  const m = await getHaptics();
  if (!m) return;
  await m.Haptics.impact({ style: m.ImpactStyle.Medium }).catch(() => {});
}
export async function notifySuccess() {
  const m = await getHaptics();
  if (!m) return;
  await m.Haptics.notification({ type: m.NotificationType.Success }).catch(() => {});
}
export async function notifyError() {
  const m = await getHaptics();
  if (!m) return;
  await m.Haptics.notification({ type: m.NotificationType.Error }).catch(() => {});
}