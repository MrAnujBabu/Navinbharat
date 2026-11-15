/**
 * Guards against queries that ask the database for columns it does not have.
 *
 * PostgREST answers a select naming an unknown column with HTTP 400, and the
 * page silently renders empty (this broke Notices and the admin Moderation
 * "Posts" tab). Most call sites cast their rows, so the type checker cannot
 * catch it — this test cross-checks every literal `.from("t").select("…")`
 * against the generated table definitions in `integrations/supabase/types.ts`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
const typesSrc = readFileSync(join(SRC, "integrations/supabase/types.ts"), "utf8");

/** table/view name -> set of Row column names, parsed from the generated types. */
function parseSchema(): Map<string, Set<string>> {
  const schema = new Map<string, Set<string>>();
  const re = /^ {6}([a-z_0-9]+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm;
  for (const m of typesSrc.matchAll(re)) {
    const cols = new Set<string>();
    for (const line of m[2].split("\n")) {
      const c = /^ {10}([a-z_0-9]+)\??:/.exec(line);
      if (c) cols.add(c[1]);
    }
    schema.set(m[1], cols);
  }
  return schema;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "test" || name === "__tests__" || name === "integrations") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

/** Split a select list on top-level commas (ignores commas inside embeds). */
function splitTop(sel: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of sel) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function missingColumns(schema: Map<string, Set<string>>, table: string, sel: string): string[] {
  const cols = schema.get(table);
  if (!cols) return [];
  const missing: string[] = [];
  for (const raw of splitTop(sel)) {
    if (raw === "*" || raw.startsWith("count")) continue;
    if (raw.includes("(")) {
      // Embedded relation: `alias:table!fk(cols)` — validate the inner list when the table is known.
      let name = raw.slice(0, raw.indexOf("("));
      if (name.includes(":")) name = name.split(":")[1];
      const rel = name.split("!")[0].trim();
      missing.push(...missingColumns(schema, rel, raw.slice(raw.indexOf("(") + 1, raw.lastIndexOf(")"))).map((c) => `${rel}.${c}`));
      continue;
    }
    let name = raw;
    if (name.includes(":") && !name.includes("::")) name = name.split(":")[1];
    name = name.split("::")[0].split("->")[0].trim();
    if (name && !cols.has(name)) missing.push(name);
  }
  return missing;
}

describe("Supabase select column guard", () => {
  const schema = parseSchema();

  it("parses the generated schema", () => {
    expect(schema.get("notices")?.has("title")).toBe(true);
    expect(schema.get("community_posts")?.has("author_id")).toBe(true);
    expect(schema.get("community_posts")?.has("user_id")).toBe(false);
  });

  it("flags a select that names a column the table lacks", () => {
    expect(missingColumns(schema, "notices", "id,title,author_name")).toEqual(["author_name"]);
    expect(missingColumns(schema, "notices", "id, title, created_at")).toEqual([]);
  });

  it("every literal .from(table).select(...) only names existing columns", () => {
    const problems: string[] = [];
    const re = /\.from\(\s*["']([a-z_0-9]+)["'](?:\s+as\s+[^)]+)?\s*\)\s*\.select\(\s*(["'`])((?:(?!\2)[\s\S])*)\2/g;
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(re)) {
        const [, table, , sel] = m;
        if (sel.includes("${")) continue; // dynamic lists are checked at their definition
        const line = text.slice(0, m.index).split("\n").length;
        for (const col of missingColumns(schema, table, sel.replace(/\s+/g, " "))) {
          problems.push(`${relative(SRC, file)}:${line} ${table}.${col}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
