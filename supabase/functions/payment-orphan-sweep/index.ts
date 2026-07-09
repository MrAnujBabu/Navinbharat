/**
 * payment-orphan-sweep — M6
 *
 * Scheduled sweep that finds "stuck" Razorpay payment rows (status
 * pending/created, older than STALE_MINUTES, no enrollment) and either:
 *   - completes the enrollment via public.complete_paid_enrollment(...)
 *     when Razorpay confirms the order is captured, or
 *   - marks the row 'failed' when Razorpay reports failed/unpaid past the
 *     terminal window.
 *
 * Idempotent: uses complete_paid_enrollment (ON CONFLICT DO UPDATE) and
 * only mutates rows whose status is still pending/created.
 *
 * Auth: caller must present the CRON_SECRET (header x-cron-secret) OR be
 * an admin JWT. verify_jwt is false — validated in code.
 *
 * Cron: install via SQL (see supabase/functions/payment-orphan-sweep/README).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const STALE_MINUTES = 10; // don't touch rows younger than this — checkout still in flight
const HARD_FAIL_HOURS = 24; // rows this old with no capture → mark failed
const MAX_ROWS = 50; // per invocation

interface RzpOrderPayment {
  id: string;
  order_id: string;
  status: string; // "captured" | "authorized" | "failed" | ...
  amount: number;
}

async function fetchRazorpayOrderPayment(
  orderId: string,
  keyId: string,
  keySecret: string,
): Promise<RzpOrderPayment | null> {
  const auth = btoa(`${keyId}:${keySecret}`);
  const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    console.error("razorpay lookup failed", { orderId, status: res.status });
    return null;
  }
  const body = await res.json();
  const items: RzpOrderPayment[] = body?.items ?? [];
  if (items.length === 0) return null;
  // Prefer captured, else authorized, else latest.
  return (
    items.find((p) => p.status === "captured") ??
    items.find((p) => p.status === "authorized") ??
    items[items.length - 1]
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization") ?? "";

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Authorize: cron secret OR admin JWT.
  let authorized = false;
  if (cronSecret && headerSecret && headerSecret === cronSecret) {
    authorized = true;
  } else if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData } = await userClient.auth.getUser(token);
    if (userData?.user?.id) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin");
      if (roles && roles.length > 0) authorized = true;
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
  const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return new Response(JSON.stringify({ error: "Razorpay keys not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const staleCutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const hardCutoff = new Date(Date.now() - HARD_FAIL_HOURS * 3600_000).toISOString();

  const { data: rows, error: fetchError } = await supabaseAdmin
    .from("razorpay_payments")
    .select("id, user_id, course_id, razorpay_order_id, razorpay_payment_id, status, created_at")
    .in("status", ["pending", "created"])
    .lt("created_at", staleCutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS);

  if (fetchError) {
    console.error("orphan sweep fetch failed", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = {
    scanned: rows?.length ?? 0,
    recovered: 0,
    failed: 0,
    still_pending: 0,
    errors: 0,
  };

  for (const row of rows ?? []) {
    try {
      const rzp = await fetchRazorpayOrderPayment(
        row.razorpay_order_id,
        RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET,
      );

      if (rzp && rzp.status === "captured") {
        const { error: rpcErr } = await supabaseAdmin.rpc("complete_paid_enrollment", {
          _user_id: row.user_id,
          _course_id: row.course_id,
          _razorpay_order_id: row.razorpay_order_id,
          _razorpay_payment_id: rzp.id,
        });
        if (rpcErr) {
          console.error("complete_paid_enrollment failed", { row_id: row.id, err: rpcErr.message });
          summary.errors += 1;
        } else {
          summary.recovered += 1;
          await supabaseAdmin.from("audit_log").insert({
            user_id: row.user_id,
            action: "orphan_sweep_recovered",
            table_name: "razorpay_payments",
            record_count: 1,
            metadata: {
              razorpay_order_id: row.razorpay_order_id,
              razorpay_payment_id: rzp.id,
              course_id: row.course_id,
            },
          });
        }
      } else if (rzp && rzp.status === "failed") {
        await supabaseAdmin
          .from("razorpay_payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .in("status", ["pending", "created"]);
        summary.failed += 1;
      } else if (!rzp && row.created_at && row.created_at < hardCutoff) {
        // No payment attempt found for the order after 24h → give up.
        await supabaseAdmin
          .from("razorpay_payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .in("status", ["pending", "created"]);
        summary.failed += 1;
      } else {
        summary.still_pending += 1;
      }
    } catch (err) {
      console.error("orphan sweep row error", { row_id: row.id, err: (err as Error).message });
      summary.errors += 1;
    }
  }

  console.log("payment-orphan-sweep done", summary);
  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
