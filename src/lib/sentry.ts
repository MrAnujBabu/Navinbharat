// Sentry is dynamically imported so the ~40KB SDK never lands in the initial
// entry chunk. We still expose synchronous-callable helpers; calls made before
// the SDK finishes loading are queued (or dropped, for breadcrumbs in prod
// without a DSN — there's nothing to record anyway).

type SentryModule = typeof import("@sentry/react");

let sentryMod: SentryModule | null = null;
let loading: Promise<SentryModule | null> | null = null;
let initialized = false;

// Sentry DSN comes exclusively from the build-time env var so the value can
// be rotated without shipping a new bundle, forks don't burn our quota, and
// audit finding F4.1 (SEC — un-rotatable hard-coded DSN) stays closed.
function getDsn(): string | undefined {
  const envDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  return envDsn && envDsn.trim() ? envDsn : undefined;
}

/**
 * Strip query strings (signed-URL tokens, `?token=…`, `?jwt=…`, etc.) before
 * a URL is sent to Sentry. Closes F2.3 — signed URLs were leaking into event
 * payloads as tags/extra context.
 */
export function redactUrl(u: string | undefined | null, max = 120): string {
  if (!u) return "";
  try {
    const q = u.indexOf("?");
    const base = q >= 0 ? u.slice(0, q) : u;
    return base.slice(0, max);
  } catch {
    return String(u).slice(0, max);
  }
}

function shouldLoad(): boolean {
  // Prod builds always send when a DSN is available.
  if (import.meta.env.PROD) return Boolean(getDsn());
  // Dev/preview escape hatch — set VITE_SENTRY_FORCE=1 to smoke-test the
  // Sentry pipeline from the Lovable preview without publishing. Keep OFF
  // long-term: dev noise burns Sentry quota fast.
  if (import.meta.env.VITE_SENTRY_FORCE === "1") return Boolean(getDsn());
  return false;
}

function loadSentry(): Promise<SentryModule | null> {
  if (sentryMod) return Promise.resolve(sentryMod);
  if (loading) return loading;
  if (!shouldLoad()) return Promise.resolve(null);
  loading = import("@sentry/react")
    .then((m) => {
      sentryMod = m;
      return m;
    })
    .catch(() => null);
  return loading;
}

/**
 * Initialize Sentry in production only. Safe to call multiple times.
 * Set VITE_SENTRY_DSN in production env to activate; otherwise no-op.
 * Async: loads the SDK on demand so it stays out of the initial chunk.
 */
export async function initSentry(): Promise<void> {
  if (initialized) return;
  if (!shouldLoad()) return;
  const mod = await loadSentry();
  if (!mod || initialized) return;
  try {
    mod.init({
      dsn: getDsn() as string,
      environment: import.meta.env.PROD ? "production" : "preview-forced",
      tracesSampleRate: 0.1,
      // Replay & Profiling integrations intentionally NOT registered — keeps
      // the Sentry vendor chunk lean (~70KB gzip saved vs. enabling Replay).
      // If you re-enable, add `Sentry.replayIntegration()` to `integrations:`.
    });
    initialized = true;
    // OBS hardening — closes HIGH "Errors swallowed by console.error".
    // Forward every console.error in prod through Sentry so the existing
    // ~50 silent error sites (hooks/lib) automatically get observability.
    // Original console.error still runs for adb logcat / Eruda.
    installConsoleErrorForwarder();
  } catch {
    /* never break the app for telemetry */
  }
}

// Module-level guard — patching console.error twice would create infinite
// recursion (forwarder calls captureException which calls Sentry which may
// call console.error on its own failure path).
let consoleErrorPatched = false;
// F1.1 — re-entry guard. If `captureException` itself throws and Sentry's
// own code paths call `console.error`, we would recurse infinitely because
// our wrapper is now the outermost console.error. This flag short-circuits
// re-entrant calls back to the original console.error.
let forwarderInFlight = false;
function installConsoleErrorForwarder(): void {
  if (consoleErrorPatched) return;
  consoleErrorPatched = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (forwarderInFlight) { original(...args); return; }
    forwarderInFlight = true;
    try {
      // First arg shapes the Sentry event. If it's already an Error, ship it
      // directly; otherwise stringify the first 2 args as the message.
      const first = args[0];
      const err =
        first instanceof Error
          ? first
          : new Error(args.slice(0, 2).map((a) => (typeof a === "string" ? a : safeStringify(a))).join(" "));
      captureException(err, { source: "console.error", argCount: args.length });
    } catch { /* never let telemetry break logging */ }
    finally { forwarderInFlight = false; }
    original(...args);
  };
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}

/** Thin wrapper used by new code. Same shape as console.error but explicit. */
export function reportError(err: unknown, context?: Record<string, unknown>): void {
  captureException(err, context);
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!shouldLoad()) return;
  loadSentry().then((mod) => {
    if (!mod || !initialized) return;
    try {
      mod.captureException(err, context ? { extra: context } : undefined);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Lightweight breadcrumb logger. In dev (Sentry not initialised) it falls back
 * to console so PDF actions are still traceable while debugging.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
) {
  if (import.meta.env.DEV) {
    try { console.debug(`[breadcrumb:${category}] ${message}`, data ?? ""); } catch { /* ignore */ }
    return;
  }
  if (!shouldLoad()) return;
  loadSentry().then((mod) => {
    if (!mod || !initialized) return;
    try {
      mod.addBreadcrumb({ category, message, level: "info", data });
    } catch {
      /* ignore */
    }
  });
}