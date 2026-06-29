import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DRIVE_ID_RE = /^[a-zA-Z0-9_-]{10,200}$/;

const headersWithCors = (extra: HeadersInit = {}) => ({
  ...corsHeaders,
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges, content-type, cache-control, cache-tag",
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

    // kind=url → generic CORS-safe proxy for allow-listed direct PDF CDNs
    // (jsDelivr, GitHub raw, etc). The web/native reader routes every
    // jsDelivr-hosted Class Notes PDF through here via remotePdfProxyUrl().
    if (kind === "url") {
      const target = input.searchParams.get("url") || "";
      if (!isAllowedPdfUrl(target)) {
        return new Response(JSON.stringify({ error: "URL not allowed" }), {
          status: 400,
          headers: headersWithCors({ "Content-Type": "application/json" }),
        });
      }
      const upstreamUrl = await fetchRemoteFile(target, req.headers.get("range"));
      return relayUpstream(upstreamUrl, req.method);
    }

    if (kind !== "drive" || !DRIVE_ID_RE.test(id)) {
      return new Response(JSON.stringify({ error: "Valid Drive file id is required" }), {
        status: 400,
        headers: headersWithCors({ "Content-Type": "application/json" }),
      });
    }

    const upstream = await fetchDriveFile(id, req.headers.get("range"));
    if (!upstream.ok || !upstream.body) {
      const privateLike = upstream.status === 403 || upstream.status === 404 || upstream.status === 415;
      return new Response(JSON.stringify({
        error: privateLike
          ? "This Drive file is private — ask the uploader to enable link sharing."
          : `Drive fetch failed: ${upstream.status}`,
        type: privateLike ? "drive_private" : "drive_fetch_failed",
        fallback: false,
      }), {
        status: upstream.status || 502,
        headers: headersWithCors({ "Content-Type": "application/json" }),
      });
    }

    const outHeaders: Record<string, string> = {
      "Content-Type": upstream.headers.get("content-type") || "application/pdf",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      "CDN-Cache-Control": "public, max-age=86400, immutable",
      "Cache-Tag": `drive:${id}`,
      "Vary": "Range",
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

// Allow-list of trusted direct PDF CDNs proxied via kind=url. Keep this tight
// so the function can't be abused as an open proxy.
const ALLOWED_HOSTS = [
  /(^|\.)cdn\.jsdelivr\.net$/i,
  /(^|\.)raw\.githubusercontent\.com$/i,
  /(^|\.)blob\.core\.windows\.net$/i,
  /(^|\.)github-storages-cdn\.vercel\.app$/i,
  /(^|\.)storage-naveenbharat-recording\.vercel\.app$/i,
];

function isAllowedPdfUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    // SSRF guard: https only, no credentials, no non-default ports, no
    // IP-literal hosts (defeats DNS-rebinding / localhost / 169.254.169.254
    // metadata abuse), allow-listed CDN hostnames only.
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    if (u.port && u.port !== "443") return false;
    const host = u.hostname;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false; // IPv4 literal
    if (host.includes(":")) return false;                 // IPv6 literal
    if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host)) return false;
    return ALLOWED_HOSTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

async function fetchRemoteFile(url: string, range: string | null): Promise<Response> {
  const headers = new Headers({
    Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  if (range) headers.set("Range", range);
  return fetch(url, { headers, redirect: "follow" });
}

function relayUpstream(upstream: Response, method: string): Response {
  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: `Upstream fetch failed: ${upstream.status}` }), {
      status: upstream.status || 502,
      headers: headersWithCors({ "Content-Type": "application/json" }),
    });
  }
  const outHeaders: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") || "application/pdf",
    "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
    "CDN-Cache-Control": "public, max-age=86400, immutable",
    "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
  };
  for (const h of ["content-length", "content-range", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) outHeaders[h] = v;
  }
  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: headersWithCors(outHeaders),
  });
}



/**
 * Fallback chain for Google Drive PDFs. Each tier is logged with
 * `[pdf-proxy:drive]` so we can see in Supabase logs which path actually
 * served the file (telemetry).
 *
 *   tier 1: drive.usercontent.google.com/download?confirm=t
 *   tier 2: drive.google.com/uc — parse the interstitial <form> + cookie
 *   tier 3: drive.google.com/uc&confirm=<legacy-token>
 *   tier 4: docs.google.com/uc?export=download  (older mirror)
 */
async function fetchDriveFile(id: string, range: string | null): Promise<Response> {
  const baseHeaders = new Headers({
    Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  if (range) baseHeaders.set("Range", range);

  const log = (tier: string, info: Record<string, unknown>) =>
    console.info("[pdf-proxy:drive]", tier, { id, ...info });

  // tier 1
  const directUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&authuser=0&confirm=t`;
  let res = await fetch(directUrl, { headers: baseHeaders, redirect: "follow" });
  let ct = res.headers.get("content-type") || "";
  log("tier1-direct", { status: res.status, ct });
  if (res.ok && !/text\/html/i.test(ct)) return res;

  // tier 2
  const ucUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  res = await fetch(ucUrl, { headers: baseHeaders, redirect: "follow" });
  ct = res.headers.get("content-type") || "";
  log("tier2-uc", { status: res.status, ct });
  if (!/text\/html/i.test(ct)) return res;

  const html = await res.text();
  const cookie = res.headers.get("set-cookie")?.split(";")[0];

  const formAction = html.match(/<form[^>]+action="([^"]+download[^"]*)"/i)?.[1];
  const hiddenInputs: Record<string, string> = {};
  for (const m of html.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi)) {
    hiddenInputs[m[1]] = m[2].replace(/&amp;/g, "&");
  }

  if (formAction && Object.keys(hiddenInputs).length) {
    const qs = new URLSearchParams(hiddenInputs).toString();
    const confirmedHeaders = new Headers(baseHeaders);
    if (cookie) confirmedHeaders.set("Cookie", cookie);
    const followUrl = `${formAction.replace(/&amp;/g, "&")}?${qs}`;
    res = await fetch(followUrl, { headers: confirmedHeaders, redirect: "follow" });
    ct = res.headers.get("content-type") || "";
    log("tier2-form", { status: res.status, ct });
    if (res.ok && !/text\/html/i.test(ct)) return res;
  }

  // tier 3 — legacy confirm token
  const token = html.match(/[?&]confirm=([0-9A-Za-z_\-]+)/)?.[1];
  if (token) {
    const confirmedHeaders = new Headers(baseHeaders);
    if (cookie) confirmedHeaders.set("Cookie", cookie);
    res = await fetch(`${ucUrl}&confirm=${encodeURIComponent(token)}`, {
      headers: confirmedHeaders,
      redirect: "follow",
    });
    ct = res.headers.get("content-type") || "";
    log("tier3-token", { status: res.status, ct });
    if (res.ok && !/text\/html/i.test(ct)) return res;
  }

  // tier 4 — docs.google.com mirror (older Drive ids still resolve here)
  const docsUrl = `https://docs.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  res = await fetch(docsUrl, { headers: baseHeaders, redirect: "follow" });
  ct = res.headers.get("content-type") || "";
  log("tier4-docs", { status: res.status, ct });
  if (res.ok && !/text\/html/i.test(ct)) return res;

  log("exhausted", { lastStatus: res.status });
  return new Response(null, { status: 415, statusText: "Drive did not return a PDF" });
}