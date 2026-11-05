import { describe, it, expect } from "vitest";
import { isProxyRelayable } from "@/lib/linkSources";

describe("isProxyRelayable: GitHub Pages", () => {
  it("relays the app's own GitHub Pages PDF site", () => {
    expect(isProxyRelayable("https://MrAnujBabu.github.io/edu-pdfs/27%20SEP/a.pdf")).toBe(true);
  });
  it("does not relay other GitHub Pages sites", () => {
    expect(isProxyRelayable("https://someone-else.github.io/a.pdf")).toBe(false);
    expect(isProxyRelayable("https://mranujbabu.github.io.attacker.net/a.pdf")).toBe(false);
  });
});
