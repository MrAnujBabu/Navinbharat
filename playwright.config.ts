import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for the Naveen Bharat web surface.
 *
 * `bun run test:e2e` used to point at a suite that did not exist, which read as
 * green coverage while asserting nothing. The suite in `e2e/` is deliberately
 * small: public-route smoke plus an authenticated student flow that only runs
 * when E2E_EMAIL / E2E_PASSWORD are provided (CI secrets, never committed).
 */
const PORT = Number(process.env.E2E_PORT ?? 8080);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Escape hatch for sandboxes that ship a preinstalled Chromium at a path
    // Playwright's own bundle resolution does not know about. Unset in CI,
    // where `playwright install chromium` provides the matching build.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  // Reuse the running dev server locally; boot one in CI.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Test the production bundle, not the dev server: React StrictMode
        // double-mounts the whole tree in dev, which clears form state on its
        // own and would mask (or fake) the login bootstrap regression.
        command: `bun run build && bunx vite preview --host 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
