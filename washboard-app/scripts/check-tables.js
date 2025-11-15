const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000
});

async function checkTables() {
  try {
    console.log('=== CHECKING DATABASE TABLES ===\n');

    // List all tables
    const tables = await db.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('Tables in database:');
    tables.rows.forEach(row => console.log(`  - ${row.tablename}`));

    // Check bookings table schema
    console.log('\n=== bookings TABLE SCHEMA ===');
    const bookingsSchema = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position
    `);

    if (bookingsSchema.rows.length === 0) {
      console.log('❌ bookings table DOES NOT EXIST!');
    } else {
      bookingsSchema.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
      });
    }

    // Check customer_magic_links table schema
    console.log('\n=== customer_magic_links TABLE SCHEMA ===');
    const magicLinksSchema = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'customer_magic_links'
      ORDER BY ordinal_position
    `);

    if (magicLinksSchema.rows.length === 0) {
      console.log('❌ customer_magic_links table DOES NOT EXIST!');
    } else {
      magicLinksSchema.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
      });
    }

    // Check shop_status table
    console.log('\n=== shop_status TABLE ===');
    const shopStatus = await db.query(`
      SELECT branch_code, is_open, reason, updated_at
      FROM shop_status
      ORDER BY branch_code
    `);

    if (shopStatus.rows.length === 0) {
      console.log('❌ No shop_status records found!');
    } else {
      shopStatus.rows.forEach(row => {
        console.log(`  ${row.branch_code}: is_open=${row.is_open}, reason=${row.reason || 'N/A'}, updated=${row.updated_at}`);
      });
    }

    await db.end();
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

checkTables();
