import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { safeGet, safeSet } from "../lib/storage";

const SPEED_KEY = "nb_autoscroll_speed";
const perDocSpeedKey = (k: string) => `nb_autoscroll_speed:${k}`;
const perDocActiveKey = (k: string) => `nb_autoscroll_active:${k}`;

export interface AutoScrollOptions {
  /** DOM element to scroll (same-origin markdown / native scrollers). */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** Iframe element (cross-origin PDF/Doc viewers). Used as keystroke fallback. */
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  /** Stable per-document id — enables per-doc speed + auto-resume via localStorage. */
  docKey?: string;
}

/**
 * Autoscroll engine.
 * - Single tap → toggle (caller wires `toggle()` to onClick).
 * - Long-press → caller opens speed picker, then calls `setSpeed(...)`.
 * - Persists chosen speed in localStorage (global + per-doc when `docKey` given).
 * - When `docKey` is provided, remembers active-state per-doc and auto-resumes on remount.
 * - For same-origin scrollers we increment scrollTop on rAF.
 * - For cross-origin iframes we send periodic ArrowDown keydown events (best-effort).
 */
export function useAutoScroll({ targetRef, iframeRef, docKey }: AutoScrollOptions) {
  const [active, setActive] = useState(false);
  const [speed, _setSpeed] = useState<number>(() => {
    const perDoc = docKey ? safeGet(perDocSpeedKey(docKey)) : "";
    const s = parseFloat(perDoc || safeGet(SPEED_KEY) || "");
    return Number.isFinite(s) && s > 0 ? s : 1;
  });
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  /**
   * Authoritative float scroll position. `scrollTop` is snapped to whole
   * device pixels on read-back in Android WebView, so using it as the source
   * of truth silently destroyed sub-pixel deltas (0.1–0.5x barely moved).
   * We own the position as a float and only ever *write* it to the element.
   */
  const posRef = useRef<number>(0);
  /** Restores the target's inline scroll-behavior when the engine stops. */
  const prevScrollBehaviorRef = useRef<string | null>(null);
  const behaviorElRef = useRef<HTMLElement | null>(null);
  const iframeTickRef = useRef<number | null>(null);
  /** Element receiving the sub-pixel `translate3d` remainder while running. */
  const smoothElRef = useRef<HTMLElement | null>(null);
  const prevTransformRef = useRef<string | null>(null);
  const msgHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const supportTimerRef = useRef<number | null>(null);
  /** Mirrors `active` so callbacks/loops never read a stale closure value. */
  const activeRef = useRef(false);
  /** True while the user holds to pause (engine stopped, state stays active). */
  const pausedRef = useRef(false);
  /** Live speed for the running loop — avoids restarting the engine on change. */
  const speedRef = useRef(speed);
  /** ms spent parked at the bottom — guards against premature auto-stop. */
  const endWaitRef = useRef(0);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  /**
   * Picks the element that can carry the sub-pixel remainder for a scroller.
   * A scroll container can only land on whole device pixels, so at 0.1–0.5x
   * the page freezes for several frames and then jumps 1px. We keep the
   * integer part in `scrollTop` and paint the leftover fraction as a
   * compositor-only transform on the content wrapper, which makes low speeds
   * glide instead of staircase.
   *
   * Skipped when: reduced motion is requested, no suitable wrapper exists, or
   * the wrapper already carries a transform (pinch-zoom keeps priority).
   */
  const pickSmoothEl = (el: HTMLElement): HTMLElement | null => {
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
      const doc = el.querySelector<HTMLElement>(".react-pdf__Document");
      const candidate =
        doc ??
        (Array.from(el.children).find(
          (c) =>
            c instanceof HTMLElement &&
            getComputedStyle(c).position !== "sticky" &&
            getComputedStyle(c).position !== "fixed"
        ) as HTMLElement | undefined) ??
        null;
      if (!candidate) return null;
      const t = getComputedStyle(candidate).transform;
      if (t && t !== "none") return null; // zoomed / already transformed
      return candidate;
    } catch {
      return null;
    }
  };

  const clearSmoothing = () => {
    if (smoothElRef.current) {
      smoothElRef.current.style.transform = prevTransformRef.current ?? "";
      smoothElRef.current.style.willChange = "";
      smoothElRef.current = null;
      prevTransformRef.current = null;
    }
  };

  const setSpeed = useCallback((s: number) => {
    // Quantise to 2 decimals so 0.75 survives (the old *10 rounding made it 0.8).
    const clamped = Math.max(0.1, Math.min(10, Math.round(s * 100) / 100));
    speedRef.current = clamped;
    _setSpeed(clamped);
    safeSet(SPEED_KEY, String(clamped));
    if (docKey) safeSet(perDocSpeedKey(docKey), String(clamped));
  }, [docKey]);


  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    clearSmoothing();
    // Give the target its CSS scroll-behavior back.
    if (behaviorElRef.current) {
      behaviorElRef.current.style.scrollBehavior = prevScrollBehaviorRef.current ?? "";
      behaviorElRef.current = null;
      prevScrollBehaviorRef.current = null;
    }
    if (iframeTickRef.current != null) clearInterval(iframeTickRef.current);
    iframeTickRef.current = null;
    if (msgHandlerRef.current) {
      window.removeEventListener("message", msgHandlerRef.current);
      msgHandlerRef.current = null;
    }
    if (supportTimerRef.current != null) {
      window.clearTimeout(supportTimerRef.current);
      supportTimerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    pausedRef.current = false;
    endWaitRef.current = 0;
    const el = targetRef?.current ?? null;
    const ifr = iframeRef?.current ?? null;
    // A wrapper div that merely *contains* an iframe reports no scroll range.
    // Previously we still picked it and the loop stopped on the first frame
    // ("atEnd"), which is the main reason autoscroll looked dead on PDFs.
    const elScrollable = !!el && el.scrollHeight - el.clientHeight > 2;
    const useEl = !!el && (elScrollable || !ifr);
    if (useEl && el) {
      // Same-origin: smooth pixel scroll. speed = px per 16.67ms (60fps baseline).
      // `scroll-behavior: smooth` (set globally on <html> and on some readers)
      // turns every per-frame scrollTop write into a *new* smooth-scroll
      // animation request. 60 overlapping animations/sec = guaranteed stutter.
      // Force `auto` while running and restore it in stop().
      behaviorElRef.current = el;
      prevScrollBehaviorRef.current = el.style.scrollBehavior;
      el.style.scrollBehavior = "auto";
      lastTsRef.current = 0;
      posRef.current = el.scrollTop;
      // Attach the sub-pixel smoothing wrapper (see pickSmoothEl). Re-picked
      // lazily inside the loop because the PDF Document mounts after start().
      let smoothChecked = false;
      // Virtualization guard state — recomputed at most every 150ms instead of
      // running a full querySelectorAll on every single animation frame.
      let pendingUntil = 0;
      let pendingCached = false;
      const step = (ts: number) => {
        if (!lastTsRef.current) lastTsRef.current = ts;
        const dt = Math.min(4, (ts - lastTsRef.current) / 16.67); // cap dt to avoid jumps after tab-away
        lastTsRef.current = ts;
        const max = el.scrollHeight - el.clientHeight;
        if (max > 2) {
          // The user (or a programmatic jump) moved the scroller out from
          // under us — re-seed instead of fighting them.
          if (Math.abs(el.scrollTop - posRef.current) > 2) posRef.current = el.scrollTop;
          // Large Archive scans virtualize canvases to keep WebView memory flat.
          // If the next page slot has entered the viewport but its canvas is
          // still decoding, hold position for this frame. This prevents
          // autoscroll from outrunning PDF.js and queuing many image decodes.
          if (el.dataset.archiveVirtualized === "true") {
            if (ts >= pendingUntil) {
              pendingUntil = ts + 150;
              // getBoundingClientRect is measured against the scroller's own
              // viewport, so a zoom `transform` on the pages wrapper (which
              // makes it a containing block and breaks offsetTop) can't send
              // this guard into a permanent "pending" freeze.
              const rootTop = el.getBoundingClientRect().top;
              pendingCached = Array.from(
                el.querySelectorAll<HTMLElement>('[data-page-rendered="false"]')
              ).some((page) => {
                const top = page.getBoundingClientRect().top - rootTop;
                return top >= -240 && top <= el.clientHeight + 240;
              });
            }
            if (pendingCached) {
              posRef.current = el.scrollTop;
              rafRef.current = requestAnimationFrame(step);
              return;
            }
          }
          // Accumulate into the float position and write it every frame. The
          // fractional remainder is never discarded, so 0.1x advances exactly
          // ~6px/sec instead of stalling on integer snapping.
          posRef.current = Math.min(max, posRef.current + speedRef.current * dt);
          const whole = Math.floor(posRef.current);
          el.scrollTop = whole;
          if (!smoothChecked && !smoothElRef.current) {
            const cand = pickSmoothEl(el);
            if (cand) {
              smoothElRef.current = cand;
              prevTransformRef.current = cand.style.transform;
              cand.style.willChange = "transform";
            }
            // Retry once content mounts; stop probing after the first hit.
            smoothChecked = !!cand;
          }
          if (smoothElRef.current) {
            const frac = posRef.current - whole;
            smoothElRef.current.style.transform = `translate3d(0, ${-frac}px, 0)`;
          }
          if (posRef.current >= max - 1) {
            // Reached the end of what's rendered so far. Lazy readers (pdf.js,
            // markdown, infinite lists) grow later — idle instead of killing the
            // run, and only stop once the content has settled for ~1.5s.
            endWaitRef.current += dt * 16.67;
            if (endWaitRef.current > 1500) {
              activeRef.current = false;
              setActive(false);
              stop();
              return;
            }
          } else {
            endWaitRef.current = 0;
          }
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
      return;
    }

    if (ifr) {

      // PDF iframe path. For our self-hosted /pdfjs viewer, the page includes
      // nb-bridge.js which listens for { type: "nb-autoscroll-tick", dy }
      // messages and scrolls #viewerContainer. We ping first to detect
      // support; if no pong arrives within 1.2s we toast and stop.
      let supported = false;
      const handler = (e: MessageEvent) => {
        const d = e?.data;
        if (!d || typeof d !== "object") return;
        if (d.type === "nb-autoscroll-pong") {
          supported = true;
        } else if (d.type === "nb-autoscroll-state" && d.atEnd) {
          activeRef.current = false;
          setActive(false);
          stop();
        }

      };
      msgHandlerRef.current = handler;
      window.addEventListener("message", handler);

      try { ifr.contentWindow?.postMessage({ type: "nb-autoscroll-ping" }, "*"); } catch { /* ignore */ }

      lastTsRef.current = 0;
      const tick = (ts: number) => {
        if (!lastTsRef.current) lastTsRef.current = ts;
        const dt = Math.min(4, (ts - lastTsRef.current) / 16.67);
        lastTsRef.current = ts;
        try {
          ifr.contentWindow?.postMessage(
            { type: "nb-autoscroll-tick", dy: speedRef.current * dt },
            "*"
          );
        } catch { /* ignore */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      supportTimerRef.current = window.setTimeout(() => {
        if (!supported) {
          toast.info("Autoscroll sirf in-app PDFs pe chalta hai. Pehle My Library me save karo.");
          activeRef.current = false;
          setActive(false);
          stop();
        }
      }, 1500);
    }
  }, [stop, targetRef, iframeRef]);


  const toggle = useCallback(() => {
    // Side-effect free updater: compute from the ref so StrictMode's double
    // invocation can't start two rAF loops (old bug: double-speed scrolling).
    const next = !activeRef.current;
    activeRef.current = next;
    pausedRef.current = false;
    setActive(next);
    if (next) start(); else stop();
    if (docKey) safeSet(perDocActiveKey(docKey), next ? "1" : "0");
  }, [start, stop, docKey]);

  // Speed is read live from speedRef inside the loop, so no restart is needed.
  // Only restart when the engine is genuinely idle-but-active (e.g. after a
  // target swap) and never while the user is holding to pause.
  useEffect(() => {
    if (activeRef.current && !pausedRef.current && rafRef.current == null) start();
    /* eslint-disable-next-line */
  }, [speed]);

  useEffect(() => () => stop(), [stop]);

  // Auto-resume from per-doc localStorage flag (Downloads / Local Storage PDFs).
  // Guarded by a 300ms grace so the target/iframe ref has time to attach.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!docKey || resumedRef.current) return;
    if (safeGet(perDocActiveKey(docKey)) !== "1") return;
    // Poll for up to 5s: the viewer/iframe ref can attach late (lazy chunk,
    // pdf.js boot). The old single 300ms shot silently gave up and the
    // remembered autoscroll never resumed.
    let tries = 0;
    const id = window.setInterval(() => {
      if (resumedRef.current || ++tries > 25) { window.clearInterval(id); return; }
      const el = targetRef?.current;
      const ready = (!!el && el.scrollHeight - el.clientHeight > 2) || !!iframeRef?.current;
      if (!ready) return;
      window.clearInterval(id);
      resumedRef.current = true;
      activeRef.current = true;
      setActive(true);
      start();
    }, 200);
    return () => window.clearInterval(id);
  }, [docKey, targetRef, iframeRef, start]);


  // ── Hold-on-content pause ──────────────────────────────────────────────
  // When autoscroll is active, a press-and-hold anywhere on the scrolled
  // content temporarily pauses scrolling (engine stop, state stays `active`).
  // Release → engine resumes at the same speed automatically.
  // Threshold of 140ms avoids interfering with normal taps / swipes.
  useEffect(() => {
    if (!active) return;
    const el = targetRef?.current;
    if (!el) return; // iframe case is handled inside the iframe bridge

    let holdTimer: number | null = null;
    let paused = false;
    let startY = 0;
    let startX = 0;

    const clearTimer = () => {
      if (holdTimer != null) { window.clearTimeout(holdTimer); holdTimer = null; }
    };
    const onDown = (e: TouchEvent | PointerEvent) => {
      // Ignore presses that start on the FAB itself — it runs its own
      // hold-to-pause and the two handlers used to fight each other.
      const tgt = e.target as HTMLElement | null;
      if (tgt?.closest?.("[data-autoscroll-fab]")) return;
      const t = (e as TouchEvent).touches?.[0] ?? (e as PointerEvent);
      startX = t.clientX; startY = t.clientY;
      clearTimer();
      holdTimer = window.setTimeout(() => {
        paused = true;
        pausedRef.current = true;
        stop();
      }, 140);
    };
    const onMove = (e: TouchEvent | PointerEvent) => {
      if (paused) return;
      const t = (e as TouchEvent).touches?.[0] ?? (e as PointerEvent);
      if (Math.hypot(t.clientX - startX, t.clientY - startY) > 10) clearTimer();
    };
    const onUp = () => {
      clearTimer();
      if (paused) {
        paused = false;
        pausedRef.current = false;
        // Resume only if still flagged active (user didn't toggle off).
        if (activeRef.current) start();
      }
    };


    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onUp, { passive: true });
    el.addEventListener("touchcancel", onUp, { passive: true });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      clearTimer();
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onUp);
      el.removeEventListener("touchcancel", onUp);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [active, targetRef, start, stop]);

  const pause = useCallback(() => { pausedRef.current = true; stop(); }, [stop]);
  const resume = useCallback(() => { if (activeRef.current) start(); }, [start]);

  return { active, speed, setSpeed, toggle, pause, resume };
}
