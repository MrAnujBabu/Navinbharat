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
 *   - local dev  → warn loudly, leave the committed file untouched, exit 0
 *   - CI / prod  → hard failure (never publish an unverifiable file)
 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", ".well-known", "assetlinks.json");
// Comma/semicolon separated so ONE deployment can claim several app ids — the
// legacy `sadguruclasses.vercel.app` host needs both the old `com.sadguru.classes`
// and the current `com.naveenbharat.app` to verify.
const PACKAGE_NAMES = [
  ...new Set(
    (process.env.ANDROID_PACKAGE_NAME || "com.naveenbharat.app")
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];

const isCI = process.env.CI === "true" || process.env.CI === "1";
// NOTE: deliberately NOT keyed off NODE_ENV — every local/preview `vite build`
// sets it to "production" and would then refuse to build without the secret.
const isProd = process.env.VERCEL_ENV === "production";
const strict = isCI || isProd;

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
    "   Set it in Vercel project env (see docs/DEEP-LINKS.md).";
  if (strict) fail(msg);
  console.warn(`⚠️  assetlinks: ${msg}`);
  console.warn("   Skipping generation (local build). Deep links will open in the browser.");
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

const statements = PACKAGE_NAMES.map((pkg) => ({
  relation: ["delegate_permission/common.handle_all_urls"],
  target: {
    namespace: "android_app",
    package_name: pkg,
    sha256_cert_fingerprints: fingerprints,
  },
}));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(statements, null, 2)}\n`, "utf8");

console.log(
  `✅ assetlinks: wrote ${fingerprints.length} fingerprint(s) for ${PACKAGE_NAMES.join(", ")} → public/.well-known/assetlinks.json`,
);
