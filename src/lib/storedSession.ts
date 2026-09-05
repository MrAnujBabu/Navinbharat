/**
 * Cheap, synchronous "was this device signed in?" probe.
 *
 * Supabase restores the session asynchronously, so on a cold app start there
 * is a window where `isAuthenticated` is still false. Rendering the public
 * landing page in that window makes an already-signed-in user think they were
 * logged out. Reading the persisted token key lets the router hold a loader
 * for those few hundred milliseconds instead.
 *
 * This is a UX hint only — never an authorization signal.
 */
export function hasStoredSession(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (/^sb-.*-auth-token(\.\d+)?$/.test(key)) {
        const raw = localStorage.getItem(key);
        if (raw && raw !== "" && raw !== "null") return true;
      }
    }
  } catch {
    /* private mode / disabled storage → treat as signed out */
  }
  return false;
}
