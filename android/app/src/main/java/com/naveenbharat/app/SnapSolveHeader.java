package com.naveenbharat.app;

import android.app.Activity;
import android.app.Application;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

/** Styles only the SnapSolve close control; leaves other browser/payment headers alone. */
final class SnapSolveHeader implements Application.ActivityLifecycleCallbacks {
    private static final String CLOSE_SYMBOL = "×";

    @Override
    public void onActivityStarted(Activity activity) {
        if (!activity.getClass().getName().equals("com.outsystems.plugins.inappbrowser.osinappbrowserlib.views.OSIABWebViewActivity")) return;
        int id = activity.getResources().getIdentifier("close_button", "id", activity.getPackageName());
        View view = activity.findViewById(id);
        if (!(view instanceof TextView)) return;
        TextView close = (TextView) view;
        if (!CLOSE_SYMBOL.contentEquals(close.getText())) return;

        float density = activity.getResources().getDisplayMetrics().density;
        int size = Math.round(48 * density);
        ViewGroup.LayoutParams params = close.getLayoutParams();
        params.width = size;
        params.height = size;
        close.setLayoutParams(params);
        close.setMinWidth(size);
        close.setMinHeight(size);
        close.setPadding(0, 0, 0, 0);
        close.setGravity(Gravity.CENTER);
        close.setIncludeFontPadding(false);
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        close.setTypeface(android.graphics.Typeface.DEFAULT);
        close.setContentDescription("Close SnapSolve");

        int foreground = themeColor(activity, androidx.appcompat.R.attr.colorPrimary);
        int surface = themeColor(activity, activity.getResources().getIdentifier("toolbarColor", "attr", activity.getPackageName()));
        int ripple = themeColor(activity, android.R.attr.colorControlHighlight);
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(surface);
        circle.setStroke(Math.max(1, Math.round(density)), (foreground & 0x00ffffff) | 0x33000000);
        GradientDrawable mask = new GradientDrawable();
        mask.setShape(GradientDrawable.OVAL);
        mask.setColor(foreground);
        close.setBackgroundTintList(null);
        close.setBackground(new RippleDrawable(ColorStateList.valueOf(ripple), circle, mask));
        close.setTextColor(foreground);
        // Keep the plugin's existing click listener: it closes its own WebView.
    }

    private static int themeColor(Activity activity, int attr) {
        TypedValue value = new TypedValue();
        activity.getTheme().resolveAttribute(attr, value, true);
        return value.resourceId == 0 ? value.data : androidx.core.content.ContextCompat.getColor(activity, value.resourceId);
    }

    @Override public void onActivityCreated(Activity activity, Bundle state) { }
    @Override public void onActivityResumed(Activity activity) { }
    @Override public void onActivityPaused(Activity activity) { }
    @Override public void onActivityStopped(Activity activity) { }
    @Override public void onActivitySaveInstanceState(Activity activity, Bundle state) { }
    @Override public void onActivityDestroyed(Activity activity) { }
}