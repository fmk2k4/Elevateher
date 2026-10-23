import { test, expect } from "@playwright/test";

const LIVE = !!process.env.RUN_E2E;

 test.describe("Dashboard - mentors", () => {
  test.skip(!LIVE, "RUN_E2E not set");

  test("loads without 5xx", async ({ page }) => {
    const resp = await page.goto("/inti-university-malaysia/mentors");
    expect(resp?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /mentor management/i })).toBeVisible();
  });

  test("shows mentor/empty/error UI", async ({ page }) => {
    await page.goto("/inti-university-malaysia/mentors");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/verify profiles and track mentor performance/i)).toBeVisible();
    const body = await page.textContent("body");
    const ok =
      /mentor/i.test(body ?? "") ||
      /pending/i.test(body ?? "") ||
      /approved/i.test(body ?? "") ||
      /no mentor/i.test(body ?? "") ||
      /loading/i.test(body ?? "");
    expect(ok, "expected mentors page text").toBeTruthy();
  });
});
