import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const docReaderSpy = vi.fn((props: Record<string, unknown>) => (
  <div
    data-testid="doc-reader"
    data-local-mode={String(props.libraryLocalMode)}
  />
));

vi.mock("../components/library/DocReaderShell", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => docReaderSpy(props),
}));

vi.mock("../components/library/MarkdownViewer", () => ({ default: () => null }));
vi.mock("../components/video/NotionPageRenderer", () => ({ default: () => null }));
vi.mock("../components/library/OfficeDocViewer", () => ({ default: () => null }));

import UniversalFileViewer from "../components/library/UniversalFileViewer";

describe("My Library local PDF routing", () => {
  it("enables the compact local shell only when explicitly requested", () => {
    render(
      <UniversalFileViewer
        url="capacitor://localhost/_capacitor_file_/library/book.pdf"
        title="Book"
        filename="book.pdf"
        fileType="PDF"
        source="library"
        localLibraryPdf
        onBack={() => {}}
      />,
    );
    expect(screen.getByTestId("doc-reader")).toHaveAttribute("data-local-mode", "true");
  });

  it("leaves online and non-library PDF callers on the shared reader mode", () => {
    render(
      <UniversalFileViewer
        url="https://example.com/book.pdf"
        title="Book"
        filename="book.pdf"
        fileType="PDF"
        source="downloads"
        onBack={() => {}}
      />,
    );
    expect(screen.getByTestId("doc-reader")).toHaveAttribute("data-local-mode", "false");
  });
});