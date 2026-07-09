# ProGuard rules for Naveen Bharat (Capacitor + WebView app).
#
# Applied to RELEASE builds only. Debug build has minify disabled
# (see build.gradle) because R8 was stripping Capacitor plugin classes
# at runtime, preventing the app from opening.

# Keep line numbers in stack traces for easier crash debugging.
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*,Signature,Exceptions,InnerClasses,EnclosingMethod

# === Capacitor core + plugin discovery (reflection-based) ===
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.BridgeActivity { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# App package — MainActivity, generated plugin registrations.
-keep class com.naveenbharat.app.** { *; }

# === Cordova bridge (pulled in by capacitor-cordova-android-plugins) ===
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }
-dontwarn org.apache.cordova.**

# === Razorpay Android SDK (reflective JS bridge) ===
-keep class com.razorpay.** { *; }
-keepclassmembers class com.razorpay.** { *; }
-dontwarn com.razorpay.**

# === Generic WebView JS bridge ===
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# === AndroidX + WebView ===
-dontwarn androidx.**
-keep class androidx.webkit.** { *; }

# Reflection-heavy libs commonly bundled with capacitor plugins.
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**

# === Capgo / CapacitorUpdater rules removed — plugin was uninstalled.
# Updates ship via Play Store APK; no OTA runtime, so no reflection keeps needed.
