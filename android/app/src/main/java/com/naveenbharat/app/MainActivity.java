package com.naveenbharat.app;

import android.os.Bundle;
import android.webkit.JavascriptInterface;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Draw edge-to-edge from process start. Without this the WebView is
        // inset by the status bar and the window paints that gap with the
        // theme's status-bar colour — which is exactly the 28px white strip
        // that appeared above the PDF reader in landscape. Relying on the JS
        // StatusBar plugin alone leaves that band visible until JS boots, and
        // again on every rotation until the re-apply lands.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // `src/lib/androidImmersive.ts` has always called `window.AndroidImmersive`
        // and its header comment points here, but the bridge was never actually
        // registered — so `enterImmersive()` was a silent no-op on Android and
        // the reader's only defence was the JS StatusBar plugin. Register it.
        getBridge().getWebView().addJavascriptInterface(new ImmersiveBridge(), "AndroidImmersive");
    }

    /** Exposed to the WebView as `window.AndroidImmersive`. */
    public class ImmersiveBridge {

        @JavascriptInterface
        public void enter() {
            runOnUiThread(() -> {
                WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                controller.setSystemBarsBehavior(
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsetsCompat.Type.systemBars());
            });
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(() -> WindowCompat
                    .getInsetsController(getWindow(), getWindow().getDecorView())
                    .show(WindowInsetsCompat.Type.systemBars()));
        }
    }
}