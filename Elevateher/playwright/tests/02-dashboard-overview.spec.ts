import { test, expect } from "@playwright/test";

const LIVE = !!process.env.RUN_E2E;
const SUBDOMAIN = "inti-university-malaysia";

test.describe("Dashboard - overview", () => {
  test.skip(!LIVE, "RUN_E2E not set");

  test("renders overview page and expects valid data", async ({ page }) => {
    await page.goto(`/${SUBDOMAIN}/overview`);
    // Wait for the skeleton/loading state to disappear
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /cohort overview/i }).first()).toBeVisible({
      timeout: 15000,
    });
    const body = await page.textContent("body");
    // Ensure we don't just see a loading or error screen on demo day
    expect(body).not.toMatch(/unable to load dashboard/i);
    // Explicitly check for our seeded "Demo Mode" ribbon as well
    await expect(page.getByText(/Hackathon Demo Mode/i)).toBeVisible();
  });

  test("at least 3 stat card tiles are visible", async ({ page }) => {
    await page.goto(`/${SUBDOMAIN}/overview`);
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(/active mentees|verified mentors|programmes completed/i).first(),
    ).toBeVisible();
    const cards = page.locator("div").filter({
      hasText: /Active Mentees|Verified Mentors|Programmes Completed|SDG \d+\.\d+/i,
    });
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
  });
});
