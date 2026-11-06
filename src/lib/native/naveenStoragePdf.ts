import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { requestPdfViaNativeHttp } from "../nativePdfHttp";
import { supabase } from "@/integrations/supabase/client";
import { supabaseFunctionsUrl, supabaseRuntimeKey } from "@/integrations/supabase/runtime";

// The storage site moved: storage-naveenbharat-recording.vercel.app now
// 307-redirects to jsrstudy.vercel.app. Both hosts carry the same view ids.
const STORAGE_HOST_RE = /^(storage-naveenbharat-recording|jsrstudy)\.vercel\.app$/i;
/** Public, range-capable PDF endpoint on the storage site (no CORS headers). */
export const STORAGE_PUBLIC_PDF_BASE = "https://jsrstudy.vercel.app/api/public/pdf/";

export function naveenStoragePublicPdfUrl(url: string): string | null {
  const id = getNaveenStorageViewId(url);
  return id ? `${STORAGE_PUBLIC_PDF_BASE}${id}` : null;
}
const VIEW_ID_RE = /\/view\/([a-f0-9-]{20,})/i;

// External storage credentials moved server-side into the
// `resolve-storage-pdf` edge function. The client only sends a view_id +
// its own JWT; the edge function does the upstream calls with the
// server-held key. Do NOT reintroduce the raw upstream key here.

export function isNaveenStorageViewUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return STORAGE_HOST_RE.test(u.hostname) && VIEW_ID_RE.test(u.pathname);
  } catch {
    return false;
  }
}

export function getNaveenStorageViewId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!STORAGE_HOST_RE.test(u.hostname)) return null;
    return u.pathname.match(VIEW_ID_RE)?.[1] ?? null;
  } catch {
    return null;
  }
}

function abortError(): Error {
  const err = new Error("Native storage request aborted");
  err.name = "AbortError";
  return err;
}

async function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw abortError();
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => reject(abortError()), { once: true });
    }),
  ]);
}

async function fetchBlobViaNativeHttp(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<Blob | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const resp = await raceAbort(
      requestPdfViaNativeHttp(url, {
        method: "POST",
        signal,
        headers: { ...headers, "Content-Type": "application/json" },
        data: body,
      }),
      signal,
    );
    return resp;
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    return null;
  }
}

export async function fetchNaveenStoragePdf(url: string, signal?: AbortSignal): Promise<Blob> {
  const id = getNaveenStorageViewId(url);
  if (!id) throw new Error("Unsupported Naveen Bharat storage link");

  // Primary path: the storage site's public PDF endpoint. The old path below
  // (resolve-storage-pdf -> upstream `pdf_documents` table) now fails with
  // "permission denied for table pdf_documents", which every student saw as
  // "Document service didn't respond".
  //   - APK: CapacitorHttp ignores CORS, so fetch the endpoint directly.
  //   - Web: the endpoint sends no CORS headers, so relay via pdf-proxy.
  const publicUrl = `${STORAGE_PUBLIC_PDF_BASE}${id}`;
  let primaryError: unknown = null;
  try {
    const nativeDirect = await requestPdfViaNativeHttp(publicUrl, { signal });
    // CapacitorHttp labels every 2xx body "application/pdf", so check the
    // bytes: a Vercel error/challenge page must not reach the reader as a PDF.
    if (nativeDirect) {
      if (await looksLikePdf(nativeDirect)) return nativeDirect;
      throw Object.assign(new Error("HTTP 415: web page instead of a PDF"), { status: 415 });
    }
    const { remotePdfProxyUrl } = await import("../pdfViewerUrl");
    const resp = await fetch(remotePdfProxyUrl(publicUrl), { signal, credentials: "omit" });
    const ct = resp.headers.get("content-type") || "";
    if (resp.ok && !/text\/html|application\/json/i.test(ct)) {
      const blob = await resp.blob();
      if (await looksLikePdf(blob)) return blob;
      throw Object.assign(new Error("HTTP 415: web page instead of a PDF"), { status: 415 });
    }
    await resp.body?.cancel().catch(() => {});
    if (resp.status === 404) throw Object.assign(new Error("HTTP 404"), { status: 404 });
    throw Object.assign(new Error(`HTTP ${resp.status}`), { status: resp.status });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    if ((err as { status?: number })?.status === 404) throw err;
    // Anything else: try the legacy edge-function path, but report THIS
    // error if that fails too — the legacy path is known to be broken, and
    // its "Document service didn't respond" hid the real reason.
    primaryError = err;
  }

  try {
    return await fetchViaLegacyStorageProxy(id, signal);
  } catch (legacyErr) {
    if ((legacyErr as { name?: string })?.name === "AbortError") throw legacyErr;
    throw primaryError ?? legacyErr;
  }
}

