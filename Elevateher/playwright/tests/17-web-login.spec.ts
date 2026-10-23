import { test, expect } from '@playwright/test';

test.describe('Web Login', () => {
  test('can login with demo mentee account', async ({ page }) => {
    // Go to login page
    await page.goto('/account/signin');
    await expect(page).toHaveURL(/.*signin/);

    // Fill out form
    await page.fill('input[type="email"]', 'dewi.mentor@demo.elevateher.app');
    await page.fill('input[type="password"]', 'password123');

    // Click submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard or onboarding
    await expect(page).toHaveURL(/.*(dashboard|onboarding|mentee)/);
  });
});
