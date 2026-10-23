import { test, expect } from "@playwright/test";

const LIVE = !!process.env.RUN_E2E;

test.describe("Dashboard - mentees", () => {
  test.skip(!LIVE, "RUN_E2E not set");

  test("loads without 5xx", async ({ page }) => {
    const resp = await page.goto("/inti-university-malaysia/mentees");
    expect(resp?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /mentee cohort/i })).toBeVisible();
  });

  test("shows mentee/empty/error UI", async ({ page }) => {
    await page.goto("/inti-university-malaysia/mentees");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/all mentees in your institution/i)).toBeVisible();
    const body = await page.textContent("body");
    const ok =
      /mentee/i.test(body ?? "") ||
      /active mentee/i.test(body ?? "") ||
      /loading/i.test(body ?? "") ||
      /no mentee/i.test(body ?? "");
    expect(ok, "expected mentees page text").toBeTruthy();
  });
});
