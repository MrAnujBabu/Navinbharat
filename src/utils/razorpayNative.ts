// Native Razorpay checkout wrapper (Capacitor Android/iOS).
// Uses the official `capacitor-razorpay` plugin which opens the native
// Razorpay SDK sheet — this is what allows UPI intents to launch PhonePe,
// Google Pay and Paytm directly without going through an in-app browser.

export interface NativeRazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export class RazorpayCancelledError extends Error {
  constructor() {
    super("Payment cancelled");
    this.name = "RazorpayCancelledError";
  }
}

const CANCEL_HINTS = [
  "cancel",
  "dismiss",
  "back_pressed",
  "user closed",
  "payment did not complete",
];

const looksLikeCancel = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return CANCEL_HINTS.some((h) => lower.includes(h));
};

/**
 * Opens the native Razorpay checkout sheet and resolves with the success
 * payload. Throws {@link RazorpayCancelledError} when the user dismisses the
 * sheet, and a regular Error for real failures (declined card, signature
 * mismatch, etc.) so callers can show the right UX.
 */
export const openNativeRazorpayCheckout = async (
  options: NativeRazorpayOptions
): Promise<RazorpaySuccessResponse> => {
  let Checkout: any;
  try {
    ({ Checkout } = await import("capacitor-razorpay"));
  } catch {
    throw new Error(
      "Native payment module is missing. Please update the app from the Play Store."
    );
  }

  // The native SDK expects amount as a string of paise.
  const payload: any = { ...options, amount: String(options.amount) };

  let result: any;
  try {
    result = await Checkout.open(payload);
  } catch (e: any) {
    const msg = e?.message || e?.errorMessage || String(e ?? "");
    if (looksLikeCancel(msg)) throw new RazorpayCancelledError();
    throw new Error(msg || "Payment failed");
  }

  // The plugin returns `{ response: string | object }` — newer versions
  // already parse the JSON, older versions return a stringified payload.
  let parsed: any = result?.response ?? result;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      // Some plugin versions return the payment id directly as a string —
      // surface it as razorpay_payment_id so callers don't crash, but the
      // signature won't be available. The server-side verifier will reject
      // it and surface a friendly error.
      parsed = { razorpay_payment_id: parsed };
    }
  }

  if (!parsed?.razorpay_payment_id) {
    throw new RazorpayCancelledError();
  }

  return {
    razorpay_payment_id: parsed.razorpay_payment_id,
    razorpay_order_id: parsed.razorpay_order_id ?? options.order_id,
    razorpay_signature: parsed.razorpay_signature,
  };
};
