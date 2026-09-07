/**
 * NCERT (ncert.nic.in) textbook link support.
 *
 * NCERT publishes chapter PDFs at a predictable path:
 *   https://ncert.nic.in/textbook/pdf/<code><nn>.pdf     e.g. kebo115.pdf
 *
 * but the links students actually copy point at the HTML chapter-list page:
 *   https://ncert.nic.in/textbook.php?kebo1=15-19
 *
 * That page sends `X-Frame-Options: SAMEORIGIN`, so it can never render in an
 * iframe. We therefore translate the listing URL into the real chapter PDF
 * URLs and read those through the normal pdf-proxy → pdf.js stack.
 */

const NCERT_HOST_RE = /(^|\.)ncert\.(nic|org)\.in$/i;

export interface NcertBook {
  /** Book code from the query string, e.g. "kebo1". */
  code: string;
  /** Chapter numbers the link covers (prelims chapter 0 is skipped). */
  chapters: number[];
}

/** Any ncert.nic.in / ncert.org.in URL. */
export function isNcertUrl(url: string): boolean {
  try {
    return NCERT_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Direct NCERT PDF (already points at bytes). */
export function isNcertPdf(url: string): boolean {
  return isNcertUrl(url) && /\.pdf(\?|#|$)/i.test(url);
}

/** Chapter-list page: `/textbook.php?<code>=<from>-<to>`. */
export function parseNcertTextbookUrl(url: string): NcertBook | null {
  if (!isNcertUrl(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/textbook\.php$/i.test(parsed.pathname)) return null;

  for (const [key, value] of parsed.searchParams.entries()) {
    const code = key.trim().toLowerCase();
    if (!/^[a-z]{2,}[0-9]?$/i.test(code)) continue;
    const m = String(value).match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) continue;
    const from = Number(m[1]);
    const to = Number(m[2]);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to > 99) continue;
    const chapters: number[] = [];
    // Chapter 0 is the prelims/contents section and has no chapter PDF.
    for (let n = Math.max(from, 1); n <= to; n++) chapters.push(n);
    if (chapters.length === 0) chapters.push(1);
    return { code, chapters };
  }
  return null;
}

/** Absolute PDF URL for one chapter of an NCERT book. */
export function ncertChapterPdfUrl(code: string, chapter: number): string {
  return `https://ncert.nic.in/textbook/pdf/${code}${String(chapter).padStart(2, "0")}.pdf`;
}

/** Every chapter PDF a pasted NCERT link resolves to (empty when not NCERT). */
export function ncertChapterPdfUrls(url: string): string[] {
  if (isNcertPdf(url)) return [url];
  const book = parseNcertTextbookUrl(url);
  if (!book) return [];
  return book.chapters.map((n) => ncertChapterPdfUrl(book.code, n));
}

/**
 * Rewrite an NCERT chapter-list page to its first chapter PDF so the reader
 * always receives real PDF bytes. Non-NCERT URLs pass through untouched.
 */
export function normalizeNcertUrl(url: string): string {
  const pdfs = ncertChapterPdfUrls(url);
  return pdfs[0] ?? url;
}

/** "NCERT kebo1 — Chapter 15" style label for a chapter PDF. */
export function ncertChapterTitle(code: string, chapter: number): string {
  return `NCERT ${code.toUpperCase()} — Chapter ${chapter}`;
}
