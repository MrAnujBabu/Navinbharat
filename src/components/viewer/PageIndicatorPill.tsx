import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePortalHost } from "../../hooks/usePortalHost";
import { ChevronUp, ChevronDown } from "lucide-react";
import { tapHaptic, selectionHaptic } from "../../lib/native/haptics";

/** Vertical inset of the scrub track from the viewport edges (px). */
const TRACK_INSET = 56;
/** Movement (px) that turns a press into a scrub instead of a tap. */
const DRAG_THRESHOLD = 6;

interface Props {
  /** Same-origin scroller (canvas reader). */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** pdf.js iframe surface. */
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  /** Fade-out delay after the last scroll (ms). */
  idleMs?: number;
}

interface PageState {
  first: number;
  last: number;
  total: number;
}

/**
 * Google-Drive-style floating page indicator.
 *
 * Shows `7–9/17` on the right edge while the reader is scrolling (user scroll
 * or autoscroll) and fades out after ~1.2s of stillness. The stacked chevrons
 * jump to the previous / next page boundary.
 *
 * Perf: the scroll handler is passive and rAF-throttled, page rects are cached
 * and re-measured at most every 500ms, and every timer/listener is torn down
 * on unmount (see the app-crash-shield leak rules).
 */
export default function PageIndicatorPill({
  targetRef,
  iframeRef,
  idleMs = 1200,
}: Props): JSX.Element | null {
  const host = usePortalHost();
  const [state, setState] = useState<PageState | null>(null);
  const [shown, setShown] = useState(false);
  const [focused, setFocused] = useState(false);
  /** 0..1 position of the thumb along the scrub track. */
  const [fraction, setFraction] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);

  const hideTimer = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pagesRef = useRef<{ page: number; top: number; bottom: number }[]>([]);
  const measuredAt = useRef(0);
  const mounted = useRef(true);
  /** Until this timestamp the drag owns `fraction`; page reports must not fight it. */
  const scrubUntil = useRef(0);


  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const reveal = useCallback(() => {
    if (!mounted.current) return;
    setShown(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (mounted.current) setShown(false);
    }, idleMs);
  }, [idleMs]);

  // ── Same-origin canvas reader ───────────────────────────────────────────
  const measure = useCallback((el: HTMLElement, now: number, force = false) => {
    // NOTE: never fake `now` to force a re-measure — that writes a future
    // timestamp and silently skips the next real measures (stale page rects).
    if (!force && now - measuredAt.current < 500 && pagesRef.current.length) return;
    measuredAt.current = now;
    const rootTop = el.getBoundingClientRect().top - el.scrollTop;
    pagesRef.current = Array.from(
      el.querySelectorAll<HTMLElement>("[data-page]")
    )
      .map((node, i) => {
        const r = node.getBoundingClientRect();
        const page = Number(node.dataset.page) || i + 1;
        return { page, top: r.top - rootTop, bottom: r.bottom - rootTop };
      })
      .sort((a, b) => a.top - b.top);
  }, []);

  // Soft-touch: one selection tick per page boundary crossed while scrubbing.
  const lastPulsedPage = useRef(0);
  const pulsePage = useCallback((page: number) => {
    if (!draggingRef.current) {
      lastPulsedPage.current = page;
      return;
    }
    if (page === lastPulsedPage.current) return;
    lastPulsedPage.current = page;
    void selectionHaptic();
  }, []);

  const compute = useCallback(
    (el: HTMLElement) => {
      measure(el, performance.now());
      const pages = pagesRef.current;
      if (!pages.length) return;
      const viewTop = el.scrollTop;
      const viewBottom = viewTop + el.clientHeight;
      const visible = pages.filter((p) => p.bottom > viewTop + 4 && p.top < viewBottom - 4);
      const list = visible.length ? visible : [pages[0]];
      const first = list[0].page;
      setState({
        first,
        last: list[list.length - 1].page,
        total: pages.length,
      });
      const max = el.scrollHeight - el.clientHeight;
      setFraction(max > 2 ? Math.max(0, Math.min(1, el.scrollTop / max)) : 0);
      pulsePage(first);
    },
    [measure, pulsePage]
  );

  useEffect(() => {
    const el = targetRef?.current ?? null;
    if (!el) return;
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!mounted.current) return;
        compute(el);
        reveal();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // Seed once so the first reveal already has a number.
    compute(el);
    return () => el.removeEventListener("scroll", onScroll);
    // `targetRef.current` intentionally omitted: ref mutations don't re-render.
    // Mount sites remount this component (surfaceTick key) when the surface
    // resolves, which is what re-runs this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRef, compute, reveal]);

  // ── pdf.js iframe surface ───────────────────────────────────────────────
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      // Only trust the reader iframe we own, on our own origin. Any other
      // frame (ad slot, opener, injected iframe) must not drive page state.
      const src = iframeRef?.current?.contentWindow ?? null;
      if (!src || e.source !== src) return;
      if (e.origin !== "null" && e.origin !== window.location.origin) return;
      const d = e?.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "nb-page-state") {
        const total = Number(d.total) || 0;
        const first = Number(d.first) || 1;
        const last = Number(d.last) || first;
        if (!total) return;
        setState({ first, last, total });
        // While the finger owns the thumb — and for a moment after release —
        // its position is driven by the drag, not by the (page-quantised,
        // slightly lagging) report from the iframe.
        if (!draggingRef.current && performance.now() > scrubUntil.current && total > 1) {
          setFraction(Math.max(0, Math.min(1, (first - 1) / (total - 1))));
        }
        pulsePage(first);
        reveal();

      } else if (d.type === "nb-pdf-pagesloaded") {
        const total = Number(d.pages) || 0;
        if (total) setState((prev) => ({ first: prev?.first ?? 1, last: prev?.last ?? 1, total }));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [reveal, iframeRef]);

  const step = useCallback(
    (delta: 1 | -1) => {
      reveal();
      const el = targetRef?.current ?? null;
      if (el && el.scrollHeight - el.clientHeight > 2) {
        measure(el, performance.now(), true); // force a fresh measure
        const pages = pagesRef.current;

        if (!pages.length) return;
        const cur = el.scrollTop;
        const next =
          delta > 0
            ? pages.find((p) => p.top > cur + 4)
            : [...pages].reverse().find((p) => p.top < cur - 4);
        const prevBehavior = el.style.scrollBehavior;
        el.style.scrollBehavior = "auto";
        el.scrollTop = next ? Math.max(0, next.top) : delta > 0 ? el.scrollHeight : 0;
        el.style.scrollBehavior = prevBehavior;
        compute(el);
        return;
      }
      const ifr = iframeRef?.current ?? null;
      try {
        ifr?.contentWindow?.postMessage({ type: "nb-goto-page", delta }, "*");
      } catch {
        /* ignore */
      }
    },
    [targetRef, iframeRef, measure, compute, reveal]
  );

  // ── Drag-to-scrub on the chip (scrollbar-thumb behaviour) ───────────────
  // The chip travels along a vertical track and stays exactly under the touch
  // point for the whole gesture: `fraction` is derived from the absolute
  // pointer Y minus the grab offset, not from a synthetic travel constant.
  const dragRef = useRef<{
    grabOffset: number;
    id: number;
    moved: boolean;
    /** Pointer Y at grab time — the fixed origin for the tap/drag threshold. */
    originY: number;
  } | null>(null);
  const dragRaf = useRef<number | null>(null);
  const pendingY = useRef(0);

  const trackMetrics = useCallback(() => {
    const h = typeof window === "undefined" ? 0 : window.innerHeight;
    const top = TRACK_INSET;
    const length = Math.max(1, h - TRACK_INSET * 2);
    return { top, length };
  }, []);

  const applyFraction = useCallback(
    (next: number) => {
      const f = Math.max(0, Math.min(1, next));
      setFraction(f);
      scrubUntil.current = performance.now() + 250;
      const el = targetRef?.current ?? null;
      if (el && el.scrollHeight - el.clientHeight > 2) {
        const prev = el.style.scrollBehavior;
        el.style.scrollBehavior = "auto";
        el.scrollTop = f * (el.scrollHeight - el.clientHeight);
        el.style.scrollBehavior = prev;
        compute(el);
        setFraction(f); // compute() re-derives from scrollTop; the drag wins
        return;
      }
      try {
        iframeRef?.current?.contentWindow?.postMessage(
          { type: "nb-scroll-to-fraction", fraction: f },
          "*"
        );
      } catch {
        /* ignore */
      }
    },
    [targetRef, iframeRef, compute]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const { top, length } = trackMetrics();
      const thumbY = top + fraction * length;
      dragRef.current = {
        grabOffset: e.clientY - thumbY,
        id: e.pointerId,
        moved: false,
        originY: e.clientY,
      };
      draggingRef.current = true;
      setDragging(true);
      scrubUntil.current = performance.now() + 250;
      void selectionHaptic();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      // Autoscroll writes scrollTop every frame too — pause it for the drag,
      // otherwise the page snaps back under the finger.
      window.dispatchEvent(new CustomEvent("nb-reader-scrub-start"));
      try {
        iframeRef?.current?.contentWindow?.postMessage({ type: "nb-autoscroll-user-activity" }, "*");
      } catch {
        /* ignore */
      }
      reveal();
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    },
    [trackMetrics, fraction, reveal, iframeRef]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const { top, length } = trackMetrics();
      // Threshold is measured from the fixed grab origin — comparing against
      // the live `fraction` (which the drag is already moving) swallowed
      // short scrubs.
      if (!d.moved && Math.abs(e.clientY - d.originY) < DRAG_THRESHOLD) return;
      d.moved = true;
      pendingY.current = e.clientY - d.grabOffset;
      if (dragRaf.current) return;
      dragRaf.current = requestAnimationFrame(() => {
        dragRaf.current = null;
        if (!mounted.current || !dragRef.current) return;
        applyFraction((pendingY.current - top) / length);
      });
    },
    [applyFraction, trackMetrics]
  );

  const releaseDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    draggingRef.current = false;
    setDragging(false);
    scrubUntil.current = performance.now() + 250;
    if (dragRaf.current) {
      cancelAnimationFrame(dragRaf.current);
      dragRaf.current = null;
    }
    window.dispatchEvent(new CustomEvent("nb-reader-scrub-end"));
    reveal();
  }, [reveal]);

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      releaseDrag();
    },
    [releaseDrag]
  );

  // Safety net: a gesture that ends outside the chip (capture lost, pointer
  // released over the iframe) must still resume autoscroll.
  useEffect(() => {
    const onUp = () => releaseDrag();
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [releaseDrag]);


  // Keyboard path to page stepping (the pointer stepper is touch-only).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        step(1);
      }
    },
    [step]
  );


  useEffect(
    () => () => {
      if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
    },
    []
  );

  if (!state || state.total <= 1) return null;

  const label =
    dragging || state.first === state.last
      ? `${state.first}/${state.total}`
      : `${state.first}\u2013${state.last}/${state.total}`;

  // Keyboard focus keeps the pill visible and interactive even when idle.
  const visible = shown || focused || dragging;
  const surface =
    "rounded-full bg-foreground/90 text-background shadow-lg backdrop-blur";

  const node = (
    <div
      className={`pointer-events-none fixed right-3 z-[67] flex -translate-y-1/2 items-center gap-1.5 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-40"
      }`}
      style={{
        // Thumb rides the track at the document's scroll fraction, so the chip
        // stays under the finger while scrubbing (Files-by-Google behaviour).
        top: `${TRACK_INSET + fraction * Math.max(1, (typeof window === "undefined" ? 800 : window.innerHeight) - TRACK_INSET * 2)}px`,
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
      onFocus={() => {
        setFocused(true);
        reveal();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <span
        role="slider"
        aria-label="Scrub pages"
        aria-valuemin={1}
        aria-valuemax={state.total}
        aria-valuenow={state.first}
        aria-valuetext={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={releaseDrag}
        style={{ touchAction: "none" }}
        // Always hit-testable: the chip fades but must stay grabbable, else the
        // touch falls through to the PDF and drag "does nothing".
        className={`pointer-events-auto flex min-h-11 select-none items-center px-4 text-sm font-medium tabular-nums outline-none transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] ${surface} ${
          dragging ? "scale-105" : ""
        }`}
      >
        {label}
      </span>
      <div className={`pointer-events-auto flex h-11 w-11 flex-col overflow-hidden ${surface}`}>

        <button
          type="button"
          aria-label="Previous page"
          onClick={(e) => {
            e.stopPropagation();
            void tapHaptic("light");
            step(-1);
          }}
          className="flex flex-1 items-end justify-center pb-0.5 outline-none transition-colors duration-150 focus-visible:bg-background/20 active:bg-background/25"
        >
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next page"
          onClick={(e) => {
            e.stopPropagation();
            void tapHaptic("light");
            step(1);
          }}
          className="flex flex-1 items-start justify-center pt-0.5 outline-none transition-colors duration-150 focus-visible:bg-background/20 active:bg-background/25"

        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, host ?? document.body) as unknown as JSX.Element;
}
