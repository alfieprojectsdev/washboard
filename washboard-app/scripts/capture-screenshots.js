#!/usr/bin/env node

/**
 * Screenshot Capture Script for Washboard Portfolio
 *
 * Captures professional screenshots of key user workflows:
 * 1. Customer Booking Form
 * 2. Booking Success Page
 * 3. Receptionist Dashboard Queue
 * 4. Magic Link Generation UI
 *
 * Usage:
 *   node scripts/capture-screenshots.js
 *
 * Requirements:
 *   - Development server running on port 3000
 *   - Playwright installed (npm install -D @playwright/test)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../portfolio-screenshots');
const VIEWPORT = { width: 1024, height: 768 };

// Test data
const TEST_DATA = {
  branch: {
    code: 'MAIN',
    name: 'Main Branch',
    location: '123 Car Wash Lane'
  },
  receptionist: {
    username: 'demo_receptionist',
    password: 'DemoPass123!',
    name: 'Sarah Johnson'
  },
  customers: [
    { name: 'John Smith', plate: 'ABC-1234', make: 'Toyota', model: 'Camry' },
    { name: 'Maria Garcia', plate: 'XYZ-5678', make: 'Honda', model: 'Civic' },
    { name: 'David Chen', plate: 'DEF-9012', make: 'Ford', model: 'F-150' }
  ]
};

/**
 * Initialize database with test data
 */
async function initializeDatabase() {
  console.log('Setting up test database...');

  // Use pg-mem via the existing test infrastructure
  // Create a simple seed script that will be executed
  const seedScript = path.join(__dirname, '../src/__tests__/setup-screenshot-data.ts');

  // For now, we'll rely on the API to create data
  // The app can seed data on first request if needed
  console.log('✓ Test data will be created via API calls');
}

/**
 * Seed test data via API calls
 *
 * Note: Requires DATABASE_URL environment variable for production databases,
 * or USE_MOCK_DB=true for pg-mem in-memory database for testing.
 * If database is not available, uses placeholder tokens for portfolio screenshots.
 */
async function seedTestData(browser) {
  console.log('Creating test data...');

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // First, check if database is available by trying to access dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 5000 }).catch(() => null);

    // Try to sign up a receptionist
    console.log('Setting up receptionist account...');
    const signupResponse = await context.request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        branchCode: TEST_DATA.branch.code,
        username: TEST_DATA.receptionist.username,
        password: TEST_DATA.receptionist.password,
        name: TEST_DATA.receptionist.name,
        email: 'receptionist@carwash.local'
      },
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (signupResponse.ok()) {
      console.log('✓ Receptionist account created');
    } else {
      console.log('⚠ Receptionist account setup skipped (may already exist)');
    }

    // Try login
    const loginResponse = await context.request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        branchCode: TEST_DATA.branch.code,
        username: TEST_DATA.receptionist.username,
        password: TEST_DATA.receptionist.password
      },
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!loginResponse.ok()) {
      console.warn('⚠ Database unavailable - using placeholder token for screenshots');
      await context.close();
      return { token: 'a'.repeat(128) };
    }

    // Navigate to app to establish session
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' }).catch(() => null);

    // Try to create magic link with authenticated session
    console.log('Generating magic link...');
    const magicLinkResponse = await context.request.post(`${BASE_URL}/api/magic-links/generate`, {
      data: {
        branchCode: TEST_DATA.branch.code,
        customerName: TEST_DATA.customers[0].name,
      },
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (magicLinkResponse.ok()) {
      const linkData = await magicLinkResponse.json();
      if (linkData.data && linkData.data.token) {
        console.log('✓ Created magic link');
        await context.close();
        return linkData.data;
      }
    }

    console.warn('⚠ Using placeholder token (database not available)');
    await context.close();
    return { token: 'a'.repeat(128) };
  } catch (error) {
    console.warn('⚠ Database operations skipped - screenshots will use UI layout only');
    // Return a dummy token for screenshots (UI will still render)
    await context.close();
    return { token: 'a'.repeat(128) };
  }
}

/**
 * Create output directory if it doesn't exist
 */
function ensureOutputDirectory() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }
}

/**
 * Capture screenshot of customer booking form
 */
