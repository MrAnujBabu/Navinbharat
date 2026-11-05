// Unit tests for the SSRF guard in pdf-proxy.
// Ref: docs/AUDIT-2026-07-15.md — MEDIUM #10.
//
// Run with:
//   deno test supabase/functions/pdf-proxy/ssrf_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { downloadFileName, isAllowedPdfUrl, rangeContainsPdfSignature, urlLookupPattern } from "./index.ts";

const allow = (url: string) => assertEquals(isAllowedPdfUrl(url), true, url);
const deny = (url: string) => assertEquals(isAllowedPdfUrl(url), false, url);

Deno.test("SSRF: allow-listed CDNs pass", () => {
  allow("https://cdn.jsdelivr.net/gh/foo/bar@main/x.pdf");
  allow("https://raw.githubusercontent.com/foo/bar/main/x.pdf");
  allow("https://acct.blob.core.windows.net/c/x.pdf");
  allow("https://github-storages-cdn.vercel.app/x.pdf");
  allow("https://storage-naveenbharat-recording.vercel.app/view/abc");
});

Deno.test("Vedantu: only the exact notes-storage host is allowed", () => {
  allow("https://prod-recordings.vedantu.com/NOTES/PROD/6a7eb202ce63b65a22dd7742.pdf");
  deny("http://prod-recordings.vedantu.com/NOTES/PROD/x.pdf");
  deny("https://prod-recordings.vedantu.com.attacker.net/x.pdf");
  deny("https://evil-prod-recordings.vedantu.com/x.pdf");
  deny("https://vedantu.com/x.pdf");
  deny("https://other.vedantu.com/x.pdf");
});

Deno.test("Google Docs: only export paths are allowed", () => {
  allow("https://docs.google.com/document/d/ABC_123-x/export?format=pdf");
  allow("https://docs.google.com/spreadsheets/d/ABC_123-x/export?format=pdf");
  allow("https://doc-0s-4c-docs.googleusercontent.com/docs/securesc/x/y.pdf");
  deny("https://docs.google.com/document/d/ABC_123-x/edit");
  deny("https://docs.google.com/anything-else");
  deny("https://docs.google.com.evil.tld/document/d/x/export");
});

Deno.test("SSRF: metadata endpoint is denied", () => {
  deny("http://169.254.169.254/latest/meta-data/");
  deny("https://169.254.169.254/latest/meta-data/");
  deny("http://169.254.169.254.nip.io/"); // still not allow-listed
});

Deno.test("SSRF: private / loopback / link-local are denied", () => {
  deny("https://localhost/x.pdf");
  deny("https://127.0.0.1/x.pdf");
  deny("https://10.0.0.5/x.pdf");
  deny("https://192.168.1.1/x.pdf");
  deny("https://172.16.0.1/x.pdf");
  deny("https://172.31.255.255/x.pdf");
});

Deno.test("SSRF: non-https schemes are denied", () => {
  deny("http://cdn.jsdelivr.net/x.pdf");
  deny("file:///etc/passwd");
  deny("gopher://cdn.jsdelivr.net/x.pdf");
});

Deno.test("SSRF: credentials, ports, IP literals are denied", () => {
  deny("https://user:pass@cdn.jsdelivr.net/x.pdf");
  deny("https://cdn.jsdelivr.net:8080/x.pdf");
  deny("https://[::1]/x.pdf");
});

Deno.test("SSRF: arbitrary hosts outside allow-list are denied", () => {
  deny("https://evil.example.com/x.pdf");
  deny("https://attacker.tld/cdn.jsdelivr.net/x.pdf");
  deny("https://cdn.jsdelivr.net.evil.tld/x.pdf");
});

Deno.test("SSRF: garbage input is denied without throwing", () => {
  deny("");
  deny("not-a-url");
  deny("//cdn.jsdelivr.net/x.pdf");
});

Deno.test("PDF validation: tiny Range probes are not treated as invalid PDFs", () => {
  assertEquals(rangeContainsPdfSignature(null), true);
  assertEquals(rangeContainsPdfSignature("bytes=0-0"), false);
  assertEquals(rangeContainsPdfSignature("bytes=0-3"), false);
  assertEquals(rangeContainsPdfSignature("bytes=0-4"), true);
  assertEquals(rangeContainsPdfSignature("bytes=0-524287"), true);
  assertEquals(rangeContainsPdfSignature("bytes=524288-1048575"), false);
});

Deno.test("Download filename: safe ASCII name ending in .pdf", () => {
  assertEquals(downloadFileName("Physics Notes.pdf", "https://x/y.pdf"), "Physics Notes.pdf");
  assertEquals(downloadFileName(null, "https://prod-recordings.vedantu.com/NOTES/PROD/abc123.pdf"), "abc123.pdf");
  assertEquals(downloadFileName('a"b\r\nc', "https://x/y"), "a_b_c.pdf");
  assertEquals(downloadFileName("..", "https://x/"), "document.pdf");
});

// Course-content lookup must find a paid PDF however its link was stored,
// otherwise the file falls through to "personal library" and opens unpaid.
Deno.test("urlLookupPattern: same file matches across spellings", () => {
  const vedantu = "%prod-recordings.vedantu.com%NOTES%PROD%6a7eb202ce63b65a22dd7742.pdf%";
  assertEquals(urlLookupPattern("https://prod-recordings.vedantu.com/NOTES/PROD/6a7eb202ce63b65a22dd7742.pdf"), vedantu);
  assertEquals(urlLookupPattern("http://prod-recordings.vedantu.com/NOTES/PROD/6a7eb202ce63b65a22dd7742.pdf?x=1#p2"), vedantu);
  assertEquals(urlLookupPattern(" https://www.Example.com/Suffer%20English%20/file%2520notes.pdf "), "%example.com%Suffer%English%file%notes.pdf%");
});

Deno.test("urlLookupPattern: LIKE wildcards are escaped", () => {
  assertEquals(urlLookupPattern("https://cdn.jsdelivr.net/gh/a/b/my_notes%25.pdf"), "%cdn.jsdelivr.net%gh%a%b%my\\_notes\\%.pdf%");
});

Deno.test("urlLookupPattern: Google Docs match on the document id", () => {
  assertEquals(urlLookupPattern("https://docs.google.com/document/d/ABC_123-x/export?format=pdf"), "%docs.google.com%document%d%ABC\\_123-x%");
});

Deno.test("urlLookupPattern: too-generic links are not matched", () => {
  assertEquals(urlLookupPattern("https://example.com/"), null);
  assertEquals(urlLookupPattern("https://example.com/a.pdf"), null);
  assertEquals(urlLookupPattern("not a url"), null);
});

Deno.test("GitHub Pages: only the app's own PDF site is allowed", () => {
  allow("https://MrAnujBabu.github.io/edu-pdfs/27%20SEP/6a8ed08eb0946354241c2882.pdf");
  deny("https://someone-else.github.io/x.pdf");
  deny("https://github.io/x.pdf");
  deny("https://mranujbabu.github.io.attacker.net/x.pdf");
  deny("http://mranujbabu.github.io/x.pdf");
});
