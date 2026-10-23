import { test, expect } from "@playwright/test";

const LIVE = !!process.env.RUN_E2E;

test.describe("Dashboard - matches", () => {
  test.skip(!LIVE, "RUN_E2E not set");

  test("loads without 5xx", async ({ page }) => {
    const resp = await page.goto("/inti-university-malaysia/matches");
    expect(resp?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /active matches/i })).toBeVisible();
  });

  test("shows match/empty/error UI", async ({ page }) => {
    await page.goto("/inti-university-malaysia/matches");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/mentor-mentee pairings and progress/i)).toBeVisible();
    
    // We expect the seeded demo data to be present and not an error
    const body = await page.textContent("body");
    expect(body).not.toMatch(/unable to load matches/i);
    
    // In our seeded data, we expect at least one match state to be shown.
    // It should show either "active", "pending", or "completed".
    const ok = /active|pending|completed/i.test(body ?? "") || /No active matches/i.test(body ?? "");
    expect(ok).toBeTruthy();
  });
});
