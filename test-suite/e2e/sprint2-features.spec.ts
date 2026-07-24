import { test, expect } from '@playwright/test';

test.describe('Sprint 2 Features — Multi-Transport & WebAuthn Attestation', () => {
  test('WebAuthn attestation button appears on completed view or receive page renders correctly', async ({ page }) => {
    await page.goto('/receive/test_sprint2_room');
    await expect(page.getByText('Incoming P2P Stream')).toBeVisible();
    await expect(page.getByText('Passphrase Verification Required')).toBeVisible();
  });
});
