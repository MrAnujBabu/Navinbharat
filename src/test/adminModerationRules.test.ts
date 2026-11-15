import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isActionableReport, MODERATION_SOURCES } from "../lib/moderation";

const types = readFileSync(join(__dirname, "../integrations/supabase/types.ts"), "utf8");
const rowColumns = (table: string): string[] => {
  const m = new RegExp(`^ {6}${table}: \\{\\n {8}Row: \\{\\n([\\s\\S]*?)\\n {8}\\}`, "m").exec(types);
  return m ? [...m[1].matchAll(/^ {10}([a-z_0-9]+)\??:/gm)].map((x) => x[1]) : [];
};

describe("admin moderation rules", () => {
  it("new 'open' reports and legacy 'pending' reports can be resolved or dismissed", () => {
    expect(isActionableReport("open")).toBe(true);
    expect(isActionableReport("pending")).toBe(true);
  });

  it("already resolved or dismissed reports show no actions", () => {
    expect(isActionableReport("resolved")).toBe(false);
    expect(isActionableReport("dismissed")).toBe(false);
  });

  it("community posts are attributed through author_id", () => {
    expect(MODERATION_SOURCES.posts.authorCol).toBe("author_id");
  });

  it.each(Object.entries(MODERATION_SOURCES))("%s tab only queries columns its table has", (_tab, src) => {
    const cols = rowColumns(src.table);
    expect(cols.length).toBeGreaterThan(0);
    for (const c of [src.authorCol, src.bodyCol, "is_hidden", "hidden_reason", "created_at"]) expect(cols).toContain(c);
  });
});
