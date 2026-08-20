import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePortalHost } from "../../hooks/usePortalHost";
import { ChevronsDown, ChevronsUp, ArrowUpToLine, Timer, Repeat } from "lucide-react";
import { tapHaptic, selectionHaptic } from "../../lib/native/haptics";

import {
  useAutoScroll,
  parsePageList,
  parseRouteList,
  type DwellParity,
} from "../../hooks/useAutoScroll";


interface Props {
  targetRef?: React.RefObject<HTMLElement | null>;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  /** Vertical offset above the bottom edge (px). Default 84 (above Save FAB). */
  bottomOffset?: number;
  /** Notified whenever autoscroll active state changes (so chrome can stay pinned). */
  onActiveChange?: (active: boolean) => void;
  /** Allows parent chrome to hide the FAB without clipping it inside page containers. */
  visible?: boolean;
  /** Stable per-document id — enables per-doc speed + auto-resume via localStorage. */
  docKey?: string;
}

const PRESETS = [0.02, 0.05, 0.1, 0.2, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7, 10];
const DWELL_PRESETS = [10, 20, 30, 60];
const PARITIES: { value: DwellParity; label: string }[] = [
  { value: "odd", label: "Odd" },
  { value: "even", label: "Even" },
  { value: "all", label: "Every page" },
  { value: "custom", label: "Custom" },
  { value: "route", label: "Route" },
];



/** 0.75 must render as "0.75x", but 1 should stay "1x" — not "1.00x". */
const fmtSpeed = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Floating autoscroll button.
 * - Tap → toggle on/off
 * - Long-press (≥280ms) → open speed picker (presets + fine slider, 0.01 step,
 *   floor 0.02x for ultra-slow reading)
 */
