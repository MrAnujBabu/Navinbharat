/**
 * Shared, side-effect-free pieces of the autoscroll "pause on pages" (dwell)
 * and route engines.
 *
 * The React loop (`useAutoScroll`) and the pdf.js bridge
 * (`public/pdfjs/web/nb-bridge.js`) both run this algorithm. This module is
 * the source of truth for the *rules* (clamps, matching, crossing detection);
 * the bridge mirrors them in plain JS because it is loaded as a static asset
 * inside the viewer document.
 */

/** Which page boundaries trigger the timed pause in repeat mode. */
export type DwellParity = "odd" | "even" | "all" | "custom" | "route";

export interface DwellSettings {
  enabled: boolean;
  parity: DwellParity;
  /** Pause duration at each matching page boundary, in seconds. */
  seconds: number;
  /** Explicit page numbers used when `parity === "custom"` (sorted, unique). */
  pages: number[];
  /**
   * Ordered waypoints used when `parity === "route"`. Order is preserved and
   * duplicates are kept — the engine flips direction per leg (6 → 3 → 8 → 2).
   */
  route: number[];
  /** Restart the route from the first waypoint after the last one. */
  loopRoute: boolean;
}

/** Dwell duration bounds — must match `nb-bridge.js`. */
export const DWELL_MIN_SECONDS = 5;
export const DWELL_MAX_SECONDS = 120;
/** Largest page number a student can meaningfully type. */
export const MAX_PAGE_NUMBER = 100000;
/**
 * Hard cap on how many pages a list may hold. The list is scanned inside the
 * per-frame dwell loop, so an unbounded paste would tax every animation frame.
 */
export const MAX_LIST_LENGTH = 500;

export const DEFAULT_DWELL: DwellSettings = {
  enabled: false,
  parity: "odd",
  seconds: 30,
  pages: [],
  route: [],
  loopRoute: false,
};

export const clampDwellSeconds = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v)
    ? Math.max(DWELL_MIN_SECONDS, Math.min(DWELL_MAX_SECONDS, Math.round(v)))
    : DEFAULT_DWELL.seconds;
};

const isPage = (n: number) => Number.isFinite(n) && n > 0 && n < MAX_PAGE_NUMBER;

/**
 * Parses a free-form page list ("1, 5, 3 2;8") into a sorted, unique list of
 * positive page numbers. Invalid tokens are ignored so typing never throws.
 */
export const parsePageList = (raw: string): number[] => {
  const out = new Set<number>();
  for (const token of String(raw ?? "").split(/[^0-9]+/)) {
    if (!token) continue;
    const n = parseInt(token, 10);
    if (isPage(n)) out.add(n);
    if (out.size >= MAX_LIST_LENGTH) break;
  }
  return Array.from(out).sort((a, b) => a - b);
};

/**
 * Parses an ordered route ("6, 3, 8, 2") — order preserved, duplicates kept.
 * Only consecutive duplicates are collapsed (they'd be a no-op leg).
 */
export const parseRouteList = (raw: string): number[] => {
  const out: number[] = [];
  for (const token of String(raw ?? "").split(/[^0-9]+/)) {
    if (!token) continue;
    const n = parseInt(token, 10);
    if (!isPage(n)) continue;
    if (out.length && out[out.length - 1] === n) continue;
    out.push(n);
    if (out.length >= MAX_LIST_LENGTH) break;
  }
  return out;
};

const normalizeParity = (p: unknown): DwellParity =>
  p === "even" || p === "all" || p === "custom" || p === "route" ? p : "odd";

const normalizePages = (v: unknown): number[] =>
  Array.isArray(v)
    ? Array.from(new Set(v.map(Number).filter(isPage)))
        .sort((a, b) => a - b)
        .slice(0, MAX_LIST_LENGTH)
    : [];

const normalizeRoute = (v: unknown): number[] =>
  Array.isArray(v) ? v.map(Number).filter(isPage).slice(0, MAX_LIST_LENGTH) : [];

/** Coerces any untrusted shape (localStorage, postMessage) into safe settings. */
export const normalizeDwell = (v: Partial<DwellSettings> | null | undefined): DwellSettings => ({
  enabled: !!v?.enabled,
  parity: normalizeParity(v?.parity),
  seconds: clampDwellSeconds(v?.seconds),
  pages: normalizePages(v?.pages),
  route: normalizeRoute(v?.route),
  loopRoute: !!v?.loopRoute,
});

/** Parses persisted dwell JSON; `null` when absent or malformed. */
export const parseDwell = (raw: string | null | undefined): DwellSettings | null => {
  if (!raw) return null;
  try {
    return normalizeDwell(JSON.parse(raw) as Partial<DwellSettings>);
  } catch {
    return null;
  }
};

/** Does this page number match the configured pause rule? */
export const matchesParity = (cfg: DwellSettings, page: number): boolean => {
  if (cfg.parity === "all") return true;
  if (cfg.parity === "custom") return cfg.pages.includes(page);
  return cfg.parity === "odd" ? page % 2 === 1 : page % 2 === 0;
};

/** Route mode is only live when enabled, timed, and given at least one stop. */
export const isRouteMode = (cfg: DwellSettings): boolean =>
  cfg.enabled && cfg.seconds > 0 && cfg.parity === "route" && cfg.route.length > 0;

/** A waypoint counts as reached once the step crossed or landed within 1px. */
export const waypointReached = (prevPos: number, pos: number, target: number): boolean =>
  (prevPos - target) * (pos - target) <= 0 || Math.abs(pos - target) < 1;

/**
 * The page boundary crossed by a step from `prevPos` to `pos`, or `undefined`.
 * Travelling up parks on the *last* boundary passed, down on the first.
 */
export function crossedBoundary(
  tops: { page: number; top: number }[],
  prevPos: number,
  pos: number,
  dir: number,
  cfg: DwellSettings
): { page: number; top: number } | undefined {
  const lo = Math.min(prevPos, pos);
  const hi = Math.max(prevPos, pos);
  const hits = tops.filter(
    (p) => p.top > lo + 0.001 && p.top <= hi + 0.001 && matchesParity(cfg, p.page)
  );
  return dir < 0 ? hits[hits.length - 1] : hits[0];
}
