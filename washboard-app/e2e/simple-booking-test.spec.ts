import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://washboard.ithinkandicode.space';

test.describe('Simple Booking Submission Test', () => {
  test('Verify booking submission works with existing magic link', async ({ page }) => {
    console.log('\n=== Testing booking submission with existing magic link ===');

    // Use a fresh magic link token (generated 2025-11-15)
    const testToken = '6839bf03ae4b88209cbc04157663c773a5d73b27cf1e20647fcf63df4a703fc568e52eee5783326c5c0892269de32be8abe45f6a7e4a406c6712546649dd80b2';
    const bookingUrl = `${PRODUCTION_URL}/book/MAIN/${testToken}`;

    console.log(`\n1. Navigate to booking form: ${bookingUrl}`);
    await page.goto(bookingUrl);
    await page.waitForLoadState('networkidle');

    console.log('\n2. Fill in booking details');
    await page.fill('input[placeholder="ABC-1234"]', 'TEST9999');
    await page.fill('input[placeholder="Toyota"]', 'Honda');
    await page.fill('input[placeholder="Camry"]', 'Civic');

    console.log('\n3. Submit booking');
    await page.click('button[type="submit"]:has-text("Submit Booking")');

    console.log('\n4. Wait for response');
    await page.waitForTimeout(5000);

    const url = page.url();
    const content = await page.content();

    // Check for errors
    const hasServerError = content.includes('SERVER_ERROR') ||
                          content.includes('An error occurred while submitting your booking');

    if (hasServerError) {
      console.error('\n❌ BOOKING FAILED - SERVER_ERROR detected!');
      await page.screenshot({ path: './screenshots/booking-error.png', fullPage: true });
      throw new Error('Booking submission failed with SERVER_ERROR');
    }

    console.log('\n✅✅✅ BOOKING SUBMISSION SUCCESSFUL!');
    console.log('No SERVER_ERROR detected');
    console.log('Current URL:', url);

    await page.screenshot({ path: './screenshots/booking-success.png', fullPage: true });
  });
});