async function captureBookingForm(browser, magicLink) {
  console.log('Capturing booking form screenshot...');

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setViewportSize(VIEWPORT);

  try {
    // Use real token from database if available
    const fs = require('fs');
    let token = magicLink.token || 'a'.repeat(128);
    try {
      const realToken = fs.readFileSync('/tmp/magic_token.txt', 'utf8').trim();
      if (realToken && realToken.length === 128) {
        token = realToken;
      }
    } catch (e) {
      // File doesn't exist, use fallback
    }
    const bookingUrl = `${BASE_URL}/book/${TEST_DATA.branch.code}/${token}`;

    await page.goto(bookingUrl, { waitUntil: 'networkidle' });

    // Wait for form to be visible
    await page.waitForSelector('form', { timeout: 5000 }).catch(() => null);

    // Fill in form with demo data
    await page.fill('input[name="plate"]', TEST_DATA.customers[0].plate).catch(() => null);
    await page.fill('input[name="vehicleMake"]', TEST_DATA.customers[0].make).catch(() => null);
    await page.fill('input[name="vehicleModel"]', TEST_DATA.customers[0].model).catch(() => null);
    await page.fill('input[name="customerName"]', TEST_DATA.customers[0].name).catch(() => null);

    // Wait a moment for form to settle
    await page.waitForTimeout(500);

    const filePath = path.join(OUTPUT_DIR, '01-booking-form.png');
    await page.screenshot({ path: filePath });
    console.log(`✓ Saved: ${filePath}`);
  } catch (error) {
    console.error('Error capturing booking form:', error.message);
  } finally {
    await context.close();
  }
}

/**
 * Capture screenshot of booking success page
 */
