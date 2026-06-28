import { memo, useMemo, useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { ArrowLeft, Loader2, BookOpen, Eye } from "lucide-react";
import { resolveEmbedUrl, isNaveenBharatStorage, isGithubStoragesCdn, isGoogleDrive, isGoogleDocs, isNotion, renderablePdfUrl, extractDriveFileId, googleDrivePdfProxyUrl } from "../../lib/pdfViewerUrl";
import MarkdownViewer, { type MarkdownViewerHandle } from "./MarkdownViewer";
import FastPdfReader, { type FastPdfReaderHandle } from "./FastPdfReader";
import { useScreenProtection } from "../../hooks/useScreenProtection";
import { useOfflineResolvedUrl } from "../../hooks/useOfflineResolvedUrl";
import { pushPlayerBusy } from "../../lib/playerBusy";

import NotionPageRenderer from "./NotionPageRenderer";

interface PdfViewerProps {
  url: string;
  title?: string;
  filename?: string;
  chromeVisible?: boolean;
  onSurfaceTap?: () => void;
  onFirstByte?: () => void;
  onDownloaded?: (info: { title: string; url: string; filename: string }) => void;
  /** Page to restore on open (1-based). */
  initialPage?: number;
  /** Notified when the most-visible page changes (1-based). */
  onPageChange?: (page: number) => void;
  /** Fires once when scroll / iframe refs are mounted and queryable. */
  onReady?: () => void;
}

export type PdfViewerHandle = {
  getScrollEl: () => HTMLElement | null;
  getIframeEl: () => HTMLIFrameElement | null;
};

const isMarkdownUrl = (u: string) => /\.(md|markdown)(\?|#|$)/i.test(u);

/**
 * URLs that must stay as iframe embeds (we can't render them as canvas).
 * Google Drive and Google Docs are both cross-origin/CORS-blocked, so the
 * canvas FastPdfReader can't fetch their bytes — they MUST go through an
 * iframe (Drive's /preview or Docs' /preview).
 *
 * NOTE: local files (capacitor://, file://, ionic://, blob:, http://localhost
 * _capacitor_file_…) are intentionally NOT here — they render through
 * FastPdfReader (canvas) so offline autoscroll + large-PDF streaming work.
 */
const mustUseIframe = (u: string) =>
  isGoogleDocs(u) || isGoogleDrive(u);

/** localStorage key for per-Drive-file Reader Mode preference. */
const readerModeKey = (driveId: string) => `nb:reader-mode:${driveId}`;

const getDriveReaderModePreference = (driveId: string | null): boolean => {
  if (!driveId) return false;
  try {
    const stored = localStorage.getItem(readerModeKey(driveId));
    // Capacitor/mobile Firefox: Drive preview iframes are the blank-screen path.
    // Default to proxied Reader Mode; the Preview pill remains available.
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
};

const PdfViewerInner = forwardRef<PdfViewerHandle, PdfViewerProps>(
  ({ url: rawUrl, title, filename, chromeVisible = true, onSurfaceTap, onFirstByte, initialPage, onPageChange, onReady }, ref) => {
    useScreenProtection(true);
    useEffect(() => pushPlayerBusy(), []);

    // Prefer an offline-downloaded copy when one exists for this URL.
    const { url: offlineUrl } = useOfflineResolvedUrl(rawUrl);
    const url = useMemo(() => renderablePdfUrl(offlineUrl), [offlineUrl]);

    // ── All hooks declared up-front (rules-of-hooks) ────────────────────────
    const mdRef = useRef<MarkdownViewerHandle>(null);
    const pdfRef = useRef<FastPdfReaderHandle>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const isMd = isMarkdownUrl(url) || (!!filename && isMarkdownUrl(filename));

    // ── Reader Mode (Drive only) ─────────────────────────────────────────────
    // Default = Drive `/preview` iframe (zero edge load).
    // Opt-in = proxy → FastPdfReader (autoscroll, page restore, screen protection).
    const driveId = useMemo(() => (isGoogleDrive(url) ? extractDriveFileId(url) : null), [url]);
    const [readerMode, setReaderMode] = useState<boolean>(() => {
      return getDriveReaderModePreference(driveId);
    });
    const toggleReaderMode = useCallback(() => {
      setReaderMode((prev) => {
        const next = !prev;
        if (driveId) {
          try { localStorage.setItem(readerModeKey(driveId), next ? "1" : "0"); } catch {}
        }
        return next;
      });
    }, [driveId]);

    // When Reader Mode is on for a Drive file, route to proxy + FastPdfReader.
    const driveProxyUrl = useMemo(
      () => (driveId && readerMode ? googleDrivePdfProxyUrl(url) : null),
      [driveId, readerMode, url]
    );
    const effectiveUrl = driveProxyUrl ?? url;
    const useIframe = !isMd && mustUseIframe(effectiveUrl);

    useImperativeHandle(
      ref,
      () => ({
        getScrollEl: () =>
          mdRef.current?.getScrollEl() ?? pdfRef.current?.getScrollEl() ?? null,
        getIframeEl: () => iframeRef.current ?? pdfRef.current?.getIframeEl() ?? null,
      }),
      []
    );

    // iframe-branch state (safe to declare regardless of branch — React only
    // cares that the hook order is stable per component instance).
    const [loaded, setLoaded] = useState(false);
    const [showOpenExternal, setShowOpenExternal] = useState(false);
    const loadedRef = useRef(false);

    const resolved = useMemo(() => resolveEmbedUrl(effectiveUrl), [effectiveUrl]);
    const { isDrive } = resolved;
    const isHtmlViewer = isNaveenBharatStorage(url) || isGithubStoragesCdn(url);
    const embedUrl = resolved.embedUrl;

    // Show Reader Mode toggle for Drive files only (the only surface where
    // we have two viable rendering paths: free preview iframe vs proxied canvas).
    const showReaderToggle = !!driveId;

    useEffect(() => {
      if (!useIframe) return;
      setLoaded(false);
      loadedRef.current = false;
      setShowOpenExternal(false);
      try {
        if (typeof localStorage !== "undefined" && localStorage.getItem("nb_pdf_debug") === "1") {
          // eslint-disable-next-line no-console
          console.info("[PdfViewer] iframe branch", { isDrive, isHtmlViewer, embedUrl });
        }
      } catch {}
      // Drive iframes occasionally render blank in Capacitor WebView (3p-cookie
      // gating, Google's "sign in to view" interstitial, sandboxed frame race).
      // After 6s with no `load` event, auto-escalate Drive into Reader Mode —
      // that path proxies the PDF bytes through our edge function and renders
      // via FastPdfReader (canvas), which works regardless of Google's frame
      // policy. Non-Drive iframes (Docs, custom viewers) keep the 10s retry CTA.
      const escalateMs = isDrive ? 6000 : 10000;
      const t = window.setTimeout(() => {
        if (loadedRef.current) return;
        if (isDrive && driveId && !readerMode) {
          try { localStorage.setItem(readerModeKey(driveId), "1"); } catch {}
          setReaderMode(true);
          return;
        }
        setShowOpenExternal(true);
      }, escalateMs);
      return () => window.clearTimeout(t);
    }, [embedUrl, useIframe, isDrive, isHtmlViewer, driveId, readerMode]);

    // ── Notion branch — in-app native render via react-notion-x ─────────────
    // Notion blocks iframes (x-frame-options), so we fetch the page's
    // recordMap through our edge function and render it natively. Falls back
    // to "Open in Browser" card on any error.
    if (isNotion(url)) {
      return (
        <div
          className={
            chromeVisible
              ? "relative w-full overflow-hidden bg-card"
              : "absolute inset-0 w-full h-full overflow-hidden bg-card"
          }
          style={
            chromeVisible
              ? { height: "calc(100dvh - 176px + env(safe-area-inset-bottom))", minHeight: "60vh" }
              : undefined
          }
        >
          <NotionPageRenderer url={url} title={title} onReady={onReady} />
        </div>
      );
    }

    // ── Markdown branch ──────────────────────────────────────────────────────
    if (isMd) {
      return (
        <div
          className={
            chromeVisible
              ? "relative w-full overflow-hidden bg-card"
              : "absolute inset-0 w-full h-full overflow-hidden bg-card"
          }
          style={
            chromeVisible
              ? { height: "calc(100dvh - 176px + env(safe-area-inset-bottom))", minHeight: "60vh" }
              : undefined
          }

        >
          <MarkdownViewer ref={mdRef} url={url} title={title} />
        </div>
      );
    }

    // ── Fast native PDF branch (canvas, no iframe) ───────────────────────────
    if (!useIframe) {
      return (
        <div
          className={
            chromeVisible
              ? "relative w-full overflow-hidden bg-card landscape:!h-[calc(100dvh-var(--nb-player-h,56.25vw)-env(safe-area-inset-top)-env(safe-area-inset-bottom))] landscape:!min-h-[200px]"
              : "absolute inset-0 w-full h-full overflow-hidden bg-card"
          }
          style={
            chromeVisible
              ? { height: "calc(100dvh - 176px + env(safe-area-inset-bottom))", minHeight: "60vh" }
              : undefined
          }

        >
          <FastPdfReader
            ref={pdfRef}
            url={effectiveUrl}
            onSurfaceTap={onSurfaceTap}
            onFirstByte={onFirstByte}
            initialPage={initialPage}
            onPageChange={onPageChange}
            onReady={onReady}
          />
          {showReaderToggle && (
            <ReaderModeToggle active={readerMode} onToggle={toggleReaderMode} />
          )}
        </div>
      );
    }

    // ── Fallback iframe branch (Drive, Docs, Notion, custom viewer pages) ────
    // Drive `/preview` and Docs `/preview` already render WITHOUT a top toolbar,
    // so the legacy "shift iframe up by 72px to hide toolbar" trick was
    // CROPPING the first ~72px of the document inside the lesson's inline
    // viewer (root cause of "Drive PDF inline view me kat raha hai").
    // Self-hosted PDF.js viewer still needs the 56px hide to mask its header.
    const TOOLBAR_HIDE_PX = isHtmlViewer ? 56 : 0;

    const wrapperClass = chromeVisible
      ? "relative w-full overflow-hidden bg-card landscape:!h-[calc(100dvh-var(--nb-player-h,56.25vw)-env(safe-area-inset-top)-env(safe-area-inset-bottom))] landscape:!min-h-[200px]"
      : "absolute inset-0 w-full h-full overflow-hidden bg-card";

    const wrapperStyle: React.CSSProperties = chromeVisible
      ? {
          height: "calc(100dvh - 176px + env(safe-area-inset-bottom))",
          minHeight: "60vh",
          transition: "height 250ms ease",
        }
      : {};


    return (
      <div className={wrapperClass} style={wrapperStyle} onClick={onSurfaceTap}>
        <iframe
          ref={iframeRef}
          key={embedUrl}
          src={embedUrl}
          className="absolute left-0 w-full border-0"
          style={{ top: -TOOLBAR_HIDE_PX, height: `calc(100% + ${TOOLBAR_HIDE_PX}px)` }}
          title={title || "PDF Document"}
          allow="fullscreen"
          loading="eager"
          onLoad={() => {
            loadedRef.current = true;
            setLoaded(true);
            try { window.dispatchEvent(new CustomEvent("pdf-ready")); } catch {}
            onReady?.();
          }}
        />
        {isDrive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              try { window.history.back(); } catch { /* noop */ }
            }}
            aria-label="Exit Drive PDF"
            className="absolute left-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md ring-1 ring-border backdrop-blur transition-transform active:scale-95"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/90">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading PDF…</p>
            {showOpenExternal && (
              <button
                type="button"
                onClick={() => {
                  // No external redirect — force the in-app iframe to retry.
                  setLoaded(false);
                  loadedRef.current = false;
                  setShowOpenExternal(false);
                  if (iframeRef.current) iframeRef.current.src = embedUrl;
                }}
                className="inline-flex items-center gap-1 text-xs text-primary underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {showReaderToggle && (
          <ReaderModeToggle active={readerMode} onToggle={toggleReaderMode} />
        )}
      </div>
    );
  }
);

/**
 * Compact pill button shown over Drive PDFs. Lets the user opt into
 * "Reader Mode" (proxy + canvas → autoscroll, page restore, screen protection).
 * Default = off → preview iframe served by Google (zero edge load).
 */
function ReaderModeToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-background"
      title={active ? "Switch to fast preview (Google Drive)" : "Reader Mode: autoscroll + page restore"}
      aria-pressed={active}
    >
      {active ? <Eye className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
      <span>{active ? "Preview" : "Reader Mode"}</span>
    </button>
  );
}

// NotionPreviewCard removed — Notion now always renders via NotionPageRenderer
// (in-app). The previous "Open in Notion" card leaked users to the system
// browser, breaking the in-app back stack. Do NOT re-introduce it.

PdfViewerInner.displayName = "PdfViewer";
const PdfViewer = memo(PdfViewerInner);
export default PdfViewer;
