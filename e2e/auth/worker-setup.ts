import { test as setup, expect, type Page } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, "../.auth/worker.json");

/**
 * Wait for Turnstile widget to complete in test mode.
 * The test site key `1x00000000000000000000AA` renders a checkbox that auto-passes.
 */
async function waitForTurnstile(page: Page): Promise<void> {
  // Wait for Turnstile iframe or the callback to be invoked
  await page
    .waitForFunction(
      () => {
        const turnstile = (window as unknown as { turnstile?: unknown })
          .turnstile;
        return turnstile !== undefined;
      },
      { timeout: 10_000 },
    )
    .catch(() => {
      // Turnstile may not be present if already rendered, continue
    });

  // The test key auto-passes after render, wait for success state
  await page
    .waitForFunction(
      () =>
        document.querySelector("[data-turnstile]") !== null ||
        document.querySelector(".cf-turnstile") !== null ||
        document.querySelector("iframe[src*='turnstile']") !== null,
      { timeout: 5_000 },
    )
    .catch(() => {
      // Widget may have already auto-passed
    });
}

setup("authenticate as worker", async ({ page }) => {
  await page.goto("/login");

  await page.locator("#name").fill(process.env.E2E_WORKER_NAME!);
  await page.locator("#phone").fill(process.env.E2E_WORKER_PHONE!);
  await page.locator("#dob").fill(process.env.E2E_WORKER_DOB!);

  // Wait for Turnstile to auto-verify (test key passes immediately)
  await waitForTurnstile(page);

  await page.getByRole("button", { name: /로그인|sign in/i }).click();

  await page.waitForURL("**/home/**", { timeout: 15_000 });
  await expect(page.locator("body")).toBeVisible();

  await page.context().storageState({ path: authFile });
});
