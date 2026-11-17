import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getNote: vi.fn(),
  saveNote: vi.fn(),
}));

vi.mock("../services/libraryNotes", () => ({
  getNote: mocks.getNote,
  saveNote: mocks.saveNote,
  extractWikiLinks: () => [],
}));

vi.mock("../services/personalLibrary", () => ({
  listAllFolders: vi.fn().mockResolvedValue([]),
  listItems: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/reader/noteExport", () => ({
  openInObsidian: vi.fn(),
  revealInObsidian: vi.fn(),
  shareNoteMarkdown: vi.fn(),
  setVault: vi.fn(),
  getVault: vi.fn(() => null),
  setVaultFolder: vi.fn(),
  getVaultFolder: vi.fn(() => ""),
  withFrontmatter: (markdown: string) => markdown,
  normalizeMarkdown: (markdown: string) => markdown,
  noteFilename: (title: string) => `${title}.md`,
  vaultFilePath: vi.fn(() => "note"),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    success: vi.fn(),
  },
}));

import NotesPanel from "../components/library/reader/NotesPanel";

describe("Notes opening behavior", () => {
  beforeEach(() => {
    mocks.getNote.mockReset();
    mocks.saveNote.mockReset().mockResolvedValue(undefined);
  });

  it("opens a saved note in Read mode without opening the keyboard", async () => {
    mocks.getNote.mockResolvedValue("Plant growth and respiration notes");
    render(<NotesPanel itemId="pdf-1" title="Respiration" />);

    expect(await screen.findByText("Plant growth and respiration notes")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write" })).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("focuses the editor only after the explicit Write action", async () => {
    mocks.getNote.mockResolvedValue("Saved note body");
    render(<NotesPanel itemId="pdf-1" title="Respiration" />);

    fireEvent.click(await screen.findByRole("button", { name: "Write" }));
    const editor = await screen.findByRole("textbox");
    await waitFor(() => expect(editor).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Read" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Saved note body")).toBeInTheDocument();
  });

  it("opens a blank note for writing without stealing focus", async () => {
    mocks.getNote.mockResolvedValue("");
    render(<NotesPanel itemId="pdf-2" title="New PDF" />);

    const editor = await screen.findByRole("textbox");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    expect(editor).not.toHaveFocus();
  });
});
