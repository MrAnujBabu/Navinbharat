/**
 * Naveen Bharat — PDF reader landscape layout regression (visual + numeric).
 *
 * Catches the two defects users reported on Android:
 *   1. a pale/white strip across the top of the page in landscape
 *   2. the page not filling the container width (black gutters on both sides)
 *
 * Numeric assertions run first so a failure names the cause; the screenshot
 * snapshot then catches anything the numbers miss (spacing, chrome overlap).
 *
 * Requires env: E2E_EMAIL, E2E_PASSWORD (a real account in the connected
 * project). Never hardcode credentials.
 *
 * Run:
 *   E2E_EMAIL=... E2E_PASSWORD=... npx playwright test e2e/reader-landscape-visual.spec.ts \
 *     --project=android-landscape --project=tablet-landscape
 */
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "test.pdf");

async function login(page: Page) {
  if (!EMAIL || !PASSWORD) test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set");
  await page.goto("/login");
  await page.fill('input[type="email"]', EMAIL!);
  await page.fill('input[type="password"]', PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 20000 });
}

/** Upload the fixture into My Library (idempotent) and open it in the reader. */
async function openFixtureInReader(page: Page) {
  await page.goto("/downloads");
  await page.getByRole("button", { name: /my library/i }).click();
  const enable = page.getByRole("button", { name: /enable my library/i });
  if (await enable.isVisible().catch(() => false)) await enable.click();

  const item = page.getByText(/test\.pdf|^test$/i).first();
  if (!(await item.isVisible().catch(() => false))) {
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await expect(item).toBeVisible({ timeout: 15000 });
  }
  await item.click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30000 });
  // Let the width observer settle after the rotation/scale animation.
  await page.waitForTimeout(800);
}

type Geometry = {
  surfaceWidth: number;
  surfaceTop: number;
  canvasWidth: number;
  canvasTop: number;
  headerVisible: boolean;
  headerHeight: number;
};

async function readGeometry(page: Page): Promise<Geometry> {
  return await page.evaluate(() => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    const surface = canvas?.closest("div.absolute.inset-0") as HTMLElement | null;
    const header = document.querySelector("header") as HTMLElement | null;
    const c = canvas?.getBoundingClientRect();
    const s = surface?.getBoundingClientRect();
    const h = header?.getBoundingClientRect();
    return {
      surfaceWidth: s?.width ?? 0,
      surfaceTop: s?.top ?? 0,
      canvasWidth: c?.width ?? 0,
      canvasTop: c?.top ?? 0,
      headerVisible: !!h && h.bottom > 0,
      headerHeight: h?.height ?? 0,
    };
  });
}

test.describe("PDF reader — landscape layout", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.log(`[page-error] ${err.message}`));
    await login(page);
  });

  test("page fills the container width and leaves no top strip", async ({ page }) => {
    await openFixtureInReader(page);

    const geo = await readGeometry(page);
    expect(geo.surfaceWidth, "reader surface must be measured").toBeGreaterThan(0);
    expect(geo.canvasWidth, "page canvas must be measured").toBeGreaterThan(0);

    // 1. Page fills the width — no black side gutters.
    const fillRatio = geo.canvasWidth / geo.surfaceWidth;
    expect(fillRatio, `page width ${geo.canvasWidth} vs container ${geo.surfaceWidth}`)
      .toBeGreaterThan(0.98);

    // 2. No white strip: the page surface starts either at the viewport top
    //    (header hidden / landscape full-bleed) or exactly under the header.
    const allowedTop = geo.headerVisible ? geo.headerHeight : 0;
    expect(Math.abs(geo.surfaceTop - Math.min(allowedTop, geo.surfaceTop)), "surface top offset")
      .toBeLessThanOrEqual(2);
    expect(geo.surfaceTop, "surface must not float below the header").toBeLessThanOrEqual(allowedTop + 2);
  });

  test("landscape reader visual snapshot", async ({ page }) => {
    await openFixtureInReader(page);
    // Mask the rendered page: content is not what we're regression-testing,
    // the chrome/geometry around it is.
    await expect(page.locator('[data-testid="doc-reader-shell"]')).toHaveScreenshot(
      "reader-landscape.png",
      {
        mask: [page.locator("canvas")],
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      },
    );
  });
});
