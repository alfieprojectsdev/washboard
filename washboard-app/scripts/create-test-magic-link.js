const { Pool } = require('pg');
const crypto = require('crypto');

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000
});

function generateSecureToken() {
  return crypto.randomBytes(64).toString('hex');
}

async function createTestMagicLink() {
  try {
    console.log('=== CREATING TEST MAGIC LINK ===\n');

    // Generate token
    const token = generateSecureToken();
    console.log('Generated token (first 50 chars):', token.substring(0, 50) + '...');
    console.log('Token length:', token.length);

    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Insert into database
    // created_by = 1 (assuming user ID 1 exists - receptionist)
    const result = await db.query(
      `INSERT INTO customer_magic_links
       (branch_code, token, customer_name, customer_messenger, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, branch_code, token, expires_at`,
      [
        'MAIN',
        token,
        'Playwright Test Customer',
        'm.me/playwrighttest',
        expiresAt,
        1 // created_by (receptionist user ID)
      ]
    );

    const link = result.rows[0];
    console.log('\n✅ Magic link created:');
    console.log(`  - ID: ${link.id}`);
    console.log(`  - Branch: ${link.branch_code}`);
    console.log(`  - Expires: ${link.expires_at}`);

    const url = `https://washboard.ithinkandicode.space/book/${link.branch_code}/${link.token}`;
    console.log(`\n📎 Full URL:\n${url}`);

    console.log(`\n✏️ Update Playwright test with this token:\n${link.token}`);

    await db.end();
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

createTestMagicLink();
