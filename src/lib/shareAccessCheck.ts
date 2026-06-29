/**
 * Pre-flight share-permission check for Drive & Notion URLs.
 *
 * Why: even with proxy + iframe fallback, if the source file isn't
 * "Anyone with link" public, BOTH paths fail and the reader shows
 * a perpetual blank/error. Validating at save-time prevents bad
 * URLs from ever entering the DB.
 */
import {
  isGoogleDrive,
  isNotion,
  extractDriveFileId,
  extractNotionPageId,
  googleDrivePdfProxyUrl,
  notionPageProxyUrl,
} from "./pdfViewerUrl";

export type ShareCheckResult =
  | { ok: true; kind: "drive" | "notion" | "other" }
  | { ok: false; kind: "drive" | "notion"; reason: string; hint: string };

const TIMEOUT_MS = 8000;

const withTimeout = async (url: string, init?: RequestInit): Promise<Response> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
};

const checkDrive = async (url: string): Promise<ShareCheckResult> => {
  const id = extractDriveFileId(url);
  if (!id) {
    return {
      ok: false,
      kind: "drive",
      reason: "Invalid Google Drive link",
      hint: "Use a link like https://drive.google.com/file/d/FILE_ID/view",
    };
  }
  const proxy = googleDrivePdfProxyUrl(url);
  if (!proxy) {
    return { ok: false, kind: "drive", reason: "Cannot build proxy URL", hint: "Check the Drive link format." };
  }
  try {
    // Range request — only ~1KB; verifies bytes are reachable through proxy.
    const res = await withTimeout(proxy, {
      method: "GET",
      headers: { Range: "bytes=0-1023" },
    });
    if (res.status === 200 || res.status === 206) {
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      // Drive returns HTML interstitial when file is NOT public.
      if (ct.includes("text/html")) {
        return {
          ok: false,
          kind: "drive",
          reason: "Drive file is not public",
          hint: 'Open the file → Share → "Anyone with the link" → Viewer. Then save again.',
        };
      }
      return { ok: true, kind: "drive" };
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return {
        ok: false,
        kind: "drive",
        reason: `Drive returned ${res.status} (not accessible)`,
        hint: 'Set the file to "Anyone with the link → Viewer" in Google Drive Share settings.',
      };
    }
    return {
      ok: false,
      kind: "drive",
      reason: `Unexpected status ${res.status}`,
      hint: "Try again, or re-share the Drive file as Anyone-with-link.",
    };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return {
        ok: false,
        kind: "drive",
        reason: "Permission check timed out",
        hint: "Check your internet, then retry. If it persists, re-share the file.",
      };
    }
    return {
      ok: false,
      kind: "drive",
      reason: e?.message || "Network error",
      hint: "Try again in a moment.",
    };
  }
};

const checkNotion = async (url: string): Promise<ShareCheckResult> => {
  const id = extractNotionPageId(url);
  if (!id) {
    return {
      ok: false,
      kind: "notion",
      reason: "Invalid Notion page link",
      hint: "Copy the link from Share → Copy link on the Notion page.",
    };
  }
  try {
    const res = await withTimeout(notionPageProxyUrl(id), { method: "GET" });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.recordMap || data.success !== false)) {
        return { ok: true, kind: "notion" };
      }
      return {
        ok: false,
        kind: "notion",
        reason: "Notion page is not public",
        hint: 'Open the Notion page → Share → "Publish to web" (or set link access to anyone).',
      };
    }
    return {
      ok: false,
      kind: "notion",
      reason: `Notion returned ${res.status}`,
      hint: 'Publish the page: Notion → Share → "Publish to web".',
    };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return {
        ok: false,
        kind: "notion",
        reason: "Permission check timed out",
        hint: "Check your internet and retry.",
      };
    }
    return {
      ok: false,
      kind: "notion",
      reason: e?.message || "Network error",
      hint: "Try again in a moment.",
    };
  }
};

/**
 * Verify a Drive/Notion URL is publicly accessible BEFORE saving.
 * Non-Drive/Notion URLs short-circuit to ok:true (no check needed).
 */
export const verifyShareAccess = async (url: string): Promise<ShareCheckResult> => {
  const u = (url || "").trim();
  if (!u) return { ok: true, kind: "other" };
  if (isGoogleDrive(u)) return checkDrive(u);
  if (isNotion(u)) return checkNotion(u);
  return { ok: true, kind: "other" };
};
