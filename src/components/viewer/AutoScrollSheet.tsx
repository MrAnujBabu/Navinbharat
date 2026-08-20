import type { RefObject } from "react";
import { ArrowUpToLine, Timer, Repeat } from "lucide-react";
import { Chip, ChipGrid } from "./ChipGrid";
import {
  parsePageList,
  parseRouteList,
  type DwellParity,
  type DwellSettings,
} from "../../hooks/useAutoScroll";

/** Ceiling shared by the slider and `setSpeed`'s clamp in `useAutoScroll`. */
export const MAX_SPEED = 20;
const PRESETS = [0.02, 0.05, 0.1, 0.2, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7, 10, 20];
const DWELL_PRESETS = [10, 20, 30, 60];
const PARITIES: { value: DwellParity; label: string }[] = [
  { value: "odd", label: "Odd" },
  { value: "even", label: "Even" },
  { value: "all", label: "Every page" },
  { value: "custom", label: "Custom" },
  { value: "route", label: "Route" },
];

/** 0.75 must render as "0.75x", but 1 should stay "1x" — not "1.00x". */
export const fmtSpeed = (n: number) => String(Math.round(n * 100) / 100);

interface Props {
  onClose: () => void;
  speed: number;
  setSpeed: (n: number) => void;
  reverse: boolean;
  setReverse: (v: boolean) => void;
  dwell: DwellSettings;
  setDwell: (patch: Partial<DwellSettings>) => void;
  scrollToTop: () => void;
  /** Raw text is owned by the FAB so half-typed input survives sheet re-renders. */
  customText: string;
  setCustomText: (v: string) => void;
  routeText: string;
  setRouteText: (v: string) => void;
  sheetRef: RefObject<HTMLDivElement | null>;
}

/**
 * Settings sheet body for autoscroll. Presentation only — every piece of state
 * lives in `AutoScrollFab`/`useAutoScroll`, so this file can be read as pure UI.
 *
 * It is a hand-rolled modal (it must live in the fullscreen portal host, so
 * Radix Dialog isn't used); dialog semantics, Escape-to-close and focus restore
 * are wired by the parent.
 */
export default function AutoScrollSheet({
  onClose,
  speed,
  setSpeed,
  reverse,
  setReverse,
  dwell,
  setDwell,
  scrollToTop,
  customText,
  setCustomText,
  routeText,
  setRouteText,
  sheetRef,
}: Props): JSX.Element {
  const routeStops = dwell?.route ?? [];
  const onSheetKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[69] flex items-end justify-center bg-black/40 sm:items-center [@media(max-height:520px)]:items-stretch [@media(max-height:520px)]:justify-end"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nb-autoscroll-sheet-title"
        tabIndex={-1}
        onKeyDown={onSheetKeyDown}
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-card shadow-xl outline-none sm:rounded-2xl max-h-[85dvh] [@media(max-height:520px)]:h-full [@media(max-height:520px)]:max-h-none [@media(max-height:520px)]:max-w-xs [@media(max-height:520px)]:rounded-none [@media(max-height:520px)]:rounded-l-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pt-2">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted sm:hidden" aria-hidden="true" />
          <div className="mb-3 flex items-center justify-between">
            <h3 id="nb-autoscroll-sheet-title" className="text-sm font-semibold">Autoscroll speed</h3>
            <span className="text-xs tabular-nums text-muted-foreground">{fmtSpeed(speed)}x</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 [-webkit-overflow-scrolling:touch]">
          <input
            type="range"
            min={0.02}
            max={MAX_SPEED}
            step={0.01}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />

          <ChipGrid cols={3} className="mt-4">
            {PRESETS.map((p) => (
              <Chip key={p} selected={Math.abs(speed - p) < 0.005} onClick={() => setSpeed(p)}>
                {fmtSpeed(p)}x
              </Chip>
            ))}
          </ChipGrid>

          <div className="mt-5 border-t border-border pt-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Settings
            </h4>

            <button
              type="button"
              onClick={() => {
                onClose();
                scrollToTop();
              }}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors [@media(hover:hover)]:hover:bg-accent active:bg-accent"
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
              className="mt-2 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
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
                    {/* 5 labels never fit one row on a 360px phone — the grid keeps
                        each chip inside its own cell so nothing overlaps. */}
                    <ChipGrid cols={3} variant="segment">
                      {PARITIES.map((p) => (
                        <Chip
                          key={p.value}
                          variant="segment"
                          selected={dwell.parity === p.value}
                          ariaPressed={dwell.parity === p.value}
                          onClick={() => {
                            if (p.value === "custom") {
                              setDwell({ parity: "custom", pages: parsePageList(customText) });
                            } else if (p.value === "route") {
                              setDwell({ parity: "route", route: parseRouteList(routeText) });
                            } else {
                              setDwell({ parity: p.value });
                            }
                          }}
                        >
                          {p.label}
                        </Chip>
                      ))}
                    </ChipGrid>

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
                      <span className="rounded-lg bg-background px-1.5 py-0.5 text-xs font-medium tabular-nums text-foreground">
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
                    <ChipGrid cols={4} className="mt-2">
                      {DWELL_PRESETS.map((s) => (
                        <Chip key={s} selected={dwell.seconds === s} onClick={() => setDwell({ seconds: s })}>
                          {s}s
                        </Chip>
                      ))}
                    </ChipGrid>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="shrink-0 border-t border-border bg-card px-5 pt-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
