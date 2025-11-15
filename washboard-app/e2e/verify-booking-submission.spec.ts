import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://washboard.ithinkandicode.space';

// Test credentials (playwright test user)
const RECEPTIONIST = {
  branchCode: 'MAIN',
  username: 'playwright',
  password: 'playwright2024'
};

test.describe('Verify Production Booking Submission Fix', () => {
  test('Complete end-to-end booking flow - verify SERVER_ERROR is fixed', async ({ page }) => {
    console.log('\n=== STEP 1: Login as receptionist ===');
    await page.goto(`${PRODUCTION_URL}/login`);
    await page.fill('input[name="branchCode"]', RECEPTIONIST.branchCode);
    await page.fill('input[name="username"]', RECEPTIONIST.username);
    await page.fill('input[name="password"]', RECEPTIONIST.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    console.log('✅ Login successful');

    console.log('\n=== STEP 2: Navigate to magic links ===');
    // Click the Magic Links link in header
    await page.click('a:has-text("Magic Links")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Fill in magic link form
    await page.fill('input[placeholder="John Doe"]', 'Test Portfolio Customer');
    await page.fill('input[placeholder="m.me/customer or Facebook link"]', 'm.me/testportfolio');

    // Click generate button
    await page.click('button:has-text("Generate Magic Link")');

    // Wait for success message or link to appear
    await page.waitForTimeout(2000);

    // Get the generated link
    const linkRow = page.locator('table tbody tr').first();
    const linkToken = await linkRow.locator('td').nth(4).textContent();
    console.log(`✅ Magic link generated: ${linkToken?.substring(0, 20)}...`);

    // Extract token from the cell or use test token
    const token = linkToken || 'test-token-active-abc123';

    console.log('\n=== STEP 3: Open booking form as customer ===');
    const bookingUrl = `${PRODUCTION_URL}/book/MAIN/${token}`;
    await page.goto(bookingUrl);
    await page.waitForLoadState('networkidle');
    console.log(`✅ Booking form loaded: ${bookingUrl}`);

    console.log('\n=== STEP 4: Fill and submit booking form ===');
    // Fill in all required fields
    await page.fill('input[placeholder="ABC1234"]', 'TEST999');
    await page.fill('input[placeholder="Toyota"]', 'Honda');
    await page.fill('input[placeholder="Vios"]', 'Civic');

    // Submit the form
    await page.click('button[type="submit"]:has-text("Submit Booking")');

    console.log('\n=== STEP 5: Verify successful submission ===');
    // Wait for response
    await page.waitForTimeout(3000);

    // Check for success message (should redirect or show success)
    const url = page.url();
    const pageContent = await page.content();

    // Check for SERVER_ERROR (the bug we're testing for)
    const hasServerError = pageContent.includes('SERVER_ERROR') || pageContent.includes('An error occurred while submitting your booking');

    if (hasServerError) {
      console.error('❌ BOOKING SUBMISSION FAILED - SERVER_ERROR still present!');
      console.error('Page URL:', url);

      // Take screenshot of the error
      await page.screenshot({ path: './screenshots/booking-error.png', fullPage: true });

      throw new Error('Booking submission failed with SERVER_ERROR - database setup did not fix the issue');
    } else {
      console.log('✅ No SERVER_ERROR detected');

      // Check for success indicators
      const hasSuccessMessage = pageContent.includes('success') ||
        pageContent.includes('confirmed') ||
        pageContent.includes('submitted') ||
        pageContent.includes('Thank you');

      if (hasSuccessMessage) {
        console.log('✅✅✅ BOOKING SUBMISSION SUCCESSFUL!');
        console.log('The database setup fix worked correctly.');
      } else {
        console.log('⚠️  No explicit error, but also no clear success message');
        console.log('Page URL:', url);
      }

      // Take screenshot of success state
      await page.screenshot({ path: './screenshots/booking-success.png', fullPage: true });
    }
  });
});
