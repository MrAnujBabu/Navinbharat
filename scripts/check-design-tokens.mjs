#!/usr/bin/env node
/**
 * Design token guard — fails CI when NEW hardcoded color utilities appear
 * in src/components or src/pages. Uses a numeric ceiling snapshot rather
 * than a per-file allowlist so incremental cleanup lowers the ceiling
 * naturally.
 *
 * To lower the budget: fix violations, then update BUDGET below.
 * To raise the budget: don't. Ask for review instead.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Snapshot 2026-09-02: ratcheted 159 -> 158 after the reader safe-area bands
// moved to the .nb-safe-band utility.
// Snapshot 2026-09-01: ratcheted 172 -> 159 after Course.tsx / LessonView.tsx
// migrated to the semantic --video-scrim / --overlay tokens.
// Snapshot 2026-07-19: 172 raw text-white / bg-black occurrences across
// video overlays (intentionally black backgrounds), admin auth pages
// (purple gradient hero, white-on-dark is semantic), and hero carousels
// that sit over banner imagery. Ratchet down as legacy surfaces migrate.
// Allowlist by convention (not enforced): src/components/video/*,
// src/pages/AdminLogin.tsx, src/pages/AdminRegister.tsx,
// src/components/dashboard/HeroCarousel.tsx.
const BUDGET = 158;

const PATTERN = /\btext-white\b|\bbg-black\b/;
const PATHS = ["src/components", "src/pages"];

// Node-native walk: GitHub runners do not ship ripgrep, so shelling out to `rg`
// fails the guard with exit 2 instead of reporting a real violation count.
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const lines = [];
for (const root of PATHS) {
  if (!statSync(root, { throwIfNoEntry: false })) continue;
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    text.split("\n").forEach((line, i) => {
      if (PATTERN.test(line)) lines.push(`${file}:${i + 1}:${line}`);
    });
  }
}
const count = lines.length;


if (count > BUDGET) {
  console.error(`❌ design-tokens: ${count} hardcoded color utilities found, budget is ${BUDGET}.`);
  console.error("   Fix new violations or update BUDGET in scripts/check-design-tokens.mjs.");
  console.error("   Prefer semantic tokens: text-foreground / text-primary-foreground / bg-background.");
  process.exit(1);
}
console.log(`✅ design-tokens: ${count}/${BUDGET} hardcoded color utilities (within budget).`);
