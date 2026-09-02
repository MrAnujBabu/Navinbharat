package com.naveenbharat.app;

import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * True while a reader surface owns the system bars. Kept on the Java side
     * (not in JS) because the two moments that used to leak a white band —
     * rotation and window-focus return — happen before any JS callback can
     * run. Every re-assert below is gated on this flag so normal app screens
     * keep their status bar.
     */
    private volatile boolean immersiveOwned = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Draw edge-to-edge from process start. Without this the WebView is
        // inset by the status bar and the window paints that gap with the
        // theme's status-bar colour — which is exactly the 28px white strip
        // that appeared above the PDF reader in landscape.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+ paints a translucent white "contrast" scrim behind
            // transparent bars. On the black reader that scrim IS the pale
            // strip — opt out of both.
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }

        // Any inset the system tries to hand back while the reader owns the
        // bars is swallowed and the hide re-applied in the same frame, so a
        // resume / edge-swipe / split-screen change can never shift the
        // layout down and reveal the window background.
        final View decor = getWindow().getDecorView();
        decor.setOnApplyWindowInsetsListener((v, insets) -> {
            if (immersiveOwned) applyImmersive();
            return v.onApplyWindowInsets(insets);
        });

        // `src/lib/androidImmersive.ts` calls `window.AndroidImmersive`.
        getBridge().getWebView().addJavascriptInterface(new ImmersiveBridge(), "AndroidImmersive");
    }

    /** Hide status + nav bars, transient-by-swipe. Safe to call repeatedly. */
    private void applyImmersive() {
        runOnUiThread(() -> {
            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        });
    }

    /**
     * The activity declares `configChanges="orientation|screenSize|..."`, so
     * rotation never recreates it — Android simply relayouts and restores the
     * system bars. The old JS guard reacted to `orientationchange` behind a
     * 120–250ms debounce, which is long enough for the white band to be
     * visible (and screenshotted) at the top of a landscape PDF. Re-assert
     * here instead: same frame, no gap.
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (immersiveOwned) {
            applyImmersive();
            // Android re-applies its own insets at the end of the rotation
            // animation; post one more assert behind it.
            getWindow().getDecorView().post(this::applyImmersive);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && immersiveOwned) applyImmersive();
    }

    /** Exposed to the WebView as `window.AndroidImmersive`. */
    public class ImmersiveBridge {

        @JavascriptInterface
        public void enter() {
            immersiveOwned = true;
            // The window background sits UNDER the WebView. In the light theme
            // it is paper-white, so every relayout gap (rotation, resume) flashed
            // white above and below the black reader. Paint it black for the
            // duration of the reader session.
            runOnUiThread(() -> getWindow().setBackgroundDrawable(new ColorDrawable(Color.BLACK)));
            applyImmersive();
        }

        @JavascriptInterface
        public void exit() {
            immersiveOwned = false;
            runOnUiThread(() -> {
                getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
                        .show(WindowInsetsCompat.Type.systemBars());
            });
        }

        /**
         * Status-bar height in CSS px. In immersive mode `env(safe-area-inset-top)`
         * reports 0, so the reader's black band collapsed to 0px exactly when the
         * native layer could still be showing a strip mid-rotation. JS uses this
         * as the band's minimum height.
         */
        @JavascriptInterface
        public int statusBarHeight() {
            return insetPx("status_bar_height");
        }

        /** Navigation-bar height in CSS px — same reasoning, bottom edge. */
        @JavascriptInterface
        public int navigationBarHeight() {
            return insetPx("navigation_bar_height");
        }

        private int insetPx(String resName) {
            int id = getResources().getIdentifier(resName, "dimen", "android");
            if (id <= 0) return 0;
            float density = getResources().getDisplayMetrics().density;
            if (density <= 0) density = 1f;
            return Math.round(getResources().getDimensionPixelSize(id) / density);
        }
    }
}
