import { test, expect } from "@playwright/test";

test.describe("Error & not-found pages", () => {
  test("dashboard 404 renders non-5xx", async ({ page }) => {
    const resp = await page.goto("/this-route-does-not-exist-12345");
    expect(resp?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator('body').first()).not.toBeEmpty();
  });

  test("web 404 renders non-5xx", async ({ page }) => {
    const resp = await page.goto("/this-route-does-not-exist-12345");
    expect(resp?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator('body').first()).not.toBeEmpty();
  });
});
