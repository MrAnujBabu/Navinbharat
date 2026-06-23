import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DRIVE_ID_RE = /^[a-zA-Z0-9_-]{10,200}$/;

const headersWithCors = (extra: HeadersInit = {}) => ({
  ...corsHeaders,
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges, content-type",
  ...extra,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: headersWithCors() });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: headersWithCors({ "Content-Type": "application/json" }),
    });
  }

  try {
    const input = new URL(req.url);
    const kind = input.searchParams.get("kind");
    const id = input.searchParams.get("id") || "";

    if (kind !== "drive" || !DRIVE_ID_RE.test(id)) {
      return new Response(JSON.stringify({ error: "Valid Drive file id is required" }), {
        status: 400,
        headers: headersWithCors({ "Content-Type": "application/json" }),
      });
    }

    const upstream = await fetchDriveFile(id, req.headers.get("range"));
    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: `Drive fetch failed: ${upstream.status}` }), {
        status: upstream.status || 502,
        headers: headersWithCors({ "Content-Type": "application/json" }),
      });
    }

    const outHeaders: Record<string, string> = {
      "Content-Type": upstream.headers.get("content-type") || "application/pdf",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    };
    for (const h of ["content-length", "content-range", "etag", "last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) outHeaders[h] = v;
    }

    return new Response(req.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: headersWithCors(outHeaders),
    });
  } catch (error) {
    console.error("pdf-proxy error", error);
    return new Response(JSON.stringify({ error: "PDF proxy failed" }), {
      status: 500,
      headers: headersWithCors({ "Content-Type": "application/json" }),
    });
  }
});

async function fetchDriveFile(id: string, range: string | null): Promise<Response> {
  const headers = new Headers({ Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1" });
  if (range) headers.set("Range", range);

  const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  let res = await fetch(url, { headers, redirect: "follow" });
  const ct = res.headers.get("content-type") || "";

  if (!/text\/html/i.test(ct)) return res;

  const html = await res.text();
  const token = html.match(/[?&]confirm=([0-9A-Za-z_\-]+)/)?.[1];
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  if (!token) return new Response(null, { status: 415, statusText: "Drive did not return a PDF" });

  const confirmedHeaders = new Headers(headers);
  if (cookie) confirmedHeaders.set("Cookie", cookie);
  res = await fetch(`${url}&confirm=${encodeURIComponent(token)}`, {
    headers: confirmedHeaders,
    redirect: "follow",
  });
  return res;
}