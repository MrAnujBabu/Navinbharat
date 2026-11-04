import { describe, expect, it, vi, beforeEach } from "vitest";

// The generated client is mocked for every test in this file; the runtime
// helper then falls back to the canonical project host, which the stale-URL
// fixtures below are built against.
const createSignedUrl = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    storage: {
      from: (_bucket: string) => ({ createSignedUrl }),
    },
  },
}));

vi.mock("../lib/nativePdfHttp", () => ({ fetchPdfViaNativeHttp: vi.fn().mockResolvedValue(null) }));

const fetchWithAuthRetry = vi.fn();
vi.mock("../lib/pdfProxyAuthRetry", () => ({ fetchWithAuthRetry: (...args: unknown[]) => fetchWithAuthRetry(...args) }));

import { parseStorageUrl, refreshSignedStorageUrl } from "../lib/refreshSignedStorageUrl";
import { fetchDocumentBlob } from "../lib/fetchDocumentBlob";
import { supabaseRuntimeUrl } from "@/integrations/supabase/runtime";

const host = new URL(supabaseRuntimeUrl).host;
const staleSignedUrl = (path: string) =>
  `https://${host}/storage/v1/object/sign/content/${path}?token=EXPIRED`;

describe("parseStorageUrl", () => {
  it("parses signed storage URLs of this project", () => {
    expect(parseStorageUrl(staleSignedUrl("books/x.pdf"))).toEqual({
      bucket: "content",
      path: "books/x.pdf",
    });
  });

  it("parses public and authenticated object URLs too", () => {
    expect(parseStorageUrl(`https://${host}/storage/v1/object/public/content/a/b.pdf`)).toEqual({
      bucket: "content",
      path: "a/b.pdf",
    });
    expect(parseStorageUrl(`https://${host}/storage/v1/object/authenticated/content/c.pdf`)).toEqual({
      bucket: "content",
      path: "c.pdf",
    });
  });

  it("rejects other hosts and non-storage URLs", () => {
    expect(parseStorageUrl("https://evil.example.com/storage/v1/object/sign/content/x.pdf?token=1")).toBeNull();
    expect(parseStorageUrl("https://example.com/file.pdf")).toBeNull();
  });
});

describe("refreshSignedStorageUrl", () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
    fetchWithAuthRetry.mockReset();
  });

  it("mints a fresh signed URL for the same bucket/path", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/fresh" }, error: null });
    const fresh = await refreshSignedStorageUrl(staleSignedUrl("books/x.pdf"));
    expect(createSignedUrl).toHaveBeenCalledWith("books/x.pdf", expect.any(Number));
    expect(fresh).toBe("https://signed/fresh");
  });

  it("returns the original URL when re-signing fails", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "nope" } });
    const stale = staleSignedUrl("books/x.pdf");
    expect(await refreshSignedStorageUrl(stale)).toBe(stale);
  });
});

describe("fetchDocumentBlob re-signs expired saved links", () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
    fetchWithAuthRetry.mockReset();
  });

  it("downloads through a freshly signed URL when the saved link expired", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: `https://${host}/storage/v1/object/sign/content/notes.pdf?token=FRESH` },
      error: null,
    });
    fetchWithAuthRetry.mockImplementation(async (url: string) => {
      if (/token=FRESH/.test(url)) {
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: "application/pdf" }),
        };
      }
      return { ok: false, status: 403, blob: async () => new Blob([]) };
    });

    const blob = await fetchDocumentBlob(staleSignedUrl("notes.pdf"));
    expect(blob.size).toBe(5);
    const calledUrls = fetchWithAuthRetry.mock.calls.map((c) => c[0] as string);
    expect(calledUrls.some((u) => /token=FRESH/.test(u))).toBe(true);
    expect(calledUrls.some((u) => /token=EXPIRED/.test(u))).toBe(false);
  });
});
