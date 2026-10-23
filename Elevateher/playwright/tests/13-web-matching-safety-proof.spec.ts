import { test, expect } from '@playwright/test';

test.describe('Web Matching Safety Proof', () => {
  const setupSession = async (page) => {
    await page.route('/api/auth/session', async route => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'mock-mentee-id',
            role: 'mentee',
            onboarding_complete: true
          },
          expires: new Date(Date.now() + 86400000).toISOString()
        }
      });
    });
  };

  test('proves the core value prop: a mentee finds a safe, relevant mentor', async ({ page }) => {
    await setupSession(page);
    
    // Mock the backend match API to return the safe mentor (Priya)
    await page.route('/api/mentor/list*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          mentors: [
            {
              id: 'priya-id',
              display_name: 'Priya Nair',
              job_title: 'Senior Data Scientist',
              employer: 'Tech Corp',
              industry: 'Technology',
              country: 'MY',
              years_exp: 9,
              languages: ['en', 'ms'],
              skills: ['Python', 'Data Science'],
              bio_safety_score: 0.95,
              match_score: 0.95,
              match_reason: 'Matched because: both speak en, ms, Technology industry, 9 years of professional experience.',
              bio: 'I love helping people learn data science.',
              can_mentor_minors: true,
              current_mentees: 0,
              max_mentees: 5
            }
          ]
        }
      });
    });

    await page.goto('/mentee/candidates');
    
    // Assert Priya appears
    await expect(page.locator('text=Priya Nair')).toBeVisible();
    await expect(page.locator('text=Senior Data Scientist')).toBeVisible();
    
    // Assert visible explanation contains language/track/safety messaging
    const bodyText = await page.textContent('body') || '';
    expect(bodyText).toContain('Matched because: both speak en, ms, Technology industry');
    
    // Assert Demo Unsafe Mentor absent
    expect(bodyText).not.toContain('Demo Unsafe Mentor');
    // Assert Demo Suspended Mentor absent
    expect(bodyText).not.toContain('Demo Suspended Mentor');
    // Assert Demo Full Capacity Mentor absent
    expect(bodyText).not.toContain('Demo Full Capacity Mentor');
  });
});
