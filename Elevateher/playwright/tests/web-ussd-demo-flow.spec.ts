import { test, expect } from '@playwright/test';

test.describe('USSD Demo Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ussd-simulator');
  });

  test('proves offline-first demo path is functional', async ({ page }) => {
    await expect(page).toHaveURL(/ussd-simulator/);
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeDefined();
    expect(bodyText).not.toMatch(/404/);
    
    // Keypad is visible
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send', exact: true }).first()).toBeVisible();
  });

  test('quick path for English works', async ({ page }) => {
    // Route mock to always return success
    await page.route('/api/ussd/callback', async route => {
      await route.fulfill({ status: 200, body: 'CON Welcome to ElevateHer' });
    });
    
    await page.getByRole('button', { name: 'New User (English)' }).click();
    await expect(page.locator('text=Welcome to ElevateHer')).toBeVisible();
  });

  test('quick path for Malay works', async ({ page }) => {
    await page.route('/api/ussd/callback', async route => {
      await route.fulfill({ status: 200, body: 'CON Selamat Datang ke ElevateHer' });
    });
    
    await page.getByRole('button', { name: 'New User (Malay)' }).click();
    await expect(page.locator('text=Selamat Datang ke ElevateHer')).toBeVisible();
  });

  test('quick path for Indonesian works', async ({ page }) => {
    await page.route('/api/ussd/callback', async route => {
      await route.fulfill({ status: 200, body: 'CON Selamat Datang di ElevateHer' });
    });
    
    await page.getByRole('button', { name: 'New User (Indonesian)' }).click();
    await expect(page.locator('text=Selamat Datang di ElevateHer')).toBeVisible();
  });

  test('returning user path works', async ({ page }) => {
    await page.route('/api/ussd/callback', async route => {
      await route.fulfill({ status: 200, body: 'CON Welcome back' });
    });
    
    await page.getByRole('button', { name: 'Returning User' }).click();
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('backend-unavailable fallback displays useful copy', async ({ page }) => {
    // Simulate failed fetch
    await page.route('/api/ussd/callback', async route => {
      await route.abort('failed');
    });
    
    await page.getByRole('button', { name: 'New User (English)' }).click();
    
    // The simulator should display a gateway error
    await expect(page.locator('text=Unable to reach USSD gateway').first()).toBeVisible();
  });
});

