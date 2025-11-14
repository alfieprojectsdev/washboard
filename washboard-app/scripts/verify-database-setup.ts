#!/usr/bin/env ts-node
/**
 * Database Setup Verification and Repair Script
 *
 * This script verifies that the production database has all required tables
 * and initial data. It's idempotent and safe to run multiple times.
 *
 * Usage:
 *   ts-node scripts/verify-database-setup.ts
 *
 * Or from package.json:
 *   npm run db:verify
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const db = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

async function verifyAndRepair() {
  console.log('🔍 Starting database verification...\n');

  let issuesFound = 0;
  let issuesFixed = 0;

  try {
    // 1. Check if branches table exists and has MAIN row
    console.log('1️⃣  Checking branches table...');
    const branchesCheck = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'branches'
      ) as exists`
    );

    if (!branchesCheck.rows[0].exists) {
      console.log('   ❌ branches table does not exist!');
      console.log('   ⚠️  You need to run the full schema.sql file first');
      issuesFound++;
    } else {
      console.log('   ✅ branches table exists');

      // Check for MAIN branch
      const mainBranch = await db.query(
        'SELECT * FROM branches WHERE branch_code = $1',
        ['MAIN']
      );

      if (mainBranch.rows.length === 0) {
        console.log('   ⚠️  MAIN branch not found, inserting...');
        await db.query(
          `INSERT INTO branches (branch_code, branch_name, location, avg_service_minutes)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (branch_code) DO NOTHING`,
          ['MAIN', 'Main Branch', 'Primary Location', 20]
        );
        console.log('   ✅ MAIN branch inserted');
        issuesFixed++;
      } else {
        console.log('   ✅ MAIN branch exists');
      }
    }

    // 2. Check if shop_status table exists and has MAIN row
    console.log('\n2️⃣  Checking shop_status table...');
    const shopStatusTableCheck = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'shop_status'
      ) as exists`
    );

    if (!shopStatusTableCheck.rows[0].exists) {
      console.log('   ❌ shop_status table does not exist!');
      console.log('   ⚠️  You need to run the full schema.sql file first');
      issuesFound++;
    } else {
      console.log('   ✅ shop_status table exists');

      // Check for MAIN shop status
      const mainShopStatus = await db.query(
        'SELECT * FROM shop_status WHERE branch_code = $1',
        ['MAIN']
      );

      if (mainShopStatus.rows.length === 0) {
        console.log('   ⚠️  MAIN shop status not found, inserting...');
        await db.query(
          `INSERT INTO shop_status (branch_code, is_open, reason)
           VALUES ($1, $2, $3)
           ON CONFLICT (branch_code) DO NOTHING`,
          ['MAIN', true, null]
        );
        console.log('   ✅ MAIN shop status inserted (shop is OPEN)');
        issuesFixed++;
      } else {
        const status = mainShopStatus.rows[0];
        console.log(`   ✅ MAIN shop status exists (is_open: ${status.is_open})`);
      }
    }

    // 3. Check other critical tables
    console.log('\n3️⃣  Checking other critical tables...');
    const requiredTables = [
      'users',
      'customer_magic_links',
      'bookings',
      'sessions',
      'rate_limits'
    ];

    for (const tableName of requiredTables) {
      const tableCheck = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        ) as exists`,
        [tableName]
      );

      if (!tableCheck.rows[0].exists) {
        console.log(`   ❌ ${tableName} table does not exist!`);
        issuesFound++;
      } else {
        console.log(`   ✅ ${tableName} table exists`);
      }
    }

    // 4. Summary
    console.log('\n📊 Verification Summary:');
    console.log(`   Issues found: ${issuesFound}`);
    console.log(`   Issues fixed: ${issuesFixed}`);

    if (issuesFound === 0 && issuesFixed === 0) {
      console.log('\n✅ Database is properly configured!');
      process.exit(0);
    } else if (issuesFound > 0) {
      console.log('\n❌ Database has missing tables. Please run schema.sql first:');
      console.log('   psql $DATABASE_URL < src/lib/schema.sql');
      process.exit(1);
    } else {
      console.log('\n✅ Database issues have been fixed!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run the verification
verifyAndRepair().catch(console.error);
