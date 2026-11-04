# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
# === Razorpay Android SDK (reflective JS bridge) ===
-keep class com.razorpay.** { *; }
-keepclassmembers class com.razorpay.** { *; }
-dontwarn com.razorpay.**
# The payment result is delivered to whichever class implements Razorpay's
# listener interfaces (MainActivity). Keep those implementations and their
# callback methods by name — R8 renaming/removing them makes a successful
# payment never reach the app.
-keep class * implements com.razorpay.PaymentResultListener { *; }
-keep class * implements com.razorpay.PaymentResultWithDataListener { *; }
-keep class * implements com.razorpay.ExternalWalletListener { *; }
-keepclassmembers class * {
    public void onPaymentSuccess(...);
    public void onPaymentError(...);
    public void onExternalWalletSelected(...);
}
