import { test, expect } from '@playwright/test';

test.describe('E2E P2P Transfer Stream Flow', () => {
  test('creates room on /send and renders share link', async ({ page }) => {
    await page.goto('/send');
    await expect(page.getByText('Instant Direct P2P Sharing').first()).toBeVisible();

    // Select file
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test-dataset.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('Hardened PeerVault P2P Test Buffer Content'),
    });

    await expect(page.getByText('test-dataset.bin').first()).toBeVisible();

    // Click generate room
    await page.getByRole('button', { name: /Generate Instant Sharing Link/i }).click();

    // Assert room created & waiting for peer
    await expect(page.getByText(/Waiting for Recipient|Ready to Stream/i).first()).toBeVisible({ timeout: 10000 });
    const shareInput = page.locator('#share-link-url-input');
    await expect(shareInput).toBeVisible();
    await expect(shareInput).toHaveValue(/\/receive\/pv_/);
  });
});
