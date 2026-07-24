import { test, expect } from '@playwright/test';

test.describe('Sprint 1 Features — Auto-Resume, Self-Destruct & Folder Slicer', () => {
  test('renders TTL and Max Downloads self-destruct dropdowns on /send', async ({ page }) => {
    await page.goto('/send');

    // Assert TTL Expiry select exists
    const ttlSelect = page.locator('select').first();
    await expect(ttlSelect).toBeVisible();

    // Assert Max Downloads select exists
    const maxDownloadsSelect = page.locator('select').nth(1);
    await expect(maxDownloadsSelect).toBeVisible();

    // Select 1 Hour TTL and 1 Download Self-Destruct
    await ttlSelect.selectOption('1');
    await maxDownloadsSelect.selectOption('1');
  });

  test('directory file input button renders', async ({ page }) => {
    await page.goto('/send');
    await expect(page.getByText('Browse Entire Directory')).toBeVisible();
  });
});
