/**
 * Google Drive files can be shared publicly and still refuse every download
 * endpoint when the owner ticked "Viewers and commenters cannot download,
 * print, copy". `pdf-proxy` detects that interstitial and answers with
 * `{ type: "drive_download_disabled", viewUrl }` (HTTP 403).
 *
 * pdf.js only surfaces the status code, so the reader used to show the
 * generic "This Drive file is private" copy. This helper re-asks the proxy
 * for the JSON body so the UI can state the real reason and offer
 * "Open in Drive" instead of a Retry that can never succeed.
 *
 * Security: only ever called with the app's own proxy/Drive URLs, and it
 * never echoes the URL or any token back to the UI.
 */

export const DRIVE_DOWNLOAD_DISABLED_MSG =
  "Is Drive file ka download owner ne band kar rakha hai — ise sirf Drive par khola ja sakta hai. Neeche \"Open in Drive\" tap karein.";

export interface DriveBlockInfo {
  message: string;
  viewUrl: string;
}

function driveIdFrom(src: string): string | null {
  const m =
    src.match(/[?&]id=([A-Za-z0-9_-]{10,})/) ||
    src.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/) ||
    src.match(/[?&]kind=drive[^#]*?[?&]id=([A-Za-z0-9_-]{10,})/);
  return m?.[1] || null;
}

/**
 * Returns download-disabled details when the source is a Drive-backed URL the
 * proxy rejected for that reason; `null` in every other case.
 */
export async function probeDriveBlock(
  src: string | null | undefined,
  signal?: AbortSignal,
): Promise<DriveBlockInfo | null> {
  if (!src || !/^https?:/i.test(src)) return null;
  if (!/drive\.google\.com|googleusercontent\.com|[?&]kind=drive/i.test(src)) return null;

  try {
    const res = await fetch(src, { credentials: "omit", cache: "no-store", signal });
    if (res.ok) return null;
    const code = res.headers.get("x-pdf-error-code") || "";
    const body = (await res.json().catch(() => null)) as
      | { type?: string; viewUrl?: string }
      | null;
    const type = body?.type || code;
    if (type !== "drive_download_disabled") return null;
    const id = driveIdFrom(src);
    return {
      message: DRIVE_DOWNLOAD_DISABLED_MSG,
      viewUrl: body?.viewUrl || (id ? `https://drive.google.com/file/d/${id}/view` : "https://drive.google.com"),
    };
  } catch {
    return null;
  }
}
