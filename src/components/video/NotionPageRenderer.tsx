import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { extractNotionPageId, notionPageProxyUrl } from "../../lib/pdfViewerUrl";
import { savePdfToDevice } from "../../lib/nativePdfSaver";
import { useToast } from "../../hooks/use-toast";



// react-notion-x is heavy (~150KB gz with prism + katex). Lazy-load so the
// main bundle isn't impacted for users who never open a Notion page.
const NotionRenderer = lazy(() =>
  import("react-notion-x").then((m) => ({ default: m.NotionRenderer }))
);

// react-notion-x base CSS — required for layout/typography of the rendered page.
import "react-notion-x/src/styles.css";

interface Props {
  url: string;
  title?: string;
  onClose?: () => void;
}

/**
 * In-app Notion page renderer.
 * - Extracts page id from notion.site / notion.so URL
 * - Fetches recordMap via Supabase edge function `notion-page` (JSON proxy)
 * - Renders natively with react-notion-x — full text, images, links, rich formatting
 * - Falls back to "Open in Browser" card on any failure
 */
export default function NotionPageRenderer({ url, title, onClose }: Props) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  // Subpage back-stack — every PageLink click pushes; floating back/close pops.
  // When the stack only has the root url, the close FAB calls history.back()
  // so the parent DocumentReader's popstate sentinel runs (exits the reader).
  const [stack, setStack] = useState<string[]>([url]);
  useEffect(() => { setStack([url]); }, [url]);
  const activeUrl = stack[stack.length - 1];
  const pageId = extractNotionPageId(activeUrl);
  const [recordMap, setRecordMap] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const popOrClose = useCallback(() => {
    setStack((s) => {
      if (s.length > 1) return s.slice(0, -1);
      try { window.history.back(); } catch {}
      return s;
    });
  }, []);

  /**
   * Export the currently rendered Notion DOM to a PDF and save it to the
   * device. We target `.notion-app-wrapper .notion` (the react-notion-x root)
   * so only the page body — not our floating buttons — ends up in the PDF.
   * html2pdf.js is dynamic-imported to keep it out of the main bundle.
   */
  const exportToPdf = useCallback(async () => {
    if (exporting) return;
    const target = document.querySelector<HTMLElement>(".notion-app-wrapper .notion");
    if (!target) {
      toast({ title: "Page not ready", description: "Wait for the page to finish loading.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const mod = await import("html2pdf.js");
      const html2pdf = (mod as unknown as { default: any }).default;
      const safeName = (title || "Notion Page").replace(/[\/\\?%*:|"<>]/g, "_").slice(0, 80);
      const clone = target.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".notion-export-ignore").forEach((el) => el.remove());
      const sandbox = document.createElement("div");
      sandbox.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#111;z-index:-1;";
      clone.style.cssText = "width:794px;max-width:794px;padding:24px 32px 48px;background:#fff;color:#111;box-sizing:border-box;";
      sandbox.appendChild(clone);
      document.body.appendChild(sandbox);
      const blob: Blob = await html2pdf()
        .from(clone)
        .set({
          margin: [8, 8, 10, 8],
          filename: `${safeName}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false, windowWidth: 794, scrollX: 0, scrollY: 0 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
          pagebreak: { mode: ["avoid-all", "css", "legacy"], avoid: ["h1", "h2", "h3", "li", "pre", "table", ".notion-callout", ".notion-text"] },
        })
        .outputPdf("blob");
      sandbox.remove();
      const blobUrl = URL.createObjectURL(blob);
      try {
        await savePdfToDevice(blobUrl, `${safeName}.pdf`);
        toast({ title: "Saved", description: "PDF saved to Documents/NaveenBharat." });
      } finally {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Could not generate PDF.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [exporting, title, toast]);

  // Hardware/browser back: pop subpage stack first, then let parent handle exit.
  useEffect(() => {
    if (stack.length <= 1) return;
    const onPop = (e: PopStateEvent) => {
      e.stopImmediatePropagation();
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
      // Re-push sentinel so the next back press still has something to pop.
      try { window.history.pushState({ pdfFullscreen: true }, ""); } catch {}
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [stack.length]);


  useEffect(() => {
    if (!pageId) {
      setError("Could not extract page id");
      return;
    }
    let cancelled = false;
    setError(null);
    setRecordMap(null);

    fetch(notionPageProxyUrl(pageId))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRecordMap(data.recordMap);
        try { window.dispatchEvent(new CustomEvent("pdf-ready")); } catch {}
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e?.message || "Failed to load";
        setError(msg);
        try { window.dispatchEvent(new CustomEvent("pdf-error", { detail: msg })); } catch {}
      });


    return () => {
      cancelled = true;
    };
  }, [pageId]);

  if (error) {
    return <FallbackCard url={activeUrl} title={title} reason={error} />;
  }

  if (!recordMap) {
    // Silent spinner — no "Loading Notion page…" text per UX request.
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }


  const canGoBack = stack.length > 1;
  return (
    <div className="relative h-full w-full overflow-auto bg-background notion-app-wrapper">
      {/* Minimal top-left exit arrow — pops subpage stack, else exits reader
          (history.back returns to the previous page that opened this Notion view).
          Kept small + translucent so it never obstructs page content. */}
      <button
        type="button"
        onClick={popOrClose}
        aria-label={canGoBack ? "Back to previous page" : "Close Notion preview"}
        className="notion-export-ignore fixed left-3 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md ring-1 ring-border backdrop-blur transition-transform active:scale-95"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>


      {/* Floating "Download as PDF" — bottom-right, safe-area aware. Exports
          the currently rendered Notion page to a real PDF and routes through
          savePdfToDevice → Capacitor Filesystem (Documents/NaveenBharat) on
          Android/iOS, or a normal browser download on web. */}
      <button
        type="button"
        onClick={exportToPdf}
        disabled={exporting}
        aria-label="Download as PDF"
        className="notion-export-ignore fixed right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-border transition-transform active:scale-95 disabled:opacity-60"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
      >
        {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
      </button>

      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Rendering…</div>}>
        <NotionRenderer
          recordMap={recordMap}
          fullPage={false}
          darkMode={false}
          disableHeader
          // Override missing components so react-notion-x doesn't emit the
          // "using empty component Code/Equation/..." warnings and so that
          // code blocks still render readable text in-app (we don't ship
          // prismjs/katex to keep the bundle small).
          components={{
            Code: ({ block }: { block: { properties?: { title?: unknown[][] } } }) => {
              const text = (block?.properties?.title || [])
                .map((t) => (Array.isArray(t) ? t[0] : ""))
                .join("");
              return (
                <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed text-foreground">
                  <code>{text}</code>
                </pre>
              );
            },
            Equation: ({ block }: { block: { properties?: { title?: unknown[][] } } }) => {
              const text = (block?.properties?.title || [])
                .map((t) => (Array.isArray(t) ? t[0] : ""))
                .join("");
              return <code className="rounded bg-muted px-1 py-0.5 text-xs">{text}</code>;
            },
            // Subpage links inside a Notion page → navigate in-app by
            // swapping the active URL so we refetch a new recordMap.
            // Never open externally — that breaks the back stack.
            PageLink: ({ href, children, ...rest }: any) => (
              <a
                {...rest}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (typeof href === "string" && href) {
                    const next = href.startsWith("http") ? href : `https://www.notion.so${href.startsWith("/") ? "" : "/"}${href}`;
                    setStack((s) => [...s, next]);
                    try { window.history.pushState({ pdfFullscreen: true, notionSub: true }, ""); } catch {}
                  }
                }}

              >
                {children}
              </a>
            ),
          }}
        />
      </Suspense>
      {/* In-app safety: clamp huge images, respect theme */}
      <style>{`
        .notion-app-wrapper .notion { padding: 1rem 1rem 4rem; max-width: 100%; }
        .notion-app-wrapper .notion-page { padding: 0 !important; max-width: 100% !important; }
        .notion-app-wrapper img { max-width: 100%; height: auto; }
        .notion-app-wrapper .notion-asset-wrapper { max-width: 100% !important; }
        .notion-app-wrapper a { color: hsl(var(--primary)); }
      `}</style>
    </div>
  );
}

function FallbackCard({ title, reason }: { url: string; title?: string; reason: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.06] ring-1 ring-border">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-foreground" fill="none" aria-hidden="true">
          <path d="M5 4h11l3 3v13H5V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 9v6m0-6l5 6m0-6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold leading-tight text-foreground">{title || "Notion Page"}</h2>
        <p className="max-w-sm text-xs text-muted-foreground">
          In-app preview unavailable ({reason}). Pull down or tap Retry to try again.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        <Loader2 className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}
