#!/usr/bin/env node
/**
 * Generates `public/.well-known/assetlinks.json` from the `ANDROID_CERT_SHA256`
 * env var so the release fingerprint is a BUILD INPUT, never a committed
 * literal.
 *
 * Why this exists: the file used to ship a placeholder string
 * (`REPLACE_WITH_NEW_UPLOAD_KEY_SHA256_...`). Android's `autoVerify` silently
 * failed against it, so every App Link (course, lesson, payment return) opened
 * in Chrome instead of the app — with zero error logs.
 *
 * Usage:
 *   ANDROID_CERT_SHA256="AA:BB:...:99,11:22:...:88" node scripts/gen-assetlinks.mjs
 *
 * Accepts multiple fingerprints separated by comma / semicolon / newline so the
 * upload key, the Play app-signing key and (optionally) a debug key can all be
 * listed. Colons are optional; hex case is normalised.
 *
 * Behaviour when the env var is absent:
 *   - normal build (local / CI APK / e2e) → warn, leave committed file, exit 0
 *   - VERCEL_ENV=production or ASSETLINKS_STRICT=1 → hard failure

 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", ".well-known", "assetlinks.json");
// Exactly ONE app id is claimed: com.naveenbharat.app. The legacy
// `com.sadguru.classes` id and its host were retired — do not reintroduce a
// multi-package list here; `check-deep-links.mjs` fails on foreign app ids.
const PACKAGE_NAME = (process.env.ANDROID_PACKAGE_NAME || "com.naveenbharat.app").trim();

// Strictness is DELIBERATELY not keyed off bare `CI=true`: GitHub Actions sets
// it for every job, which made the APK / e2e / Lighthouse builds hard-fail on a
// missing secret even though they never publish a web deploy.
// Strict = a real web publish (Vercel production) or an explicit opt-in.
const strictOptIn =
  process.env.ASSETLINKS_STRICT === "1" || process.env.ASSETLINKS_STRICT === "true";
// NOTE: deliberately NOT keyed off NODE_ENV — every local/preview `vite build`
// sets it to "production" and would then refuse to build without the secret.
const isProd = process.env.VERCEL_ENV === "production";
const strict = strictOptIn || isProd;


const raw = (process.env.ANDROID_CERT_SHA256 || "").trim();

function fail(msg) {
  console.error(`❌ assetlinks: ${msg}`);
  process.exit(1);
}

function normalize(fp) {
  const hex = fp.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length !== 64) {
    fail(
      `fingerprint "${fp.trim()}" has ${hex.length / 2} bytes, expected 32 (SHA-256).`,
    );
  }
  return (hex.match(/.{2}/g) || []).join(":");
}

if (!raw) {
  const msg =
    "ANDROID_CERT_SHA256 is not set — Android App Links cannot verify.\n" +
    "   Web: set it in Vercel project env. CI: repo secret ANDROID_CERT_SHA256.\n" +
    "   See docs/DEEP-LINKS.md.";
  if (strict) fail(msg);
  console.warn(`⚠️  assetlinks: ${msg}`);
  console.warn("   Skipping generation (non-publish build). Deep links will open in the browser.");

  process.exit(0);
}

const fingerprints = [
  ...new Set(
    raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalize),
  ),
];

if (!fingerprints.length) fail("ANDROID_CERT_SHA256 produced no usable fingerprints.");

const statements = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: PACKAGE_NAME,
      sha256_cert_fingerprints: fingerprints,
    },
  },
];

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(statements, null, 2)}\n`, "utf8");

console.log(
  `✅ assetlinks: wrote ${fingerprints.length} fingerprint(s) for ${PACKAGE_NAME} → public/.well-known/assetlinks.json`,
);
