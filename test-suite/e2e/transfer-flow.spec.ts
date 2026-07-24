import { test, expect } from '@playwright/test';

test.describe('E2E P2P Transfer Stream Flow', () => {
  test('creates room on /send and renders share link', async ({ page }) => {
    await page.goto('/send');
    await expect(page.getByText('Create P2P Transfer Stream')).toBeVisible();

    // Select file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-dataset.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('Hardened PeerVault P2P Test Buffer Content'),
    });

    await expect(page.getByText('test-dataset.bin')).toBeVisible();

    // Click generate room
    await page.getByText('Generate Transfer Room & QR').click();

    // Assert room created
    await expect(page.getByText(/TRANSFER STATE: WAITING_PEER|STATE: WAITING_PEER/i)).toBeVisible({ timeout: 10000 });
  });
});
