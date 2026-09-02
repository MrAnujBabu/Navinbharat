#!/usr/bin/env node
/**
 * `cap sync` wrapper that strips source maps from the packaged native app.
 *
 * Why: the production web build emits hidden source maps (`vite.config.ts`,
 * `sourcemap: "hidden"`) so Sentry can symbolicate releases. `cap sync` copies
 * the WHOLE `dist/` folder into `android/app/src/main/assets/public`, which put
 * 31 MB of `.map` files inside the APK (50.2 MB shipped in v1.0.5 instead of
 * ~20 MB) and handed the full readable source to anyone unzipping it.
 *
 * `dist/` keeps its maps, so Sentry upload and local debugging are unaffected —
 * only the copy that gets packaged is cleaned.
 *
 * Always sync through this script (`bun run cap:sync`), never bare `cap sync`,
 * or the maps come back.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

const platform = process.argv[2] ?? "";

const sync = spawnSync("npx", ["cap", "sync", platform].filter(Boolean), {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (sync.status !== 0) process.exit(sync.status ?? 1);

/** Web-asset roots Capacitor copies `dist/` into, per platform. */
const ASSET_ROOTS = [
  "android/app/src/main/assets/public",
  "ios/App/App/public",
];

function stripMaps(dir) {
  let removed = 0;
  let bytes = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { removed, bytes };
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = stripMaps(full);
      removed += nested.removed;
      bytes += nested.bytes;
    } else if (entry.name.endsWith(".map")) {
      bytes += statSync(full).size;
      rmSync(full);
      removed += 1;
    }
  }
  return { removed, bytes };
}

let removed = 0;
let bytes = 0;
for (const root of ASSET_ROOTS) {
  const result = stripMaps(root);
  removed += result.removed;
  bytes += result.bytes;
}

console.log(
  `✔ stripped ${removed} source map${removed === 1 ? "" : "s"} from native assets (${(bytes / 1024 / 1024).toFixed(1)} MB saved)`,
);
