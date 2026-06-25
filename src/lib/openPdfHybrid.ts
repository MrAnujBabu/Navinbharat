/**
 * Hybrid PDF opener for chip-section (Notes / DPP / Attachments) tap handlers.
 *
 * Why this exists:
 *   The in-app pdf.js viewer renders BLANK inside the Capacitor Android WebView
 *   for many remote PDFs (Drive, Supabase signed URLs, jsDelivr, large files,
 *   embedded fonts). The same URLs work fine in a desktop browser. Until the
 *   in-app viewer is fully audited, we hand the file off to the OS reader on
 *   native — that path is 100% reliable and re-uses the existing
 *   `openFileNative()` helper that the Downloads page already trusts.
 *
 * Behavior:
 *   - Web                       → returns false, caller mounts in-app <PdfViewer>.
 *   - Native + native open OK   → returns true, caller does NOT mount viewer.
 *   - Native + native open fails → returns false, caller falls back to in-app
 *     viewer + a toast tells the user we tried OS handoff first.
 */
import { toast } from "sonner";
import type { DownloadRecord } from "./indexedDB";
import { openFileNative } from "./nativeFileOpener";
import { openExternal } from "./native/browser";

function isNative(): boolean {
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
}

/** Best-effort filename when caller only has a URL. */
function deriveFilename(url: string, fallback: string): string {
  try {
    const u = new URL(url, "https://localhost");
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last);
  } catch { /* ignore */ }
  return fallback.toLowerCase().endsWith(".pdf") ? fallback : `${fallback}.pdf`;
}

export interface HybridOpenInput {
  url: string;
  fileName: string;
  /** Optional already-cached download row (e.g. offline-saved attachment). */
  record?: Partial<DownloadRecord>;
}

/**
 * Try to open `url` natively. Returns true ONLY when the OS reader was
 * successfully invoked. Web + every failure path returns false so the caller
 * can mount the in-app viewer.
 */
export async function openPdfHybrid({ url, fileName, record }: HybridOpenInput): Promise<boolean> {
  if (!isNative()) return false;
  if (!url) return false;

  // Drive/Docs/Notion are HTML viewer pages, not direct PDF bytes. In the APK
  // those cross-origin iframes can render blank, so open them in a dedicated
  // in-app native WebView instead of the PDF surface or external browser.
  if (/drive\.google\.com|docs\.google\.com|notion\.(site|so)/i.test(url)) {
    try {
      await openExternal(url);
      return true;
    } catch (err) {
      console.warn("[openPdfHybrid] in-app browser open failed", err);
      toast.error("Could not open link", { description: "Please try again." });
      return false;
    }
  }

  const filename = deriveFilename(url, fileName || "document");
  const rec: DownloadRecord = {
    title: fileName || filename,
    filename,
    url,
    downloadedAt: new Date().toISOString(),
    fileType: "PDF",
    mime: "application/pdf",
    ...record,
  };

  try {
    const opened = await openFileNative(rec);
    if (opened) return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[openPdfHybrid] native open threw", err);
  }
  // Native attempted but failed → tell the user we're falling back.
  toast.message("Opening in app reader…", {
    description: "OS reader unavailable for this file.",
    duration: 2500,
  });
  return false;
}