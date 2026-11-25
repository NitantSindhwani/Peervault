import { test, expect } from '@playwright/test';

test('Full P2P transfer test between Sender and Receiver', async ({ browser }) => {
  test.setTimeout(90000);
  const senderContext = await browser.newContext();
  const receiverContext = await browser.newContext();

  const senderPage = await senderContext.newPage();
  const receiverPage = await receiverContext.newPage();

  // Capture all logs
  senderPage.on('console', (msg) => console.log(`[SENDER CONSOLE] ${msg.type()}: ${msg.text()}`));
  receiverPage.on('console', (msg) => console.log(`[RECEIVER CONSOLE] ${msg.type()}: ${msg.text()}`));
  senderPage.on('pageerror', (err) => console.error(`[SENDER ERROR]`, err));
  receiverPage.on('pageerror', (err) => console.error(`[RECEIVER ERROR]`, err));

  console.log('1. Navigating sender to /send');
  await senderPage.goto('/send');
  await expect(senderPage.getByText('Instant Direct P2P Sharing').first()).toBeVisible();

  const filePath = 'd:/Peervault/scratch/test-150mb.webm';
  const fileInput = senderPage.locator('#file-input');
  await fileInput.setInputFiles(filePath);

  await expect(senderPage.getByText('test-150mb.webm').first()).toBeVisible();

  console.log('2. Clicking Generate Instant Sharing Link');
  await senderPage.getByRole('button', { name: /Generate Instant Sharing Link/i }).click();

  const shareInput = senderPage.locator('#share-link-url-input');
  await expect(shareInput).toBeVisible({ timeout: 10000 });
  const shareUrl = await shareInput.inputValue();
  console.log('3. Generated share URL:', shareUrl);

  expect(shareUrl).toContain('/receive/pv_');

  console.log('4. Navigating receiver to share URL');
  await receiverPage.goto(shareUrl);

  console.log('5. Waiting for Accept button on receiver');
  const acceptButton = receiverPage.getByRole('button', { name: /Accept & Receive File/i });
  await expect(acceptButton).toBeVisible({ timeout: 15000 });

  console.log('6. Clicking Accept & Receive File');
  await acceptButton.click();

  console.log('7. Waiting for transfer to complete or fail');
  // Wait for either complete or check telemetry after 10 seconds
  try {
    await expect(senderPage.getByText(/File Stream Complete|Complete/i).first()).toBeVisible({ timeout: 15000 });
    console.log('SUCCESS! Sender marked complete!');
  } catch (e) {
    console.log('Sender did not reach complete in 15s. Checking state...');
    const senderStatus = await senderPage.locator('body').innerText();
    console.log('[SENDER BODY SNIPPET]:', senderStatus.substring(0, 500));
    const receiverStatus = await receiverPage.locator('body').innerText();
    console.log('[RECEIVER BODY SNIPPET]:', receiverStatus.substring(0, 500));
    throw e;
  }
});
