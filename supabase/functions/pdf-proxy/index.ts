import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const DRIVE_ID_RE = /^[a-zA-Z0-9_-]{10,200}$/;
// Hardening cap for generic allow-listed CDN proxy only. Drive PDFs are streamed
// without a size ceiling because large lecture PDFs commonly exceed 80 MB.
const DIRECT_URL_MAX_BYTES = 80 * 1024 * 1024; // 80 MB
const UPSTREAM_TIMEOUT_MS = 45_000;
// Drive throttles large PDFs (>50 MB) to ~1 MB/s; a 120s cap was clipping
// streams mid-flight → pdf.js received a truncated body → onLoadSuccess never
// fired → "Opening … 90%" stall. Give the streaming phase more headroom while
// staying under Deno Deploy's 400 s wall-clock ceiling for edge functions.
const DRIVE_UPSTREAM_TIMEOUT_MS = 300_000;

const headersWithCors = (extra: HeadersInit = {}) => ({
  ...corsHeaders,
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges, content-type, cache-control, cache-tag",
  ...extra,
});

// AbortSignal.timeout polyfill (Deno Deploy has it, but be explicit so the
// behavior is identical across runtimes).
const timeoutSignal = (ms: number): AbortSignal => {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(new Error(`Upstream timeout after ${ms}ms`)), ms);
  return ctrl.signal;
};

const isOversize = (res: Response): boolean => {
  const len = Number(res.headers.get("content-length") || "0");
  return Number.isFinite(len) && len > DIRECT_URL_MAX_BYTES;
};

