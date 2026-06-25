/**
 * Open URLs inside the app on native. Drive/Notion/Docs pages must not be
 * embedded in our existing iframe/PDF surface, and must not jump to an
 * external browser. Prefer Capacitor InAppBrowser's own WebView, then fall
 * back to the official Browser custom-tab surface. Web keeps normal behavior.
 */
export const openExternal = async (url: string): Promise<void> => {
  let isNative = false;
  try {
    const { Capacitor } = await import(/* @vite-ignore */ "@capacitor/core");
    isNative = Capacitor.isNativePlatform();
    if (isNative) {
      try {
        const {
          InAppBrowser,
          ToolbarPosition,
          iOSViewStyle,
          iOSAnimation,
        } = await import(/* @vite-ignore */ "@capacitor/inappbrowser");
        await InAppBrowser.openInWebView({
          url,
          options: {
            showURL: false,
            showToolbar: true,
            clearCache: false,
            clearSessionCache: false,
            mediaPlaybackRequiresUserAction: false,
            closeButtonText: "Close",
            toolbarPosition: ToolbarPosition.TOP,
            showNavigationButtons: true,
            leftToRight: false,
            customWebViewUserAgent: null,
            android: {
              allowZoom: true,
              hardwareBack: true,
              pauseMedia: true,
            },
            iOS: {
              allowOverScroll: true,
              enableViewportScale: true,
              allowInLineMediaPlayback: true,
              surpressIncrementalRendering: false,
              viewStyle: iOSViewStyle.FULL_SCREEN,
              animationEffect: iOSAnimation.COVER_VERTICAL,
              allowsBackForwardNavigationGestures: true,
            },
          },
        });
        return;
      } catch (err) {
        console.warn("[openExternal] InAppBrowser WebView unavailable, trying Browser", err);
      }

      // Fallback: still opens on top of the app (Android Custom Tabs /
      // SFSafariViewController), not via target=_system external handoff.
      try {
        const { Browser } = await import(/* @vite-ignore */ "@capacitor/browser");
        await Browser.open({ url, presentationStyle: "fullscreen" });
        return;
      } catch (err) {
        console.warn("[openExternal] Browser plugin unavailable", err);
      }

      throw new Error("No native in-app browser plugin is available");
    }
  } catch { /* fall through */ }
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
};
