import { memo, useEffect, useState } from "react";
import { SpokeSpinner } from "../ui/spoke-spinner";

interface Props {
  /** When false, the overlay unmounts immediately. */
  visible: boolean;
  /** Title shown in the placeholder card. */
  title?: string;
  /**
   * Hint for the simulated curve when we have no real bytes yet.
   * - "pdf"   → canvas FastPdfReader path (real `pdf-progress` events arrive)
   * - "drive" → Google Drive iframe (no progress events possible — cross-origin)
   * - "notion"→ Notion edge proxy (single JSON fetch)
   * - "generic" → fallback
   */
  variant?: "pdf" | "drive" | "notion" | "generic";
}

/** Minimal blocking overlay matching the mobile screenshot: plain page + centered spinner. */
const ReaderProgress = memo(({ visible, title, variant = "pdf" }: Props) => {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (typeof window !== "undefined" && (window as unknown as { nb_pdf_debug?: boolean }).nb_pdf_debug) {
      // eslint-disable-next-line no-console
      console.info("[ReaderProgress] visible=true", { variant, title });
    }
    const onReady = (e: Event) => {
      if (typeof window !== "undefined" && (window as unknown as { nb_pdf_debug?: boolean }).nb_pdf_debug) {
        // eslint-disable-next-line no-console
        console.info("[ReaderProgress] pdf-ready received → fading out", (e as CustomEvent).detail);
      }
      setFadingOut(true);
    };
    window.addEventListener("pdf-ready", onReady);
    return () => {
      window.removeEventListener("pdf-ready", onReady);
    };
  }, [visible, variant, title]);

  if (!visible && !fadingOut) return null;

  const label =
    variant === "drive"
      ? "Opening from Google Drive…"
      : variant === "notion"
        ? "Loading page…"
        : title
          ? `Opening ${title}`
          : "Opening document…";

  return (
    <div
      aria-busy="true"
      aria-label={label}
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-300 ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      onTransitionEnd={() => {
        if (fadingOut) setFadingOut(false);
      }}
    >
      <SpokeSpinner />
      <p className="text-sm text-muted-foreground text-center px-6 max-w-xs">
        {label}
      </p>
    </div>
  );

});

ReaderProgress.displayName = "ReaderProgress";
export default ReaderProgress;
