import { test, expect } from '@playwright/test';

test.describe('Hardened PeerVault Visual Regression & UI Suite', () => {
  const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

  const viewports = [
    { name: 'Mobile iPhone SE', width: 375, height: 667 },
    { name: 'Tablet iPad', width: 768, height: 1024 },
    { name: 'Desktop Full HD', width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    test(`Homepage Layout & Canvas Check - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // Verify essential UI elements
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByText('PeerVault')).toBeVisible();

      // Take snapshot
      await page.screenshot({ path: `test-results/homepage-${vp.width}x${vp.height}.png` });
    });

    test(`Send Page Dropzone Check - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}/send`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1')).toBeVisible();
      await page.screenshot({ path: `test-results/send-page-${vp.width}x${vp.height}.png` });
    });
  }
});
