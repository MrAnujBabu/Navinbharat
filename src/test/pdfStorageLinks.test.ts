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
import { isResolvableStorageViewerUrl, naveenStoragePublicPdfUrl } from "@/lib/native/naveenStoragePdf";

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
