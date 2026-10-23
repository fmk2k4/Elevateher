import { test, expect } from "@playwright/test";

const LIVE = !!process.env.RUN_E2E;

test.describe("Web - landing + ussd-simulator", () => {
  test.skip(!LIVE, "RUN_E2E not set");

  test("landing renders", async ({ page }) => {
    const resp = await page.goto("/");
    expect(resp?.status() ?? 0).toBeLessThan(500);
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("ussd-simulator route reachable", async ({ page }) => {
    const resp = await page.goto("/ussd-simulator");
    expect(resp?.status() ?? 0).toBeLessThan(500);
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });
});
