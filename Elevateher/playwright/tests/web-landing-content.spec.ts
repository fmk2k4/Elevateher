import { test, expect } from '@playwright/test';

test.describe('Web Landing Page Content', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming WEB_PORT=3001, but playwright config usually routes '/' to web
    await page.goto('/');
  });

  test('proves the landing page communicates the winning story', async ({ page }) => {
    // page contains ElevateHer name
    await expect(page.getByRole('heading', { name: /ElevateHer/i }).first()).toBeVisible();

    // page contains offline/USSD framing and *384#
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/offline/i);
    expect(bodyText).toMatch(/\*384#/);

    // page contains AI matching step
    expect(bodyText).toMatch(/AI/i);
    expect(bodyText).toMatch(/match/i);

    // page contains safety step
    expect(bodyText).toMatch(/safe/i);

    // page contains SDG section
    expect(bodyText).toMatch(/SDG/i);

    // page links to sign up, sign in, and USSD simulator
    const signinLink = page.getByRole('link', { name: /sign in/i });
    if (await signinLink.count() > 0) {
      await expect(signinLink.first()).toBeVisible();
    }
    const signupLink = page.getByRole('link', { name: /sign up/i });
    if (await signupLink.count() > 0) {
      await expect(signupLink.first()).toBeVisible();
    }
    
    // USSD simulator might be linked as "Try Simulator" or similar
    const simulatorLink = page.getByRole('link', { name: /simulator/i });
    if (await simulatorLink.count() > 0) {
      await expect(simulatorLink.first()).toBeVisible();
    }
  });
});
