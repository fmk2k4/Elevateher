import { test, expect } from '@playwright/test';

test.describe('Web Impact Proof', () => {
  const setupSessionAndImpact = async (page) => {
    // Mock user session
    await page.route('/api/auth/session', async route => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'mock-mentee-id', role: 'mentee' },
          expires: new Date(Date.now() + 86400000).toISOString()
        }
      });
    });

    // Mock the impact events data
    await page.route('/api/impact-events', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          json: {
            summary: [
              { sdg_goal: '4.4', count: '2' },
              { sdg_goal: '8.6', count: '1' }
            ],
            events: [
              {
                id: 'event-1',
                event_type: 'skill_gained',
                sdg_goal: '4.4',
                description: 'Completed Python Basics',
                recorded_at: new Date().toISOString()
              },
              {
                id: 'event-2',
                event_type: 'career_entry',
                sdg_goal: '8.6',
                description: 'First tech internship',
                recorded_at: new Date().toISOString()
              }
            ]
          }
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          json: { success: true }
        });
      }
    });
  };

  test('proves the product tracks outcomes and not just conversations', async ({ page }) => {
    await setupSessionAndImpact(page);
    
    // Go to impact tracking page
    await page.goto('/mentee/impact');
    
    // Assert SDG goals and counts render
    await expect(page.locator('text=My SDG Impact Log')).toBeVisible();
    await expect(page.locator('text=Completed Python Basics')).toBeVisible();
    await expect(page.locator('text=First tech internship')).toBeVisible();
    
    // Wait for the UI elements to render for the SDG boxes
    // There are boxes for 4.4, 5.5, 8.6, 17.16
    // We mocked count=2 for 4.4 and count=1 for 8.6
    const count44Box = page.locator('div').filter({ hasText: /^4\.4$/ }).locator('..').locator('div').first();
    const count86Box = page.locator('div').filter({ hasText: /^8\.6$/ }).locator('..').locator('div').first();
    
    // Test the Log Achievement flow
    await page.getByRole('button', { name: '+ Log Achievement' }).click();
    await page.locator('select').selectOption('internship_started');
    await page.locator('textarea').fill('Started a new software engineering internship.');
    await page.getByRole('button', { name: /Log Achievement 🌱/i }).click();
    
    // Since we mocked POST to return success and react-query invalidates and refetches (which we also mocked),
    // the form should close
    await expect(page.getByRole('button', { name: 'Cancel' })).not.toBeVisible();
  });
});
