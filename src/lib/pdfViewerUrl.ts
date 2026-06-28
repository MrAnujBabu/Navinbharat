/** Shared PDF embed URL builder — single source of truth */

/** Self-hosted PDF.js viewer (same-origin) so we can drive scroll programmatically. */
const PDFJS_VIEWER = "/pdfjs/web/viewer.html";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://cmbattmjwriiesibayfk.supabase.co";
const FUNCTIONS_BASE = SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co");

/** Google Drive file URL → preview embed */
export const isGoogleDrive = (url: string) => /drive\.google\.com/.test(url);

/** Google Docs document URL */
export const isGoogleDocs = (url: string) => /docs\.google\.com\/document/.test(url);

/**
 * Notion page URL detection. Matches both `*.notion.site/*` (published pages)
 * and `notion.so/*` (workspace URLs).
 *
 * IMPORTANT: Notion pages cannot be iframed from third-party origins.
 * Notion sets `x-frame-options: SAMEORIGIN` and `frame-ancestors 'self'`
 * — every public/published page returns these headers. Embedding in an iframe
 * produces a blank/blocked view. The correct UX is an "Open in Browser" card
 * (same pattern Substack/Medium/Twitter use). See PdfViewer's Notion branch.
 */
export const isNotion = (url: string): boolean => {
  if (!url) return false;
  const raw = url.trim();
  if (!raw) return false;
  const looksLikeNotionHost = /(?:^|\.)notion\.(?:site|so|com)(?:\/|$|[?#])/i.test(raw);

  try {
    const parsed = new URL(
      raw,
      /^https?:\/\//i.test(raw) ? undefined : looksLikeNotionHost ? `https://${raw}` : "https://x.invalid",
    );
    const host = parsed.hostname.toLowerCase();
    return (
      host === "notion.site" ||
      host.endsWith(".notion.site") ||
      host === "notion.so" ||
      host.endsWith(".notion.so") ||
      host === "notion.com" ||
      host.endsWith(".notion.com")
    );
  } catch {
    return looksLikeNotionHost;
  }
};

/**
 * Consolidated HTML-app URL detector. These URLs look like https:// but point
 * at HTML viewer apps (Notion, Drive `/view`, Docs) — they MUST be rendered
 * by the in-app viewer; the native OS document opener cannot parse them.
 */
export const isHtmlAppUrl = (url: string): boolean =>
  isNotion(url) || isGoogleDrive(url) || isGoogleDocs(url);

/**
 * Strip Notion tracking params (`?source=copy_link`, `pvs=4`, etc.) so the
 * external open URL is canonical.
 */
export const cleanNotionUrl = (url: string): string => {
  try {
    const u = new URL(url);
    ["source", "pvs", "p"].forEach((k) => u.searchParams.delete(k));
    return u.toString().replace(/\?$/, "");
  } catch {
    return url;
  }
};

/**
 * Extract the 32-char Notion page id from any notion.site / notion.so URL.
 * Notion appends the id (with or without hyphens) at the end of the slug:
 *   /Top-Tools-Notion-3888ce5904b0800ea8a8d485918c83b7
 *   /Top-Tools-3888ce59-04b0-800e-a8a8-d485918c83b7
 */
export const extractNotionPageId = (url: string): string | null => {
  const normalize = (value: string | null | undefined) => {
    if (!value) return null;
    const m = value.match(/[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return m?.[0]?.replace(/-/g, "").toLowerCase() ?? null;
  };

  try {
    const parsed = new URL(url, /^https?:\/\//i.test(url) ? undefined : "https://notion.so");
    const queryId = normalize(parsed.searchParams.get("p")) || normalize(parsed.hash);
    if (queryId) return queryId;
  } catch {
    // Fall through to raw string extraction.
  }

  const matches = decodeURIComponent(url).match(/[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
  const last = matches?.[matches.length - 1];
  return last?.replace(/-/g, "").toLowerCase() ?? null;
};

/** Notion-page JSON proxy (returns recordMap for react-notion-x). */
export const notionPageProxyUrl = (pageId: string): string =>
  `${FUNCTIONS_BASE}/notion-page?id=${encodeURIComponent(pageId)}`;

/** jsDelivr CDN URL (direct PDF hosting) */
export const isJsDelivrCdn = (url: string) => /cdn\.jsdelivr\.net/i.test(url);

/** GitHub Storages CDN viewer (already a viewer page) */
export const isGithubStoragesCdn = (url: string) =>
  /github-storages-cdn\.vercel\.app/i.test(url);

/** Naveen Bharat Storage viewer (already a viewer page) */
export const isNaveenBharatStorage = (url: string) =>
  /storage-naveenbharat-recording\.vercel\.app/i.test(url);

/** Extract Google Drive file ID */
export const extractDriveFileId = (url: string): string | null => {
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m1?.[1] || m2?.[1] || null;
};

/**
 * Public Google Drive file → CORS-enabled PDF proxy for local PDF.js rendering.
 *
 * NOTE (2026-06): The proxy is OPT-IN now. By default Drive PDFs embed via
 * Drive's own `/preview` iframe — zero edge-function load, no 60 MB-per-file
 * bandwidth bill, no Drive-interstitial-parser maintenance. Build a proxy URL
 * explicitly only when same-origin bytes are required (canvas autoscroll,
 * page-restore, screen protection).
 */
export const googleDrivePdfProxyUrl = (url: string): string | null => {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `${FUNCTIONS_BASE}/pdf-proxy?kind=drive&id=${encodeURIComponent(id)}`;
};

/** CORS-safe proxy for trusted direct PDF CDNs that redirect/open web pages in Android WebView. */
export const remotePdfProxyUrl = (url: string): string =>
  `${FUNCTIONS_BASE}/pdf-proxy?kind=url&url=${encodeURIComponent(url)}`;

/**
 * Convert remote PDFs into a renderable source.
 * Drive URLs are intentionally passed through unchanged — they render via
 * Drive's `/preview` iframe in resolveEmbedUrl(), keeping the edge function
 * cold for the common case.
 */
export const renderablePdfUrl = (rawUrl: string): string => {
  const url = sanitizeRemoteUrl(rawUrl);
  if (isJsDelivrCdn(url)) return remotePdfProxyUrl(url);
  return url;
};

/** Extract Google Docs document ID */
export const extractDocsId = (url: string): string | null => {
  const m = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m?.[1] || null;
};

/** Build PDF.js CDN viewer URL (fast, client-side rendering) */
export const pdfJsViewerUrl = (fileUrl: string): string =>
  `${PDFJS_VIEWER}?file=${encodeURIComponent(fileUrl)}#toolbar=0&navpanes=0&pagemode=none`;

/** Google Docs viewer fallback for external PDFs that block CORS */
export const googleDocsViewerUrl = (fileUrl: string): string =>
  `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;

/**
 * Detect any remote URL (used to gate routing through /pdfjs viewer).
 * Previously these routed to Google `gview`, which has NO autoscroll bridge
 * — silently failing with "Save this file to My Library to enable it".
 */
const isExternalPdf = (url: string): boolean => {
  try {
    const u = new URL(url);
    return !!u.hostname;
  } catch {
    return false;
  }
};

/**
 * Resolve the best embed URL for any document URL.
 * Returns { embedUrl, openUrl, isDrive }
 */
/**
 * Normalize malformed remote URLs. The CMS sometimes stores PDF URLs with
 * literal spaces (e.g. "…/Suffer English /Day 2 _Re NEET (1).pdf"). Browsers'
 * `fetch`, PDF.js, and our own `pdf-proxy` edge function all reject those as
 * malformed → reader shows a blank screen. Encoding raw whitespace to %20
 * fixes the load without touching already-encoded paths.
 */
export const sanitizeRemoteUrl = (url: string): string => {
  if (!url) return url;
  if (/^(blob:|data:|file:|capacitor:|ionic:)/i.test(url)) return url;
  if (!/[\s]/.test(url)) return url;
  return url.replace(/ /g, "%20").replace(/\t/g, "%09");
};

export function resolveEmbedUrl(rawUrl: string): {
  embedUrl: string;
  openUrl: string;
  isDrive: boolean;
} {
  const url = sanitizeRemoteUrl(rawUrl);
  // Local-origin URLs (blob:, data:, file:, capacitor://, ionic://) can't be
  // loaded by the remote PDF.js viewer (cross-origin). Browsers + Capacitor
  // WebView render these natively in an <iframe>, so embed directly.
  if (/^(blob:|data:|file:|capacitor:|ionic:)/i.test(url)) {
    return { embedUrl: url, openUrl: url, isDrive: false };
  }

  // Google Drive → ALWAYS render through pdf-proxy + self-hosted PDF.js viewer.
  // Why: Drive's `/preview` iframe is unreliable in mobile browsers (Firefox,
  // Android WebView) due to X-Frame-Options / 3rd-party-cookie restrictions
  // and for files whose share permissions block embedding — the iframe shows
  // a blank screen or a "You need access" page. Routing through pdf-proxy
  // streams the raw bytes and renders them in pdf.js inside the app, which
  // works for both web and Capacitor APK. `openUrl` still points at Drive
  // so external-open keeps working.
  if (isGoogleDrive(url)) {
    const fileId = extractDriveFileId(url);
    if (fileId) {
      const proxied = googleDrivePdfProxyUrl(url);
      if (proxied) {
        return {
          embedUrl: pdfJsViewerUrl(proxied),
          openUrl: `https://drive.google.com/file/d/${fileId}/view`,
          isDrive: true,
        };
      }
      return {
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        openUrl: `https://drive.google.com/file/d/${fileId}/view`,
        isDrive: true,
      };
    }
  }


  // Google Docs
  if (isGoogleDocs(url)) {
    const docId = extractDocsId(url);
    if (docId) {
      return {
        embedUrl: `https://docs.google.com/document/d/${docId}/preview`,
        openUrl: `https://docs.google.com/document/d/${docId}/edit`,
        isDrive: false,
      };
    }
  }

  // Notion page → CANNOT be iframed (x-frame-options: SAMEORIGIN).
  // We hand the URL back as both embed and open; PdfViewer renders a
  // dedicated "Open in Notion" card instead of trying to embed.
  if (isNotion(url)) {
    const clean = cleanNotionUrl(url);
    return { embedUrl: clean, openUrl: clean, isDrive: false };
  }

  // Custom viewer pages — embed directly
  if (isGithubStoragesCdn(url) || isNaveenBharatStorage(url)) {
    return { embedUrl: url, openUrl: url, isDrive: false };
  }

  // External PDFs → self-hosted PDF.js viewer (has nb-bridge.js for autoscroll).
  // gview was removed: it broke autoscroll and stalled 5–15 s on first paint.
  if (isExternalPdf(url)) {
    const safeUrl = renderablePdfUrl(url);
    return {
      embedUrl: pdfJsViewerUrl(safeUrl),
      openUrl: safeUrl,
      isDrive: false,
    };
  }


  // Everything else (jsDelivr, Supabase, generic PDFs) → PDF.js CDN viewer.
  // (Was incorrectly returning gview here, which caused 5–15s "Loading PDF…"
  // stalls. PDF.js renders client-side and starts streaming pages immediately.)
  return {
    embedUrl: pdfJsViewerUrl(url),
    openUrl: url,
    isDrive: false,
  };
}
