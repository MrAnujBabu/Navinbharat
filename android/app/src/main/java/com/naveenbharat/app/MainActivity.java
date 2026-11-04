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

import android.content.Intent;

import com.getcapacitor.BridgeActivity;
import com.razorpay.ExternalWalletListener;
import com.razorpay.PaymentData;
import com.razorpay.PaymentResultWithDataListener;

public class MainActivity extends BridgeActivity
        implements PaymentResultWithDataListener, ExternalWalletListener {

    /**
     * True while a reader surface owns the system bars. Kept on the Java side
     * (not in JS) because the two moments that used to leak a white band —
     * rotation and window-focus return — happen before any JS callback can
     * run. Every re-assert below is gated on this flag so normal app screens
     * keep their status bar.
     */
    private volatile boolean immersiveOwned = false;
    private final SnapSolveHeader snapSolveHeader = new SnapSolveHeader();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Native Razorpay bridge used by src/utils/razorpayNative.ts. Capacitor
        // requires registerPlugin() BEFORE super.onCreate().
        registerPlugin(RazorpayNativePlugin.class);
        super.onCreate(savedInstanceState);
        getApplication().registerActivityLifecycleCallbacks(snapSolveHeader);
        // Warm up Razorpay so installed UPI apps are resolved before checkout.
        RazorpayNativePlugin.preload(getApplicationContext());

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
        // Hand Razorpay UPI links (upi:// intent:// phonepe:// tez:// ...) to the
        // installed UPI app instead of failing with ERR_UNKNOWN_URL_SCHEME, and
        // recover from renderer death. Ported from JSR RecoveryWebViewClient.
        getBridge().getWebView().setWebViewClient(new RecoveryWebViewClient(getBridge(), this));
        getBridge().getWebView().addJavascriptInterface(new ImmersiveBridge(), "AndroidImmersive");
    }

    @Override
    protected void onDestroy() {
        getApplication().unregisterActivityLifecycleCallbacks(snapSolveHeader);
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == com.razorpay.Checkout.RZP_REQUEST_CODE
                && RazorpayNativePlugin.handleCheckoutResult(this, requestCode, resultCode, data)) {
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // Razorpay result handover (fragment-based SDK). Never throw into the SDK.
    @Override
    public void onPaymentSuccess(String razorpayPaymentId, PaymentData paymentData) {
        try { RazorpayNativePlugin.deliverSuccess(razorpayPaymentId, paymentData); } catch (Throwable ignored) { }
    }

    @Override
    public void onPaymentError(int code, String description, PaymentData paymentData) {
        try { RazorpayNativePlugin.deliverError(code, description, paymentData); } catch (Throwable ignored) { }
    }

    @Override
    public void onExternalWalletSelected(String walletName, PaymentData paymentData) {
        try { RazorpayNativePlugin.deliverExternalWallet(walletName); } catch (Throwable ignored) { }
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