async function captureBookingSuccess(browser) {
  console.log('Capturing booking success page screenshot...');

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setViewportSize(VIEWPORT);

  try {
    // Navigate to success page with demo params
    const successUrl = `${BASE_URL}/book/success?booking=12345&position=3`;

    await page.goto(successUrl, { waitUntil: 'networkidle' });

    // Wait for success content
    await page.waitForSelector('[class*="success"], [class*="green"]', { timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(500);

    const filePath = path.join(OUTPUT_DIR, '02-booking-success.png');
    await page.screenshot({ path: filePath });
    console.log(`✓ Saved: ${filePath}`);
  } catch (error) {
    console.error('Error capturing success page:', error.message);
  } finally {
    await context.close();
  }
}

/**
 * Authenticate as receptionist
 */
async function authenticateReceptionist(context) {
  console.log('Authenticating receptionist...');

  try {
    // Try login
    const loginUrl = `${BASE_URL}/api/auth/login`;

    const response = await context.request.post(loginUrl, {
      data: {
        branchCode: TEST_DATA.branch.code,
        username: TEST_DATA.receptionist.username,
        password: TEST_DATA.receptionist.password
      },
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok()) {
      console.log('✓ Receptionist authenticated');
      return true;
    }

    // If auth fails, continue anyway (UI may still render)
    console.warn('⚠ Receptionist authentication failed, continuing anyway');
    return false;
  } catch (error) {
    console.warn('⚠ Could not authenticate:', error.message);
    return false;
  }
}

/**
 * Capture screenshot of dashboard queue
 *
 * Uses WASHBOARD_SCREENSHOT_MODE environment variable to bypass authentication
 * and inject mock booking data directly into the React components.
 */
async function captureDashboard(browser) {
  console.log('Capturing dashboard queue screenshot...');

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setViewportSize(VIEWPORT);

  try {
    // Intercept bookings API to inject mock data
    await page.route('**/api/bookings*', async (route) => {
      const status = new URL(route.request().url()).searchParams.get('status') || 'queued';

      // Generate mock bookings with realistic data
      const allMockBookings = [
        {
          id: 1,
          branchCode: 'MAIN',
          plate: 'ABC-123',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry',
          customerName: 'John Smith',
          customerMessenger: null,
          preferredTime: null,
          status: 'queued',
          position: 1,
          cancelledReason: null,
          cancelledByName: null,
          cancelledAt: null,
          notes: null,
          createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
          updatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
          estimatedWaitMinutes: 5,
        },
        {
          id: 2,
          branchCode: 'MAIN',
          plate: 'XYZ-789',
          vehicleMake: 'Honda',
          vehicleModel: 'Civic',
          customerName: 'Maria Garcia',
          customerMessenger: null,
          preferredTime: null,
          status: 'queued',
          position: 2,
          cancelledReason: null,
          cancelledByName: null,
          cancelledAt: null,
          notes: null,
          createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
          updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
          estimatedWaitMinutes: 25,
        },
        {
          id: 3,
          branchCode: 'MAIN',
          plate: 'DEF-456',
          vehicleMake: 'Ford',
          vehicleModel: 'F-150',
          customerName: 'David Chen',
          customerMessenger: null,
          preferredTime: null,
          status: 'queued',
          position: 3,
          cancelledReason: null,
          cancelledByName: null,
          cancelledAt: null,
          notes: null,
          createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
          estimatedWaitMinutes: 45,
        },
        {
          id: 4,
          branchCode: 'MAIN',
          plate: 'GHI-789',
          vehicleMake: 'BMW',
          vehicleModel: '3 Series',
          customerName: 'Sarah Johnson',
          customerMessenger: null,
          preferredTime: null,
          status: 'in_service',
          position: 0,
          cancelledReason: null,
          cancelledByName: null,
          cancelledAt: null,
          notes: null,
          createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
          updatedAt: new Date(Date.now() - 8 * 60000).toISOString(),
          estimatedWaitMinutes: null,
        },
        {
          id: 5,
          branchCode: 'MAIN',
          plate: 'JKL-012',
          vehicleMake: 'Mazda',
          vehicleModel: 'CX-5',
          customerName: 'Robert Williams',
          customerMessenger: null,
          preferredTime: null,
          status: 'done',
          position: 0,
          cancelledReason: null,
          cancelledByName: null,
          cancelledAt: null,
          notes: null,
          createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
          updatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
          estimatedWaitMinutes: null,
        },
        {
          id: 6,
          branchCode: 'MAIN',
          plate: 'MNO-345',
          vehicleMake: 'Nissan',
          vehicleModel: 'Altima',
          customerName: 'Emily Brown',
          customerMessenger: null,
          preferredTime: null,
          status: 'done',
          position: 0,
          cancelledReason: null,
          cancelledByName: null,
          cancelledAt: null,
          notes: null,
          createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
          updatedAt: new Date(Date.now() - 30 * 60000).toISOString(),
          estimatedWaitMinutes: null,
        },
      ];

      // Filter by status
      const filteredBookings = status === 'queued'
        ? allMockBookings.filter(b => b.status === 'queued')
        : allMockBookings.filter(b => b.status === status);

      // Respond with mock data
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          bookings: filteredBookings,
        }),
      });
    });

    // Intercept shop-status API
    await page.route('**/api/shop-status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: {
            isOpen: true,
            reason: null,
            updatedAt: new Date().toISOString(),
            updatedByName: 'Sarah Johnson',
          },
        }),
      });
    });

    // Navigate to dashboard (screenshot mode will skip auth via env var)
    const dashboardUrl = `${BASE_URL}/dashboard`;
    console.log('Loading dashboard with mock data...');

    await page.goto(dashboardUrl, { waitUntil: 'networkidle', timeout: 10000 }).catch((err) => {
      console.warn('Navigation warning (continuing anyway):', err.message);
    });

    // Wait for table to render
    await page.waitForSelector('table', { timeout: 5000 }).catch(() => {
      console.warn('⚠ Table not found, continuing with screenshot');
    });

    // Wait for content to stabilize
    await page.waitForTimeout(1500);

    const filePath = path.join(OUTPUT_DIR, '03-dashboard-queue.png');
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`✓ Saved: ${filePath}`);
  } catch (error) {
    console.error('Error capturing dashboard:', error.message);
  } finally {
    await context.close();
  }
}

/**
 * Capture screenshot of magic link generation UI
 *
 * Injects realistic mock magic link data without requiring database authentication.
 * Mock data includes 2 active links and 1 expired link with realistic details.
 */
