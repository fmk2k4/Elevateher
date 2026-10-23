import { test, expect } from "@playwright/test";

const SIM =
  "file:///D:/Hackathon/Elevateher/Elevateher/scratch/ussd_simulator.html";

test.describe("USSD simulator - standalone", () => {
  test("page loads + has DOM elements", async ({ page }) => {
    const resp = await page.goto(SIM);
    expect(resp?.ok() ?? true).toBeTruthy();
    await expect(page.locator("#screen")).toBeVisible();
    await expect(page.locator("#inp")).toBeVisible();
    await expect(page.locator("#cfgApi")).toBeVisible();
  });

  test("keypad appends characters", async ({ page }) => {
    await page.goto(SIM);
    const key1 = page.locator(".key").filter({
      has: page.locator(".main", { hasText: /^1$/ }),
    });
    await key1.first().click();
    const key2 = page.locator(".key").filter({
      has: page.locator(".main", { hasText: /^2$/ }),
    });
    await key2.first().click();
    const value = await page.locator("#inp").inputValue();
    expect(value).toBe("12");
  });

  test("dial button toggles status text", async ({ page }) => {
    await page.goto(SIM);
    await page.getByRole("button", { name: /Dial \*\d+#/ }).click();
    await page.waitForTimeout(500);
    const status = await page.locator("#statusLbl").textContent();
    expect(status || "").not.toMatch(/^Idle/);
  });
});
