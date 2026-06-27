import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

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

/**
 * Determinate-when-possible, smooth-fake-when-not loading overlay for the
 * DocumentReader. Listens to global `pdf-progress` / `pdf-first-byte` events
 * dispatched by FastPdfReader so PDFs show real download percentage. For
 * iframe surfaces (Drive/Docs) where the WebView is cross-origin and cannot
 * report bytes, it eases 0→90% over ~6s and locks until `pdf-ready` fires.
 *
 * UX rules:
 *   • Never show a blank white screen — always at least a soft skeleton card.
 *   • Progress only ever increases (we clamp to max).
 *   • At 100% (or `pdf-ready`) we fade out over 250ms.
 */
const ReaderProgress = memo(({ visible, title, variant = "pdf" }: Props) => {
  const [percent, setPercent] = useState(2);
  const [fadingOut, setFadingOut] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);
  const [stalled, setStalled] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(performance.now());
  const stallTimerRef = useRef<number | null>(null);

  // Reset stall timer on every real progress event. If no event arrives for
  // 3s while the overlay is visible, flip to indeterminate so the user knows
  // we're still trying (vs the bar freezing at e.g. 47%).
  const armStallTimer = useCallback(() => {
    if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
    setStalled(false);
    stallTimerRef.current = window.setTimeout(() => {
      setStalled(true);
      setIndeterminate(true);
    }, 3000);
  }, []);

  // Real progress events from FastPdfReader.
  useEffect(() => {
    if (!visible) return;
    armStallTimer();
    const onProg = (e: Event) => {
      const detail = (e as CustomEvent).detail as { percent: number } | undefined;
      if (!detail) return;
      armStallTimer();
      if (detail.percent < 0) {
        setIndeterminate(true);
        return;
      }
      setIndeterminate(false);
      setPercent((p) => Math.max(p, Math.min(99, detail.percent)));
    };
    const onReady = () => {
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
      setPercent(100);
      setFadingOut(true);
    };
    window.addEventListener("pdf-progress", onProg as EventListener);
    window.addEventListener("pdf-ready", onReady);
    return () => {
      window.removeEventListener("pdf-progress", onProg as EventListener);
      window.removeEventListener("pdf-ready", onReady);
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
    };
  }, [visible, armStallTimer]);

  // Smooth fake easing for surfaces that cannot report real bytes (Drive
  // iframe, Notion edge proxy before recordMap arrives). We cap at 90%; the
  // remaining 10% jumps when the real ready event fires.
  useEffect(() => {
    if (!visible) return;
    startRef.current = performance.now();
    const cap = variant === "drive" ? 92 : variant === "notion" ? 85 : 80;
    // Approx. 6s to reach the cap → feels brisk but believable.
    const durationMs = variant === "drive" ? 6000 : 4500;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const eased = 1 - Math.pow(1 - Math.min(1, elapsed / durationMs), 3);
      const target = Math.round(eased * cap);
      setPercent((p) => (p >= 99 ? p : Math.max(p, target)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, variant]);

  if (!visible && !fadingOut) return null;

  const showPercent = !indeterminate && percent > 0;

  return (
    <div
      aria-busy="true"
      className={`absolute inset-0 z-20 flex flex-col items-center justify-start bg-background px-6 pt-[22vh] transition-opacity duration-300 ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      onTransitionEnd={() => {
        if (fadingOut) setFadingOut(false);
      }}
    >
      {/* Minimal ed-tech style: icon → title → tiny spinner + percent. No top bar. */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.04]">
          <FileText className="h-6 w-6 text-foreground/60" strokeWidth={1.75} />
        </div>
        {/* Only the title is announced — the percent ticker would spam SRs. */}
        <p
          aria-live="polite"
          className="text-[15px] font-medium text-foreground line-clamp-1 max-w-[80vw]"
        >
          {title || "Opening document"}
        </p>
        <div
          aria-hidden="true"
          className="flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground tabular-nums"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>
            {indeterminate || !showPercent ? "Loading…" : `Loading ${percent}%`}
          </span>
        </div>
        {stalled && (
          <p aria-live="polite" className="text-[12px] text-muted-foreground/80">
            Still loading… check your connection
          </p>
        )}
      </div>
    </div>
  );
});

ReaderProgress.displayName = "ReaderProgress";
export default ReaderProgress;
