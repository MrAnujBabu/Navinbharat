import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

import { githubStoragesViewerToRaw, isNaveenBharatStorage, renderablePdfUrl } from "@/lib/pdfViewerUrl";
import { fetchNaveenStoragePdf, isResolvableStorageViewerUrl, looksLikePdf, naveenStoragePublicPdfUrl } from "@/lib/native/naveenStoragePdf";
import { getDownloadUrl } from "@/utils/fileUtils";
import { friendlyPdfErrorMessage } from "@/lib/pdfErrorMessage";

const VIEWER = "https://github-storages-cdn.vercel.app/v/27%20SEP/6a8ed08eb0946354241c2882.pdf";
const RAW = "https://raw.githubusercontent.com/MrAnujBabu/edu-pdfs/main/27%20SEP/6a8ed08eb0946354241c2882.pdf";
const JSR = "https://jsrstudy.vercel.app/view/b4e1e7e8-1d25-4f44-9ea7-181bda135965";
const OLD = "https://storage-naveenbharat-recording.vercel.app/view/b4e1e7e8-1d25-4f44-9ea7-181bda135965";

describe("Naveen Bharat Files viewer links", () => {
  it("map to the real PDF file in edu-pdfs", () => {
    expect(githubStoragesViewerToRaw(VIEWER)).toBe(RAW);
  });

  it("open as the raw file, not the viewer web page", () => {
    const out = decodeURIComponent(renderablePdfUrl(VIEWER));
    expect(out).toContain("raw.githubusercontent.com/MrAnujBabu/edu-pdfs/main/");
    expect(out).not.toContain("github-storages-cdn.vercel.app");
  });

  it("leave non-PDF viewer pages alone", () => {
    expect(githubStoragesViewerToRaw("https://github-storages-cdn.vercel.app/v/27%20SEP")).toBeNull();
  });
});

describe("jsrstudy storage links", () => {
  it("new jsrstudy.vercel.app links are recognised", () => {
    expect(isNaveenBharatStorage(JSR)).toBe(true);
    expect(isResolvableStorageViewerUrl(JSR)).toBe(true);
  });

  it("old and new host both resolve to the public PDF endpoint", () => {
    const expected = "https://jsrstudy.vercel.app/api/public/pdf/b4e1e7e8-1d25-4f44-9ea7-181bda135965";
    expect(naveenStoragePublicPdfUrl(JSR)).toBe(expected);
    expect(naveenStoragePublicPdfUrl(OLD)).toBe(expected);
  });

  it("look-alike hosts are not trusted", () => {
    expect(isResolvableStorageViewerUrl("https://jsrstudy.vercel.app.evil.io/view/b4e1e7e8-1d25-4f44-9ea7-181bda135965")).toBe(false);
  });
});

describe("downloading and saving viewer links", () => {
  it("Download / Save offline fetch the real file, not the viewer page", () => {
    expect(getDownloadUrl(VIEWER)).toBe(RAW);
  });
});

describe("storage PDFs that are not really PDFs", () => {
  it("recognises PDF bytes", async () => {
    expect(await looksLikePdf(new Blob(["%PDF-1.7\n..."]))).toBe(true);
    expect(await looksLikePdf(new Blob(["<!doctype html><html>"]))).toBe(false);
  });

  it("a web page from the storage site shows the web-page message, not 'service didn't respond'", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html>Vercel</html>", { status: 200, headers: { "content-type": "application/octet-stream" } }),
    ) as typeof fetch;
    try {
      const err = await fetchNaveenStoragePdf(JSR).catch((e) => e);
      expect((err as { status?: number }).status).toBe(415);
      expect(friendlyPdfErrorMessage(err, JSR)).not.toMatch(/didn't respond/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
