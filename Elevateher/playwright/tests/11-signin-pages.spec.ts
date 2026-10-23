import { test, expect } from "@playwright/test";

const LIVE = !!process.env.RUN_E2E;

test.describe("Sign-in / sign-up routes", () => {
  test.skip(!LIVE, "RUN_E2E not set");

  test("dashboard account signin renders", async ({ page }) => {
    const resp = await page.goto("/account/signin");
    expect(resp?.status() ?? 200).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: /sign in to the dashboard/i })).toBeVisible();
    await expect(page.getByText(/web app sign-in lives on the public site/i)).toBeVisible();
  });

  test("dashboard account signup renders", async ({ page }) => {
    const resp = await page.goto("/account/signup");
    expect(resp?.status() ?? 200).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: /request dashboard access/i })).toBeVisible();
    await expect(page.getByText(/web app signup lives on the public site/i)).toBeVisible();
  });
});
