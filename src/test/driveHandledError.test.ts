import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const reader = readFileSync("src/components/video/FastPdfReader.tsx", "utf8");
const shell = readFileSync("src/components/course/DocumentReader.tsx", "utf8");

describe("Drive download-disabled files stay readable", () => {
  it("marks the drive-block failure as handled and announces the inline preview", () => {
    expect(reader).toContain('emitPdfLifecycle("pdf-error", readerId, { message: driveBlock.message, handled: true })');
    expect(reader).toContain('emitPdfLifecycle("pdf-handled", readerId,');
  });

  it("suppresses the shell error card and toast for handled failures", () => {
    expect(shell).toContain("if (detail?.handled) {");
    expect(shell).toContain('window.addEventListener("pdf-handled", onHandled as EventListener)');
    expect(shell).toContain('window.removeEventListener("pdf-handled", onHandled as EventListener)');
    expect(shell).toContain('toast.dismiss("reader-load-error")');
  });
});