export default function AutoScrollFab({ targetRef, iframeRef, bottomOffset = 84, onActiveChange, visible = true, docKey }: Props): JSX.Element | null {
  const host = usePortalHost();
  const {
    active,
    speed,
    setSpeed,
    toggle,
    pause,
    resume,
    reverse,
    setReverse,
    dwell,
    setDwell,
    scrollToTop,
  } = useAutoScroll({ targetRef, iframeRef, docKey });
  const [open, setOpen] = useState(false);

  // ── Settings sheet a11y ────────────────────────────────────────────
  // The sheet is a hand-rolled modal (it must live in the fullscreen
  // portal host, so Radix Dialog isn't used). Give it dialog semantics,
  // Escape-to-close, initial focus and focus restore to the FAB.
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const fabButtonRef = useRef<HTMLButtonElement | null>(null);
  const onSheetKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };
  useEffect(() => {
    if (!open) return;
    const opener = fabButtonRef.current;
    sheetRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  // Raw text the student typed for the "Custom" pause list. Kept local so
  // half-typed input ("1, 5, ") never gets destroyed by re-parsing.
  const [customText, setCustomText] = useState(() => (dwell?.pages ?? []).join(", "));
  const customSynced = useRef(false);
  useEffect(() => {
    // Sync once from persisted settings (per-doc load), then leave it to the user.
    if (customSynced.current) return;
    customSynced.current = true;
    if (dwell?.pages?.length) setCustomText(dwell.pages.join(", "));
  }, [dwell?.pages]);

  // Ordered route text ("6, 3, 8, 2") — order and repeats are meaningful here.
  const [routeText, setRouteText] = useState(() => (dwell?.route ?? []).join(", "));
  const routeSynced = useRef(false);
  useEffect(() => {
    if (routeSynced.current) return;
    routeSynced.current = true;
    if (dwell?.route?.length) setRouteText(dwell.route.join(", "));
  }, [dwell?.route]);
  const routeStops = dwell?.route ?? [];



  // While autoscroll is running, auto-hide the FAB after 2.5s of no user
  // activity so the pulsing arrow doesn't sit on top of the content the user
  // is trying to read. Any tap on the FAB or activity on the scrolled surface
  // brings it back for another 2.5s. See mem://features/autoscroll-fab.
  const [idleHidden, setIdleHidden] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const effectiveVisible = (visible || active || open) && !(active && idleHidden);
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  useEffect(() => { if (!effectiveVisible) setOpen(false); }, [effectiveVisible]);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const heldPause = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => { if (pressTimer.current) window.clearTimeout(pressTimer.current); }, []);

  // Auto-hide-while-active controller.
  const armHide = (delay = 2500) => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setIdleHidden(true), delay);
  };
  const kickShow = () => {
    setIdleHidden(false);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (active && !open) armHide();
  };

  // Start/stop the auto-hide timer with the active state and speed-picker.
  useEffect(() => {
    if (!active || open) {
      setIdleHidden(false);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      return;
    }
    armHide();
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); };
  }, [active, open, speed]);

  // Listen for user activity on the scrolled surface (native el + pdf iframe)
  // to reveal the FAB again while autoscroll keeps running.
  useEffect(() => {
    if (!active) return;
    const el = targetRef?.current ?? null;
    const onActivity = () => kickShow();
    el?.addEventListener("pointerdown", onActivity, { passive: true });
    el?.addEventListener("touchstart", onActivity, { passive: true });
    // Window-level fallback so downloaded-PDF (iframe) taps and page-scroll
    // taps also un-hide the FAB even when the ref points to <html>.
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("wheel", onActivity, { passive: true });
    const onMsg = (e: MessageEvent) => {
      const d = e?.data;
      if (d && typeof d === "object" && d.type === "nb-autoscroll-user-activity") kickShow();
    };
    window.addEventListener("message", onMsg);
    return () => {
      el?.removeEventListener("pointerdown", onActivity);
      el?.removeEventListener("touchstart", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("wheel", onActivity);
      window.removeEventListener("message", onMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, targetRef?.current]);

  // The page pill's drag-to-scrub writes scrollTop every frame; pause the
  // autoscroll loop for the duration of the drag so they don't fight.
  const scrubPaused = useRef(false);
  useEffect(() => {
    const onStart = () => {
      if (!active || scrubPaused.current) return;
      scrubPaused.current = true;
      pause();
    };
    const onEnd = () => {
      if (!scrubPaused.current) return;
      scrubPaused.current = false;
      resume();
    };
    window.addEventListener("nb-reader-scrub-start", onStart);
    window.addEventListener("nb-reader-scrub-end", onEnd);
    return () => {
      window.removeEventListener("nb-reader-scrub-start", onStart);
      window.removeEventListener("nb-reader-scrub-end", onEnd);
      // Never leave the loop paused if the reader unmounts mid-drag.
      if (scrubPaused.current) {
        scrubPaused.current = false;
        resume();
      }
    };
  }, [active, pause, resume]);


  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    longPressed.current = false;
    heldPause.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (active) {
      // Hold-to-pause: after a tiny threshold, pause the scroll without
      // changing `active`. Release will resume at the same speed.
      pressTimer.current = window.setTimeout(() => {
        heldPause.current = true;
        pause();
      }, 140);
    } else {
      // Idle → long-press opens speed picker.
      pressTimer.current = window.setTimeout(() => {
        longPressed.current = true;
        // Same selection haptic the page pill uses when it grabs the finger.
        void selectionHaptic();
        setOpen(true);
      }, 280);

    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    // Cancel long-press only on a deliberate drag (>12px), not tiny jitter.
    if (!startPos.current || longPressed.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (Math.hypot(dx, dy) > 12 && pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (heldPause.current) {
      // Was paused while held → resume at same speed, don't toggle off.
      resume();
    } else if (!longPressed.current) {
      void tapHaptic("light");
      toggle();

    }
    heldPause.current = false;
    startPos.current = null;
  };

  const fab = (
    <>
      <button
        ref={fabButtonRef}
        type="button"

        aria-label={active ? "Stop autoscroll" : reverse ? "Start reverse autoscroll" : "Start autoscroll"}
        aria-pressed={active}
        onPointerDown={onPointerDown}

        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => e.stopPropagation()}
        data-autoscroll-fab="true"
        className={`fixed right-4 sm:right-5 z-[68] flex h-12 w-12 select-none items-center justify-center rounded-full shadow-lg ring-1 ring-black/10 transition-all duration-200 active:scale-95 ${
          effectiveVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        } ${
          active
            ? "bg-primary text-primary-foreground ring-2 ring-primary"
            : "bg-card text-foreground"
        }`}
        style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))` }}
      >
        {reverse ? (
          <ChevronsUp className="h-6 w-6" aria-hidden="true" />
        ) : (
          <ChevronsDown className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[69] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nb-autoscroll-sheet-title"
            tabIndex={-1}
            onKeyDown={onSheetKeyDown}
            className="w-full max-w-sm rounded-t-2xl bg-card p-5 shadow-xl outline-none sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 id="nb-autoscroll-sheet-title" className="text-sm font-semibold">Autoscroll speed</h3>
              <span className="text-xs tabular-nums text-muted-foreground">{fmtSpeed(speed)}x</span>
            </div>

            <input
              type="range"
              min={0.02}
              max={10}
              step={0.01}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSpeed(p)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                    Math.abs(speed - p) < 0.005
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  {fmtSpeed(p)}x
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Settings
              </h4>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  scrollToTop();
                }}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2 font-medium">
                  <ArrowUpToLine className="h-4 w-4" aria-hidden="true" />
                  Go to first page
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReverse(!reverse)}
                aria-pressed={reverse}
                className="mt-2 flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >

                <span className="font-medium">Reverse autoscroll</span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    reverse ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all ${
                      reverse ? "left-4" : "left-0.5"
                    }`}
                  />
                </span>
              </button>

              <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
                <button
                  type="button"
                  onClick={() => setDwell({ enabled: !dwell.enabled })}
                  aria-pressed={dwell.enabled}
                  className="flex w-full items-center gap-3 text-left text-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Timer className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">Pause on pages</span>
                    <span className="block text-xs leading-snug text-muted-foreground">
                      Stops at every page for a set time, then keeps scrolling
                    </span>
                  </span>
                  <span
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                      dwell.enabled ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all duration-200 ${
                        dwell.enabled ? "left-4" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>

                {dwell.enabled && (
                  <div className="mt-3 space-y-4 border-t border-border pt-3">
                    <div>
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Pause at
                      </span>
                      <div className="flex rounded-full bg-muted p-0.5">
                        {PARITIES.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                              if (p.value === "custom") {
                                setDwell({ parity: "custom", pages: parsePageList(customText) });
                              } else if (p.value === "route") {
                                setDwell({ parity: "route", route: parseRouteList(routeText) });
                              } else {

                                setDwell({ parity: p.value });
                              }
                            }}
                            aria-pressed={dwell.parity === p.value}
                            className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[11px] font-medium transition-colors duration-200 ${
                              dwell.parity === p.value
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {dwell.parity === "custom" && (
                        <div className="mt-2">
                          <label htmlFor="nb-dwell-pages" className="sr-only">
                            Pages to pause on
                          </label>
                          <input
                            id="nb-dwell-pages"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="e.g. 1, 5, 3, 2, 8"
                            value={customText}
                            onChange={(e) => {
                              setCustomText(e.target.value);
                              setDwell({ pages: parsePageList(e.target.value) });
                            }}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-none transition-colors focus:border-primary"
                          />
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                            {dwell?.pages?.length
                              ? `Pausing at page ${(dwell?.pages ?? []).join(", ")} — works in normal and reverse autoscroll.`
                              : "Type any page numbers in any order — autoscroll will stop at each of them."}
                          </p>
                        </div>
                      )}

                      {dwell.parity === "route" && (
                        <div className="mt-2">
                          <label htmlFor="nb-dwell-route" className="sr-only">
                            Route page order
                          </label>
                          <input
                            id="nb-dwell-route"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="e.g. 6, 3, 8, 2"
                            value={routeText}
                            onChange={(e) => {
                              setRouteText(e.target.value);
                              setDwell({ route: parseRouteList(e.target.value) });
                            }}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-none transition-colors focus:border-primary"
                          />
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                            {routeStops.length > 1
                              ? `Order: ${routeStops.join(" → ")} — autoscroll flips direction on its own for each leg.`
                              : "Type pages in the order you want to read them — autoscroll goes down, then up, then down again."}
                          </p>
                          <button
                            type="button"
                            onClick={() => setDwell({ loopRoute: !dwell.loopRoute })}
                            aria-pressed={dwell.loopRoute}
                            className="mt-2 flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left"
                          >
                            <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                              <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                              Loop route
                            </span>
                            <span
                              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                                dwell.loopRoute ? "bg-primary" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all duration-200 ${
                                  dwell.loopRoute ? "left-4" : "left-0.5"
                                }`}
                              />
                            </span>
                          </button>
                        </div>
                      )}
                    </div>



                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Pause for
                        </span>
                        <span className="rounded-md bg-background px-1.5 py-0.5 text-xs font-medium tabular-nums text-foreground">
                          {dwell.seconds}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={120}
                        step={5}
                        value={dwell.seconds}
                        onChange={(e) => setDwell({ seconds: parseInt(e.target.value, 10) })}
                        className="w-full accent-primary"
                      />
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {DWELL_PRESETS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setDwell({ seconds: s })}
                            className={`rounded-md border px-2 py-1.5 text-xs font-medium tabular-nums transition-colors duration-200 ${
                              dwell.seconds === s
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-accent"
                            }`}
                          >
                            {s}s
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (typeof document === "undefined") return fab;
  return createPortal(fab, host ?? document.body) as unknown as JSX.Element;
}
