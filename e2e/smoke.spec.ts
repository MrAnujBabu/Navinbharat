import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

/**
 * Public-surface smoke. No credentials required, so this runs on every PR.
 * The console assertion is the console-error-triage gate: any *real*
 * `console.error` (not a React dev `Warning:`) fails the build, because in
 * production that same line is forwarded to Sentry by `installConsoleErrorForwarder`.
 */
const IGNORED_CONSOLE = [
  /^Warning:/, // React dev-only warnings
  /Download the React DevTools/,
  /\[vite\]/,
];

function collectConsoleErrors(page: Page) {
  const seen: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    seen.push(text);
  });
  return seen;
}

test.describe("public smoke", () => {
  test("landing page renders and is titled without a stale locale claim", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/Naveen Bharat/i);
    // The copy pass removed the literal "Hindi" from user-facing metadata.
    await expect(page).not.toHaveTitle(/Hindi/i);
    await expect(page.locator("h1").first()).toBeVisible();

    expect(pageErrors, `uncaught errors: ${pageErrors.join(" | ")}`).toEqual([]);
    expect(consoleErrors, `console.error: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("login route exposes a usable credential form", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  // Regression: PublicRoute used to swap the sign-in form for a PageLoader while
  // the auth session bootstrapped, so text typed in the first few hundred ms was
  // discarded and submit failed with "Please fill in all fields" on an empty
  // email. Type at first paint with no retry loop — the value must survive.
  test("login input survives auth bootstrap", async ({ page }) => {
    await page.goto("/login", { waitUntil: "commit" });

    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ state: "visible", timeout: 15_000 });
    await emailInput.pressSequentially("bootstrap-probe@example.com", { delay: 10 });

    // Give the auth bootstrap time to resolve and (previously) remount the form.
    await page.waitForTimeout(3000);
    await expect(emailInput).toHaveValue("bootstrap-probe@example.com");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unknown route falls back instead of blanking", async ({ page }) => {
    await page.goto("/this-route-does-not-exist", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const body = (await page.locator("body").innerText()).trim();
    expect(body.length).toBeGreaterThan(0);
  });
});
