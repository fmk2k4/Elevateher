import { test, expect } from "@playwright/test";

const LIVE = !!process.env.RUN_E2E;

test.describe("Dashboard - impact", () => {
  test.skip(!LIVE, "RUN_E2E not set");

  test("renders impact page", async ({ page }) => {
    const resp = await page.goto("/inti-university-malaysia/impact");
    expect(resp?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /live impact ledger/i })).toBeVisible();
  });

  test("shows runtime mode pills or loading/error states", async ({ page }) => {
    await page.goto("/inti-university-malaysia/impact");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/matching:/i)).toBeVisible();
    const body = await page.textContent("body");
    const ok = /sdg/i.test(body ?? "") || /impact/i.test(body ?? "") || /loading/i.test(body ?? "");
    expect(ok, "expected impact page text").toBeTruthy();
  });
});