/** True when the blob starts like a PDF (`%PDF-` within the first 1 KB). */
export async function looksLikePdf(blob: Blob): Promise<boolean> {
  try {
    const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
    for (let i = 0; i + 4 < head.length; i++) {
      if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46 && head[i + 4] === 0x2d) return true;
    }
    return false;
  } catch {
    return true; // can't inspect — let the reader decide
  }
}

async function fetchViaLegacyStorageProxy(id: string, signal?: AbortSignal): Promise<Blob> {

  // Route through our authenticated edge function. The upstream API key is
  // held server-side; this client only ever sends its own JWT + view_id.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sign in required to open this document");

  // Read the project URL/anon key from the compiled Supabase client first —
  // `import.meta.env` is undefined inside the pdf.js worker / some Capacitor
  // bundles, which used to surface as "Supabase client not configured".
  const anonKey = supabaseRuntimeKey;
  if (!anonKey) throw new Error("Supabase client not configured");


  const endpoint = supabaseFunctionsUrl("resolve-storage-pdf");
  const proxyHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  };
  const payload = { view_id: id };

  const nativeBlob = await fetchBlobViaNativeHttp(endpoint, proxyHeaders, payload, signal);
  if (nativeBlob) return nativeBlob;

  // Native APK must not fall back to WebView fetch for Edge Functions: the app
  // origin is `https://localhost`, so a retry here can surface Supabase's
  // generic "Failed to send a request to the Edge Function" toast. On web we
  // keep the browser fetch path.
  if (Capacitor.isNativePlatform()) {
    throw new Error("Storage proxy unavailable");
  }

  const post = (token: string) =>
    fetch(endpoint, {
      method: "POST",
      signal,
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  let fileResp = await post(accessToken);
  // An access token that expired between page load and tap makes the proxy
  // answer 401. One refresh is enough to unstick it.
  if (fileResp.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const freshToken = refreshed?.session?.access_token;
    if (freshToken) fileResp = await post(freshToken);
  }
  if (!fileResp.ok) {
    // The edge function returns a JSON body with an actionable message
    // (e.g. storage_key_missing). Showing "HTTP 503" instead hides it.
    let detail = "";
    let code = "";
    try {
      const body = await fileResp.clone().json() as { error?: string; code?: string };
      detail = typeof body?.error === "string" ? body.error : "";
      code = typeof body?.code === "string" ? body.code : "";
    } catch { /* non-JSON body — fall back to the status code */ }
    const err = new Error(
      [detail || `Storage proxy HTTP ${fileResp.status}`, code ? `(${code})` : ""].join(" ").trim(),
    ) as Error & { status?: number; code?: string };
    err.status = fileResp.status;
    if (code) err.code = code;
    throw err;
  }

  return fileResp.blob();
}

/**
 * True for any URL we know how to convert into raw PDF bytes.
 * Currently: Naveen-Bharat storage `/view/<id>` viewer pages.
 * (Generic remote PDFs are left alone so pdf.js can stream them with range
 * requests — pre-materializing them would break streaming.)
 */
export function isResolvableStorageViewerUrl(url: string): boolean {
  return isNaveenStorageViewUrl(url);
}

/** Resolve a known viewer URL into a PDF Blob. */
export async function resolveStorageBytes(url: string, signal?: AbortSignal): Promise<Blob> {
  if (isNaveenStorageViewUrl(url)) return fetchNaveenStoragePdf(url, signal);
  // Fallback: fetch directly; if we got HTML back, treat as failure.
  const resp = await fetch(url, { signal, credentials: "omit" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const ct = resp.headers.get("content-type") || "";
  if (/text\/html/i.test(ct)) throw new Error("Source is an HTML viewer, not a PDF");
  return resp.blob();
}
