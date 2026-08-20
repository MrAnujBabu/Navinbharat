import { useEffect, useState } from "react";

/**
 * Portal host for floating reader UI (autoscroll FAB, page pill).
 *
 * Why: elements portalled into <body> are NOT rendered while another element
 * (the reader shell) is in browser fullscreen — the top layer only paints the
 * fullscreen element's subtree. Re-target the portal at the fullscreen element
 * whenever one exists so the FAB / pill stay visible in fullscreen.
 */
export function usePortalHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : document.body
  );

  useEffect(() => {
    const sync = () => {
      const fs =
        (document.fullscreenElement as HTMLElement | null) ??
        ((document as Document & { webkitFullscreenElement?: Element })
          .webkitFullscreenElement as HTMLElement | null) ??
        null;
      setHost(fs ?? document.body);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  return host;
}

export default usePortalHost;
