import { supabase } from "../integrations/supabase/client";
import { supabaseRuntimeUrl } from "../integrations/supabase/runtime";
import { logWarn } from "./log";

/**
 * Downloads and library items store the URL they were saved with. Supabase
 * signed URLs expire (often after 1h), so reopening later returns 403.
 * Detect this project's storage URLs (signed, public or authenticated) and
 * mint a fresh signed URL for the same bucket/path. Anything else is returned
 * unchanged.
 */
const PROJECT_HOST = (() => {
  try {
    return new URL(supabaseRuntimeUrl).host;
  } catch {
    return null;
  }
})();

const STORAGE_RE = /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/;

export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    if (PROJECT_HOST && u.host !== PROJECT_HOST) return null;
    const m = STORAGE_RE.exec(u.pathname);
    if (!m) return null;
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

export async function refreshSignedStorageUrl(url: string, ttlSeconds = 60 * 60): Promise<string> {
  const parsed = parseStorageUrl(url);
  if (!parsed) return url;
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, ttlSeconds);
  if (error || !data?.signedUrl) {
    logWarn("[refreshSignedStorageUrl] re-sign failed", { bucket: parsed.bucket, error: error?.message });
    return url;
  }
  return data.signedUrl;
}