// Fire-and-forget metrics insert. We never await this — the reader's
// perceived latency must not depend on Postgres. If SUPABASE_URL /
// service-role key aren't present (local dev), we skip silently.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const metricsClient = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function recordMetric(row: { event: string; drive_id?: string | null; tier?: string | null; last_status?: number | null; last_content_type?: string | null }) {
  if (!metricsClient) return;
  // Never let a logging failure surface to the caller.
  metricsClient.from("pdf_proxy_metrics").insert(row).then(({ error }) => {
    if (error) console.warn("[pdf-proxy:metrics]", error.message);
  }).catch((err) => console.warn("[pdf-proxy:metrics]", err));
}

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
      if (isOversize(upstreamUrl)) {
        return new Response(JSON.stringify({ error: "PDF exceeds 80 MB limit" }), {
          status: 413,
          headers: headersWithCors({ "Content-Type": "application/json" }),
        });
      }
      recordMetric({
        event: "url_success",
        tier: "url",
        last_status: upstreamUrl.status,
        last_content_type: upstreamUrl.headers.get("content-type"),
      });
      return relayUpstream(upstreamUrl, req.method);
    }

    if (kind !== "drive" || !DRIVE_ID_RE.test(id)) {
      return new Response(JSON.stringify({ error: "Valid Drive file id is required" }), {
        status: 400,
        headers: headersWithCors({ "Content-Type": "application/json" }),
      });
    }

    // Drive confirm-token endpoints are inconsistent with Range for high-MB
    // PDFs. Ignore caller Range and return one clean full stream.
    const upstream = await fetchDriveFile(id);
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

    const upstreamLen = upstream.headers.get("content-length");
    const outHeaders: Record<string, string> = {
      "Content-Type": upstream.headers.get("content-type") || "application/pdf",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable, no-transform",
      "CDN-Cache-Control": "public, max-age=86400, immutable, no-transform",
      "Cache-Tag": `drive:${id}`,
      "Accept-Ranges": "none",
      // Belt-and-suspenders: prevent any intermediary from re-encoding the
      // body. We ask upstream for `identity` encoding (see fetchDriveFile) so
      // this claim is truthful and pdf.js can trust Content-Length.
      "Content-Encoding": "identity",
    };
    // Forward Content-Length ONLY when upstream is identity-encoded. With a
    // real byte length, pdf.js can (a) report real % progress instead of an
    // indeterminate spinner and (b) detect a truncated stream and error out
    // instead of hanging silently at "Opening … 90%".
    const upstreamEnc = (upstream.headers.get("content-encoding") || "").toLowerCase();
    if (upstreamLen && (upstreamEnc === "" || upstreamEnc === "identity")) {
      outHeaders["Content-Length"] = upstreamLen;
    }
    for (const h of ["etag", "last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) outHeaders[h] = v;
    }

    return new Response(req.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: headersWithCors(outHeaders),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = /timeout/i.test(message) || (error as { name?: string })?.name === "AbortError";
    console.error("pdf-proxy error", message);
    return new Response(JSON.stringify({ error: isTimeout ? "Upstream PDF timed out" : "PDF proxy failed" }), {
      status: isTimeout ? 504 : 500,
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
  return fetch(url, { headers, redirect: "follow", signal: timeoutSignal(UPSTREAM_TIMEOUT_MS) });
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
  // See Drive branch above: forwarding Content-Length from a relayed upstream
  // can make pdf.js abort on mobile when the body size differs after fetch
  // normalization. Chunked framing is safer for all proxied CDNs.
  for (const h of ["content-range", "etag", "last-modified"]) {
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
async function fetchDriveFile(id: string): Promise<Response> {
  const baseHeaders = new Headers({
    Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1",
    // Force identity so `Content-Length` we forward matches the actual byte
    // stream. Without this, Drive may respond with gzip/br and the length
    // we forward is the compressed size — pdf.js then aborts near the tail
    // with "Content-Length header ... exceeds response Body".
    "Accept-Encoding": "identity",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });

  const log = (tier: string, info: Record<string, unknown>) =>
    console.info("[pdf-proxy:drive]", tier, { id, ...info });

  const driveFetch = (url: string, headers: Headers) =>
    fetch(url, { headers, redirect: "follow", signal: timeoutSignal(DRIVE_UPSTREAM_TIMEOUT_MS) });

  // tier 1
  // acknowledgeAbuse=true bypasses the "can't scan for viruses" interstitial
  // that large Drive PDFs (>25MB) always hit — this is the #1 cause of the
  // "blank/could not load" reports from students opening lecture Drive links.
  const directUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&authuser=0&confirm=t&acknowledgeAbuse=true`;
  let res = await driveFetch(directUrl, baseHeaders);
  let ct = res.headers.get("content-type") || "";
  log("tier1-direct", { status: res.status, ct });
  if (res.ok && !/text\/html/i.test(ct)) {
    recordMetric({ event: "drive_success", drive_id: id, tier: "tier1-direct", last_status: res.status, last_content_type: ct });
    return res;
  }

  // tier 2
  const ucUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&acknowledgeAbuse=true`;
  res = await driveFetch(ucUrl, baseHeaders);
  ct = res.headers.get("content-type") || "";
  log("tier2-uc", { status: res.status, ct });
  if (!/text\/html/i.test(ct)) {
    recordMetric({ event: "drive_success", drive_id: id, tier: "tier2-uc", last_status: res.status, last_content_type: ct });
    return res;
  }

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
    const sep = formAction.includes("?") ? "&" : "?";
    const followUrl = `${formAction.replace(/&amp;/g, "&")}${sep}${qs}&acknowledgeAbuse=true`;
    res = await driveFetch(followUrl, confirmedHeaders);
    ct = res.headers.get("content-type") || "";
    log("tier2-form", { status: res.status, ct });
    if (res.ok && !/text\/html/i.test(ct)) {
      recordMetric({ event: "drive_success", drive_id: id, tier: "tier2-form", last_status: res.status, last_content_type: ct });
      return res;
    }
  }

  // tier 3 — legacy confirm token
  const token = html.match(/[?&]confirm=([0-9A-Za-z_\-]+)/)?.[1];
  if (token) {
    const confirmedHeaders = new Headers(baseHeaders);
    if (cookie) confirmedHeaders.set("Cookie", cookie);
    res = await driveFetch(`${ucUrl}&confirm=${encodeURIComponent(token)}`, confirmedHeaders);
    ct = res.headers.get("content-type") || "";
    log("tier3-token", { status: res.status, ct });
    if (res.ok && !/text\/html/i.test(ct)) {
      recordMetric({ event: "drive_success", drive_id: id, tier: "tier3-token", last_status: res.status, last_content_type: ct });
      return res;
    }
  }

  // tier 4 — docs.google.com mirror (older Drive ids still resolve here)
  const docsUrl = `https://docs.google.com/uc?export=download&id=${encodeURIComponent(id)}&acknowledgeAbuse=true`;
  res = await driveFetch(docsUrl, baseHeaders);
  ct = res.headers.get("content-type") || "";
  log("tier4-docs", { status: res.status, ct });
  if (res.ok && !/text\/html/i.test(ct)) {
    recordMetric({ event: "drive_success", drive_id: id, tier: "tier4-docs", last_status: res.status, last_content_type: ct });
    return res;
  }

  log("exhausted", { lastStatus: res.status });
  recordMetric({ event: "drive_exhausted", drive_id: id, tier: "exhausted", last_status: res.status, last_content_type: ct });
  return new Response(null, { status: 415, statusText: "Drive did not return a PDF" });
}