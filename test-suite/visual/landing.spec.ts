import { test, expect } from '@playwright/test';

test.describe('Visual Regression - Landing Page', () => {
  test('landing hero render at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('landing-1920x1080.png');
  });

  test('landing hero render at 375x667 mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('landing-mobile.png');
  });
});
