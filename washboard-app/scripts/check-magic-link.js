const { Pool } = require('pg');

const testToken = '4087cd23ae7845d2155525752ae3b5663597cc0515126a36d0a05a7b59d85904609dea193793ddaca2a554fc2e497be8528c785f4eddfe500ba6447ec20f4a05';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000
});

async function checkMagicLink() {
  try {
    console.log('=== CHECKING MAGIC LINK TOKEN ===');
    console.log('Token (first 50 chars):', testToken.substring(0, 50) + '...');
    console.log('Token length:', testToken.length);

    // Check if token exists
    const result = await db.query(
      `SELECT id, branch_code, customer_name, customer_messenger,
              expires_at, used_at, created_at, booking_id
       FROM customer_magic_links
       WHERE token = $1`,
      [testToken]
    );

    if (result.rows.length === 0) {
      console.log('\n❌ TOKEN NOT FOUND IN DATABASE');
      console.log('This explains the error! The magic link does not exist.');

      // Check if table exists and has any records
      const countResult = await db.query('SELECT COUNT(*) as count FROM customer_magic_links');
      console.log('\nTotal magic links in database:', countResult.rows[0].count);

      // Show recent links
      const recentLinks = await db.query(
        `SELECT id, branch_code, LEFT(token, 50) as token_start,
                LENGTH(token) as token_length, expires_at, used_at
         FROM customer_magic_links
         ORDER BY created_at DESC
         LIMIT 5`
      );

      console.log('\nRecent magic links:');
      recentLinks.rows.forEach(link => {
        console.log(`  ID ${link.id}: ${link.token_start}... (${link.token_length} chars) - Expires: ${link.expires_at}, Used: ${link.used_at || 'No'}`);
      });

    } else {
      const link = result.rows[0];
      console.log('\n✅ TOKEN FOUND');
      console.log('Link details:');
      console.log('  ID:', link.id);
      console.log('  Branch:', link.branch_code);
      console.log('  Customer Name:', link.customer_name || 'N/A');
      console.log('  Messenger:', link.customer_messenger || 'N/A');
      console.log('  Created:', link.created_at);
      console.log('  Expires:', link.expires_at);
      console.log('  Used:', link.used_at || 'No (still valid)');
      console.log('  Booking ID:', link.booking_id || 'N/A');

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(link.expires_at);
      if (expiresAt <= now) {
        console.log('\n⚠️ TOKEN IS EXPIRED');
        console.log(`  Expired ${Math.floor((now - expiresAt) / 1000 / 60 / 60)} hours ago`);
      } else {
        console.log('\n✅ TOKEN IS NOT EXPIRED');
        console.log(`  Expires in ${Math.floor((expiresAt - now) / 1000 / 60 / 60)} hours`);
      }

      // Check if already used
      if (link.used_at) {
        console.log('\n⚠️ TOKEN ALREADY USED');
        console.log(`  Used at: ${link.used_at}`);
        console.log(`  Booking ID: ${link.booking_id}`);
      } else {
        console.log('\n✅ TOKEN NOT YET USED');
      }
    }

    await db.end();
  } catch (err) {
    console.error('\n❌ DATABASE ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

checkMagicLink();
