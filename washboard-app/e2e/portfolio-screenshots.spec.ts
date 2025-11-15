import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://washboard.ithinkandicode.space';
const SCREENSHOTS_DIR = './screenshots/portfolio';

// Test credentials (playwright test user)
const RECEPTIONIST = {
  branchCode: 'MAIN',
  username: 'playwright',
  password: 'playwright2024'
};

test.describe('Portfolio Screenshots - Washboard Production', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCTION_URL);
  });

  test('01 - Homepage / Landing', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/01-homepage.png`,
      fullPage: true
    });
  });

  test('02 - Receptionist Login Page', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Fill in credentials (but don't submit yet for screenshot)
    await page.fill('input[name="branchCode"]', RECEPTIONIST.branchCode);
    await page.fill('input[name="username"]', RECEPTIONIST.username);

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/02-login-page.png`,
      fullPage: true
    });
  });

  test('03 - Receptionist Dashboard - Queue View', async ({ page }) => {
    // Login
    await page.goto(`${PRODUCTION_URL}/login`);
    await page.fill('input[name="branchCode"]', RECEPTIONIST.branchCode);
    await page.fill('input[name="username"]', RECEPTIONIST.username);
    await page.fill('input[name="password"]', RECEPTIONIST.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');

    // Take screenshot of queue view
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/03-dashboard-queue.png`,
      fullPage: true
    });
  });

  test('04 - Magic Links Generation Page', async ({ page }) => {
    // Login
    await page.goto(`${PRODUCTION_URL}/login`);
    await page.fill('input[name="branchCode"]', RECEPTIONIST.branchCode);
    await page.fill('input[name="username"]', RECEPTIONIST.username);
    await page.fill('input[name="password"]', RECEPTIONIST.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');

    // Navigate to magic links
    await page.goto(`${PRODUCTION_URL}/dashboard?view=magic-links`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/04-magic-links-page.png`,
      fullPage: true
    });
  });

  test('05 - Magic Link Generation Form', async ({ page }) => {
    // Login and go to magic links
    await page.goto(`${PRODUCTION_URL}/login`);
    await page.fill('input[name="branchCode"]', RECEPTIONIST.branchCode);
    await page.fill('input[name="username"]', RECEPTIONIST.username);
    await page.fill('input[name="password"]', RECEPTIONIST.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');
    await page.goto(`${PRODUCTION_URL}/dashboard?view=magic-links`);

    // Fill in form (but don't submit)
    await page.fill('input[placeholder="John Doe"]', 'Sample Customer');
    await page.fill('input[placeholder="m.me/customer or Facebook link"]', 'm.me/samplecustomer');

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/05-magic-link-form-filled.png`,
      fullPage: true
    });
  });

  test('06 - Shop Status Toggle', async ({ page }) => {
    // Login
    await page.goto(`${PRODUCTION_URL}/login`);
    await page.fill('input[name="branchCode"]', RECEPTIONIST.branchCode);
    await page.fill('input[name="username"]', RECEPTIONIST.username);
    await page.fill('input[name="password"]', RECEPTIONIST.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');

    // Navigate to shop status
    await page.goto(`${PRODUCTION_URL}/dashboard?view=shop-status`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/06-shop-status.png`,
      fullPage: true
    });
  });

  test('07 - Customer Booking Form (via magic link)', async ({ page }) => {
    // Use one of the test magic links from mock-seed.sql
    const testToken = 'test-token-active-abc123';

    await page.goto(`${PRODUCTION_URL}/book/MAIN/${testToken}`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/07-customer-booking-form.png`,
      fullPage: true
    });
  });

  test('08 - Customer Booking Form - Filled', async ({ page }) => {
    const testToken = 'test-token-active-abc123';

    await page.goto(`${PRODUCTION_URL}/book/MAIN/${testToken}`);
    await page.waitForLoadState('networkidle');

    // Fill in the booking form
    await page.fill('input[placeholder="ABC1234"]', 'XYZ9876');
    await page.fill('input[placeholder="Toyota"]', 'Honda');
    await page.fill('input[placeholder="Vios"]', 'Civic');

    // Scroll to form bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/08-customer-booking-filled.png`,
      fullPage: true
    });
  });

  test('09 - Dashboard - All Bookings View', async ({ page }) => {
    // Login
    await page.goto(`${PRODUCTION_URL}/login`);
    await page.fill('input[name="branchCode"]', RECEPTIONIST.branchCode);
    await page.fill('input[name="username"]', RECEPTIONIST.username);
    await page.fill('input[name="password"]', RECEPTIONIST.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');

    // Click on "All" status filter
    await page.click('button:has-text("All")');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/09-dashboard-all-bookings.png`,
      fullPage: true
    });
  });

  test('10 - Mobile Responsive - Dashboard', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    // Login
    await page.goto(`${PRODUCTION_URL}/login`);
    await page.fill('input[name="branchCode"]', RECEPTIONIST.branchCode);
    await page.fill('input[name="username"]', RECEPTIONIST.username);
    await page.fill('input[name="password"]', RECEPTIONIST.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/10-mobile-dashboard.png`,
      fullPage: true
    });
  });
});
