import { loadCore } from "./core";
export const SNAP_SOLVE_URL = "https://snapsolveanuj.vercel.app/";
/** Web opens a tab; native failures never fall back to an external browser. */
export async function openSnapSolve(): Promise<void> {
  try {
    const { Capacitor } = await loadCore();
    if (!Capacitor.isNativePlatform()) {
      window.open(SNAP_SOLVE_URL, "_blank", "noopener,noreferrer");
      return;
    }
    const { InAppBrowser, DefaultWebViewOptions } = await import("@capacitor/inappbrowser");
    await InAppBrowser.openInWebView({ url: SNAP_SOLVE_URL, options: {
      ...DefaultWebViewOptions, showURL: false, showToolbar: true,
      showNavigationButtons: true, clearCache: false, clearSessionCache: false,
      android: { ...DefaultWebViewOptions.android, hardwareBack: true },
    }});
  } catch {
    const { toast } = await import("sonner");
    toast.error("SnapSolve app ke andar nahi khul paya. App update karke phir try karein.");
  }
}
