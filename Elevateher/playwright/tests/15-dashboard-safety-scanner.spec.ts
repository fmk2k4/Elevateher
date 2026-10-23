import { test, expect } from '@playwright/test';

test.describe('Dashboard Safety Scanner', () => {
  test('proves live scanner UI exists and functions', async ({ page }) => {
    // Mock the data load for safety overview
    await page.route('/api/dashboard/admin/safety', async route => {
      await route.fulfill({
        status: 200,
        json: {
          stats: { open_reports: 0, critical_open: 0, auto_suspensions: 0, total_reports: 0 },
          reports: [],
          risk_mentors: [],
          suspended: []
        }
      });
    });

    // We navigate to the safety page on the admin dashboard
    // If the test runner uses localhost without subdomain routing for tests, it might just be /safety
    await page.goto('/inti/safety');
    
    // Switch to Live Scanner tab
    await page.getByRole('button', { name: 'Live Scanner' }).click();

    // Mock backend bio scan for unsafe
    await page.route('/api/dashboard/safety/text', async (route) => {
      const requestBody = JSON.parse(route.request().postData() || '{}');
      if (requestBody.text.includes('WhatsApp')) {
        await route.fulfill({
          status: 200,
          json: {
            approved: false,
            safe_score: 0.3,
            requires_human_review: true,
            flags: ['off_platform_solicitation']
          }
        });
      } else {
        await route.fulfill({
          status: 200,
          json: {
            approved: true,
            safe_score: 0.95,
            requires_human_review: false,
            flags: []
          }
        });
      }
    });

    // Click WhatsApp Solicitation sample
    await page.getByRole('button', { name: 'WhatsApp Solicitation' }).click();
    await page.getByRole('button', { name: 'Scan Bio' }).click();
    
    // Assert unsafe results
    await expect(page.locator('text=REJECTED')).toBeVisible();
    await expect(page.locator('text=REQUIRES REVIEW')).toBeVisible();
    await expect(page.locator('text=off_platform_solicitation')).toBeVisible();
    await expect(page.locator('text=30.0%')).toBeVisible(); // 0.3 * 100
    
    // Click Safe Bio sample
    await page.getByRole('button', { name: 'Safe Bio' }).click();
    await page.getByRole('button', { name: 'Scan Bio' }).click();
    
    // Assert safe results
    await expect(page.locator('text=APPROVED')).toBeVisible();
    await expect(page.locator('text=95.0%')).toBeVisible();
    await expect(page.locator('text=REJECTED')).not.toBeVisible();
  });
});