async function captureMagicLinkUI(browser) {
  console.log('Capturing magic link generation UI screenshot...');

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setViewportSize(VIEWPORT);

  try {
    // Set up route interception for magic links API
    await page.route('**/api/magic-links/list*', async (route) => {
      const status = new URL(route.request().url()).searchParams.get('status') || 'active';

      // Generate mock magic links with realistic data
      const allMockLinks = [
        {
          id: 1,
          branchCode: 'MAIN',
          token: 'ml_' + 'a'.repeat(40),
          customerName: 'John Smith',
          customerMessenger: null,
          expiresAt: new Date(Date.now() + 24 * 60 * 60000).toISOString(),
          usedAt: null,
          bookingId: null,
          bookingPlate: null,
          createdAt: new Date(Date.now() - 2 * 60000).toISOString(),
          createdByName: 'Sarah Johnson',
          status: 'active',
          bookingUrl: `${BASE_URL}/book/MAIN/ml_${'a'.repeat(40)}`,
        },
        {
          id: 2,
          branchCode: 'MAIN',
          token: 'ml_' + 'b'.repeat(40),
          customerName: 'Maria Garcia',
          customerMessenger: null,
          expiresAt: new Date(Date.now() + 18 * 60 * 60000).toISOString(),
          usedAt: null,
          bookingId: null,
          bookingPlate: null,
          createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
          createdByName: 'Sarah Johnson',
          status: 'active',
          bookingUrl: `${BASE_URL}/book/MAIN/ml_${'b'.repeat(40)}`,
        },
        {
          id: 3,
          branchCode: 'MAIN',
          token: 'ml_' + 'c'.repeat(40),
          customerName: 'David Chen',
          customerMessenger: null,
          expiresAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
          usedAt: null,
          bookingId: null,
          bookingPlate: null,
          createdAt: new Date(Date.now() - 26 * 60 * 60000).toISOString(),
          createdByName: 'Sarah Johnson',
          status: 'expired',
          bookingUrl: `${BASE_URL}/book/MAIN/ml_${'c'.repeat(40)}`,
        },
      ];

      // Filter by status
      let filteredLinks = allMockLinks;
      if (status !== 'all') {
        filteredLinks = allMockLinks.filter(link => link.status === status);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          magicLinks: filteredLinks,
        }),
      });
    });

    // Create a fake session cookie to bypass authentication
    const fakeSessionId = 'a'.repeat(32);
    await context.addCookies([{
      name: 'washboard_session',
      value: fakeSessionId,
      domain: new URL(BASE_URL).hostname,
      path: '/',
      expires: Date.now() / 1000 + 86400, // 1 day from now
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }]);

    // Navigate to magic links page
    const magicLinksUrl = `${BASE_URL}/dashboard/magic-links`;
    console.log('Loading magic links page with mock data...');

    await page.goto(magicLinksUrl, { waitUntil: 'networkidle', timeout: 10000 }).catch((err) => {
      console.warn('Navigation warning (continuing anyway):', err.message);
    });

    // Wait for magic links table to render
    await page.waitForSelector('table', { timeout: 5000 }).catch(() => {
      console.warn('⚠ Table not found, checking for form elements...');
    });

    // Wait for QR codes to generate (they're async)
    await page.waitForTimeout(2000);

    const filePath = path.join(OUTPUT_DIR, '04-magic-links.png');
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`✓ Saved: ${filePath}`);
  } catch (error) {
    console.error('Error capturing magic links UI:', error.message);
  } finally {
    await context.close();
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Washboard Portfolio Screenshot Capture');
  console.log('='.repeat(60));

  // Enable screenshot mode to bypass authentication
  process.env.WASHBOARD_SCREENSHOT_MODE = 'true';

  ensureOutputDirectory();

  let browser;

  try {
    // Launch browser
    console.log(`Launching Chromium browser...`);
    browser = await chromium.launch({ headless: true });

    // Initialize database
    await initializeDatabase();

    // Create test data via API
    const magicLink = await seedTestData(browser);

    // Capture screenshots
    console.log('');
    console.log('Capturing screenshots...');
    console.log('-'.repeat(60));

    // Capture all screenshots in order
    await captureBookingForm(browser, magicLink);
    await captureBookingSuccess(browser);
    await captureDashboard(browser);
    await captureMagicLinkUI(browser);

    console.log('-'.repeat(60));
    console.log('');
    console.log('Screenshot capture complete!');
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log(`Files created:`);

    const files = fs.readdirSync(OUTPUT_DIR);
    files.forEach(file => {
      if (file.endsWith('.png')) {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
      }
    });

    console.log('='.repeat(60));
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the script
main();
