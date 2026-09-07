import { describe, expect, it } from "vitest";
import {
  isNcertPdf,
  isNcertUrl,
  ncertChapterPdfUrl,
  ncertChapterPdfUrls,
  normalizeNcertUrl,
  parseNcertTextbookUrl,
} from "../lib/ncertLinks";

describe("ncertLinks", () => {
  it("detects NCERT hosts", () => {
    expect(isNcertUrl("https://ncert.nic.in/textbook.php?kebo1=15-19")).toBe(true);
    expect(isNcertUrl("https://n20.ncert.org.in/x.pdf")).toBe(true);
    expect(isNcertUrl("https://example.com/a.pdf")).toBe(false);
  });

  it("parses a chapter-range textbook link", () => {
    expect(parseNcertTextbookUrl("https://ncert.nic.in/textbook.php?kebo1=15-19")).toEqual({
      code: "kebo1",
      chapters: [15, 16, 17, 18, 19],
    });
  });

  it("skips the prelims chapter 0", () => {
    expect(parseNcertTextbookUrl("https://ncert.nic.in/textbook.php?kebo1=0-2")?.chapters).toEqual([
      1, 2,
    ]);
  });

  it("builds chapter PDF urls", () => {
    expect(ncertChapterPdfUrl("kebo1", 15)).toBe("https://ncert.nic.in/textbook/pdf/kebo115.pdf");
    expect(ncertChapterPdfUrls("https://ncert.nic.in/textbook.php?kebo1=15-16")).toEqual([
      "https://ncert.nic.in/textbook/pdf/kebo115.pdf",
      "https://ncert.nic.in/textbook/pdf/kebo116.pdf",
    ]);
  });

  it("normalises a listing page to its first chapter PDF", () => {
    expect(normalizeNcertUrl("https://ncert.nic.in/textbook.php?kebo1=15-19")).toBe(
      "https://ncert.nic.in/textbook/pdf/kebo115.pdf",
    );
  });

  it("leaves direct PDFs and other links untouched", () => {
    const direct = "https://ncert.nic.in/textbook/pdf/kebo115.pdf";
    expect(isNcertPdf(direct)).toBe(true);
    expect(normalizeNcertUrl(direct)).toBe(direct);
    expect(normalizeNcertUrl("https://example.com/a.pdf")).toBe("https://example.com/a.pdf");
  });
});
