import { test, expect } from "@playwright/test";

const LIVE = !!process.env.RUN_E2E;

test.describe("Web - in-app ussd simulator route", () => {
  test.skip(!LIVE, "RUN_E2E not set");
  test("renders the simulator route", async ({ page }) => {
    await page.goto("/ussd-simulator");
    await page.waitForLoadState("domcontentloaded");
    const body = await page.textContent("body");
    expect(body && body.length).toBeTruthy();
  });
});
