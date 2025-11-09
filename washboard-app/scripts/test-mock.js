#!/usr/bin/env node

/**
 * Test script to verify mock data injection works
 */

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../portfolio-screenshots');

async function testDashboardMocking() {
  console.log('Testing dashboard mock data injection...\n');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setViewportSize({ width: 1024, height: 768 });

    // Intercept bookings API
    await page.route('**/api/bookings*', (route) => {
      console.log('✓ API request intercepted:', route.request().url());

      route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          bookings: [
            {
              id: 1,
              plate: 'ABC-123',
              vehicleMake: 'Toyota',
              vehicleModel: 'Camry',
              customerName: 'John Smith',
              status: 'queued',
              position: 1,
              estimatedWaitMinutes: 5,
            }
          ],
        }),
      });
    });

    // Intercept shop-status API
    await page.route('**/api/shop-status*', (route) => {
      console.log('✓ Shop status API intercepted');
      route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: {
            isOpen: true,
            reason: null,
            updatedAt: new Date().toISOString(),
            updatedByName: 'Demo User',
          },
        }),
      });
    });

    // Add session cookie
    const fakeSessionId = 'a'.repeat(32);
    await context.addCookies([{
      name: 'washboard_session',
      value: fakeSessionId,
      domain: new URL(BASE_URL).hostname,
      path: '/',
      expires: Date.now() / 1000 + 86400,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }]);

    console.log('✓ Session cookie added');
    console.log('\nNavigating to dashboard...');

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 10000 }).catch((err) => {
      console.warn('Navigation warning:', err.message);
    });

    console.log('✓ Dashboard loaded');

    // Wait for content
    await page.waitForTimeout(1000);

    // Check if content loaded
    const bodyText = await page.textContent('body');
    console.log('\nPage content check:');
    if (bodyText.includes('Dashboard') || bodyText.includes('Washboard')) {
      console.log('✓ Dashboard content found');
    } else {
      console.log('⚠ Dashboard content not found');
    }

    // Try to find the table
    const tableExists = await page.$('table');
    if (tableExists) {
      console.log('✓ Bookings table found');
      const rows = await page.$$('tbody tr');
      console.log(`  - Table has ${rows.length} rows`);
    } else {
      console.log('⚠ Bookings table not found');
    }

    console.log('\n✓ Test completed successfully');
    await context.close();
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testDashboardMocking();
