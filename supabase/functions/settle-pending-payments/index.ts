/**
 * Autonomous payment settlement sweeper.
 *
 * The Razorpay webhook is the fast path. This is the safety net: if the
 * webhook is never delivered (URL not registered, outage, dropped retry) a
 * captured payment would otherwise sit `pending` forever and the student
 * would stay unenrolled until they manually tapped "Recover enrollment".
 *
 * Runs on a schedule (pg_cron -> pg_net -> this function). Razorpay is the
 * source of truth: for every non-terminal order we ask the Orders API whether
 * a payment was actually captured, re-validate the amount against our own DB
 * row, and only then call the idempotent `complete_paid_enrollment` RPC.
 *
 * Auth: shared secret in `x-sweep-secret`, compared in constant time. There is
 * no CORS surface — this is a server-to-server endpoint.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { razorpayFetchWithRetry } from "../_shared/razorpayFetch.ts";

const jsonHeaders = { "Content-Type": "application/json" };

// Give the webhook + client-side verify a head start before we interfere.
const MIN_AGE_MS = 3 * 60 * 1000;
// Razorpay orders older than this are not worth polling any more.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// After this long with no captured payment, stop retrying the row.
const GIVE_UP_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 50;

interface RazorpayPaymentItem {
  id: string;
  status?: string;
  amount?: number;
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const sweepSecret = Deno.env.get("PAYMENT_SWEEP_SECRET");
  if (!sweepSecret) {
    console.error("PAYMENT_SWEEP_SECRET not configured — sweeper disabled");
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const provided = req.headers.get("x-sweep-secret") ?? "";
  if (!timingSafeEqual(provided, sweepSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
  const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return new Response(JSON.stringify({ error: "Razorpay not configured" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
  const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const { data: rows, error: queryError } = await supabaseAdmin
    .from("razorpay_payments")
    .select("id, user_id, course_id, razorpay_order_id, amount, status, created_at")
    .not("razorpay_order_id", "is", null)
    .not("status", "in", '("completed","refunded","failed")')
    .lte("created_at", new Date(now - MIN_AGE_MS).toISOString())
    .gte("created_at", new Date(now - MAX_AGE_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error("Sweeper query failed:", queryError.message);
    return new Response(JSON.stringify({ error: "Query failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  let scanned = 0;
  let settled = 0;
  let abandoned = 0;
  let mismatched = 0;
  let unreachable = 0;

  for (const row of rows ?? []) {
    scanned++;
    const res = await razorpayFetchWithRetry(
      `https://api.razorpay.com/v1/orders/${row.razorpay_order_id}/payments`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );

    if (!res.ok) {
      unreachable++;
      console.error("Razorpay lookup failed", {
        order_id: row.razorpay_order_id,
        status: res.status,
      });
      continue;
    }

    const items: RazorpayPaymentItem[] = res.data?.items ?? [];
    const captured = items.find((p) => p.status === "captured");

    if (!captured) {
      const ageMs = now - new Date(row.created_at).getTime();
      if (ageMs > GIVE_UP_MS) {
        abandoned++;
        await supabaseAdmin
          .from("razorpay_payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .not("status", "in", '("completed","refunded")');
      }
      continue;
    }

    // Amount is re-derived from our own row, never trusted from Razorpay.
    const expectedPaise = Math.round(Number(row.amount) * 100);
    if (captured.amount !== expectedPaise) {
      mismatched++;
      console.error("SWEEP AMOUNT MISMATCH", {
        order_id: row.razorpay_order_id,
        expected_paise: expectedPaise,
        received_paise: captured.amount,
      });
      await supabaseAdmin.from("security_alerts").insert({
        alert_type: "amount_tampering",
        details: {
          source: "settle-pending-payments",
          razorpay_order_id: row.razorpay_order_id,
          expected_paise: expectedPaise,
          received_paise: captured.amount,
          user_id: row.user_id,
          course_id: row.course_id,
        },
        source_ip: null,
      });
      continue;
    }

    if (!row.user_id || !row.course_id) {
      console.error("Sweep row missing user/course", { id: row.id });
      continue;
    }

    const { error: rpcError } = await supabaseAdmin.rpc("complete_paid_enrollment", {
      _user_id: row.user_id,
      _course_id: Number(row.course_id),
      _razorpay_order_id: row.razorpay_order_id,
      _razorpay_payment_id: captured.id,
    });

    if (rpcError) {
      console.error("Sweep enrollment failed — will retry next run", {
        order_id: row.razorpay_order_id,
        message: rpcError.message,
      });
      continue;
    }

    settled++;
    console.log("Sweep settled payment", {
      order_id: row.razorpay_order_id,
      payment_id: captured.id,
      user_id: row.user_id,
      course_id: row.course_id,
    });
  }

  return new Response(
    JSON.stringify({ scanned, settled, abandoned, mismatched, unreachable }),
    { status: 200, headers: jsonHeaders },
  );
});
