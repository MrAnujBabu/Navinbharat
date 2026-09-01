import { test, expect } from "@playwright/test";

/**
 * Authenticated student flow. Skipped unless E2E_EMAIL / E2E_PASSWORD are set,
 * so forks and credential-less runs stay green instead of failing noisily.
 * Never hardcode credentials here — this file is committed.
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("authenticated student flow", () => {
  test.skip(!email || !password, "E2E_EMAIL / E2E_PASSWORD not configured");
  test.describe.configure({ mode: "serial" });

  test("sign in, land on an app route, and read enrolled courses", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/login", { waitUntil: "domcontentloaded" });

    // The auth bootstrap can remount the form right after first paint, which
    // drops anything typed into it. Fill, then verify the values actually stuck
    // before submitting instead of racing the mount.
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(async () => {
      await emailInput.fill(email!);
      await passwordInput.fill(password!);
      await expect(emailInput).toHaveValue(email!);
      await expect(passwordInput).toHaveValue(password!);
    }).toPass({ timeout: 30_000 });

    await page.locator('button[type="submit"]').click();

    // PublicRoute redirects an authenticated user off /login.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 });


    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 30_000 });

    await page.goto("/my-courses", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/courses enrolled|no courses/i).first()).toBeVisible({
      timeout: 30_000,
    });

    expect(pageErrors, `uncaught errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});
