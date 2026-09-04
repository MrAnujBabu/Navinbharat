#!/usr/bin/env node
/**
 * Console usage guard — enforces a shrinking ceiling on raw `console.*`
 * calls in src/. Preferred wrapper: `import { logError } from '@/lib/log'`
 * which routes through reportError + nativeDebug.
 *
 * Allowlist: files that legitimately host console.* (the wrapper itself,
 * dev-only debug helpers).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Snapshot 2026-07-19: 141 raw console.* across src/.
// Ratcheted 2026-09-04: locked to the actual count (103) so new console noise fails CI.
const BUDGET = 103;

const PATTERN = /console\.(log|warn|error|info|debug)\s*\(/;
const ALLOWLIST = [
  "src/lib/log.ts",
  "src/lib/nativeDebug.ts",
  "src/lib/reportError.ts",
];

// Node-native walk: GitHub runners do not ship ripgrep, so shelling out to `rg`
// fails the guard with exit 2 instead of reporting a real violation count.
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === "src/test") continue;
      yield* walk(full);
    } else if (entry.isFile() && !/\.test\./.test(entry.name)) {
      yield full;
    }
  }
}

const lines = [];
if (statSync("src", { throwIfNoEntry: false })) {
  for (const file of walk("src")) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (PATTERN.test(line)) lines.push(`${file}:${i + 1}:${line}`);
    });
  }
}
const filtered = lines.filter((ln) => !ALLOWLIST.some((p) => ln.startsWith(p + ":")));
const count = filtered.length;


if (count > BUDGET) {
  console.error(`❌ console-usage: ${count} raw console.* calls found, budget is ${BUDGET}.`);
  console.error("   Route new logs through '@/lib/log' (logInfo/logWarn/logError).");
  process.exit(1);
}
console.log(`✅ console-usage: ${count}/${BUDGET} raw console.* calls (within budget).`);
