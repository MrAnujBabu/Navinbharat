// Authenticated proxy for the external Telegram-backed PDF storage project.
// Prevents the external anon key from being exposed in the client bundle and
// gates all access behind a valid JWT from THIS project. Enrollment-level
// gating per lesson is enforced upstream by RLS on `lesson_pdfs` /
// `lesson_attachments` when the client fetches the viewer URL row.
//
// Request: POST { view_id: string }  (Authorization: Bearer <user JWT>)
// Response: application/pdf bytes on 200; JSON error otherwise.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TELEGRAM_SUPABASE_URL =
  Deno.env.get("TELEGRAM_STORAGE_URL") ??
  "https://hsvtagmckkfmniawflul.supabase.co";
const TELEGRAM_SUPABASE_KEY = Deno.env.get("TELEGRAM_STORAGE_ANON_KEY") ?? "";

const VIEW_ID_RE = /^[a-f0-9-]{20,64}$/i;

function jsonErr(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonErr(405, "Method not allowed");

  if (!TELEGRAM_SUPABASE_KEY) return jsonErr(500, "Storage proxy not configured");

  // Verify caller JWT against THIS project.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonErr(401, "Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonErr(401, "Unauthorized");

  let body: { view_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonErr(400, "Invalid JSON body");
  }
  const viewId = body.view_id?.trim();
  if (!viewId || !VIEW_ID_RE.test(viewId)) return jsonErr(400, "view_id required");

  const upstreamHeaders = {
    apikey: TELEGRAM_SUPABASE_KEY,
    Authorization: `Bearer ${TELEGRAM_SUPABASE_KEY}`,
  };

  // 1. Resolve view_id → file_id via upstream REST.
  const rowUrl = `${TELEGRAM_SUPABASE_URL}/rest/v1/pdf_documents?select=file_id,file_name&id=eq.${encodeURIComponent(viewId)}`;
  const rowResp = await fetch(rowUrl, { headers: upstreamHeaders });
  if (!rowResp.ok) return jsonErr(502, `Upstream metadata HTTP ${rowResp.status}`);
  const rows = (await rowResp.json()) as Array<{ file_id?: string; file_name?: string }>;
  const fileId = rows[0]?.file_id;
  const fileName = rows[0]?.file_name ?? "document.pdf";
  if (!fileId) return jsonErr(404, "Storage file not found");

  // 2. Fetch bytes via upstream edge function.
  const fileResp = await fetch(`${TELEGRAM_SUPABASE_URL}/functions/v1/telegram-get-file`, {
    method: "POST",
    headers: { ...upstreamHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!fileResp.ok) return jsonErr(502, `Upstream file HTTP ${fileResp.status}`);

  const contentType = fileResp.headers.get("content-type") ?? "application/pdf";
  return new Response(fileResp.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileName.replace(/[^\w.\-]+/g, "_")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});