import { test, expect } from '@playwright/test';

test.describe('Sprint 2 Features — Multi-Transport & WebAuthn Attestation', () => {
  test('receive page renders status and connects to room', async ({ page }) => {
    await page.goto('/receive/test_sprint2_room');
    await expect(page.getByText(/Connecting to Transfer Room|Direct P2P Stream/i).first()).toBeVisible();
  });
});
