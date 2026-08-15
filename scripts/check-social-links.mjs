#!/usr/bin/env node
/**
 * Guard: no hardcoded Telegram URLs outside src/config/socialLinks.ts.
 * Keeps the handle in one place so it can never drift again.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = new Set(["src/config/socialLinks.ts"]);
const ROOT = "src";
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry)) continue;
    const rel = full.replace(/\\/g, "/");
    if (ALLOWED.has(rel)) continue;
    if (rel.startsWith("src/test/") || /\.test\.tsx?$/.test(rel)) continue;
    const src = readFileSync(full, "utf8");
    src.split("\n").forEach((line, i) => {
      if (/["'`]https?:\/\/t\.me\//.test(line)) {
        offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
      }
    });
  }
}

walk(ROOT);

if (offenders.length > 0) {
  console.error("Hardcoded Telegram URL found. Import TELEGRAM_URL from @/config/socialLinks instead:\n");
  offenders.forEach((o) => console.error("  " + o));
  process.exit(1);
}
console.log("check-social-links: OK — no hardcoded Telegram URLs outside src/config/socialLinks.ts");
