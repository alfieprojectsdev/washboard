const { Pool } = require('pg');

const testToken = '4087cd23ae7845d2155525752ae3b5663597cc0515126a36d0a05a7b59d85904609dea193793ddaca2a554fc2e497be8528c785f4eddfe500ba6447ec20f4a05';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000
});

async function testBookingInsertion() {
  const client = await db.connect();

  try {
    console.log('=== SIMULATING BOOKING SUBMISSION ===\n');

    // Step 1: Validate magic link
    console.log('Step 1: Validating magic link...');
    const validation = await client.query(
      `SELECT id, branch_code, customer_name, customer_messenger, expires_at, used_at
       FROM customer_magic_links
       WHERE token = $1`,
      [testToken]
    );

    if (validation.rows.length === 0) {
      console.log('❌ Magic link not found');
      return;
    }

    const link = validation.rows[0];
    console.log('✅ Magic link found:');
    console.log(`  - ID: ${link.id}`);
    console.log(`  - Branch: ${link.branch_code}`);
    console.log(`  - Used: ${link.used_at || 'No'}`);

    if (link.used_at) {
      console.log('❌ Magic link already used');
      return;
    }

    const branchCode = link.branch_code;

    // Step 2: Check shop status
    console.log('\nStep 2: Checking shop status...');
    const shopStatusResult = await client.query(
      'SELECT is_open, reason FROM shop_status WHERE branch_code = $1',
      [branchCode]
    );

    if (shopStatusResult.rows.length === 0) {
      console.log(`❌ No shop_status found for branch ${branchCode}`);
      return;
    }

    const shopStatus = shopStatusResult.rows[0];
    console.log(`✅ Shop status found: is_open=${shopStatus.is_open}`);

    if (!shopStatus.is_open) {
      console.log('❌ Shop is closed');
      return;
    }

    // Step 3: Start transaction
    console.log('\nStep 3: Starting transaction...');
    await client.query('BEGIN');
    console.log('✅ Transaction started');

    // Step 4: Calculate queue position (with proper locking)
    console.log('\nStep 4: Locking existing bookings...');
    await client.query(
      `SELECT id FROM bookings
       WHERE branch_code = $1 AND status IN ('queued', 'in_service')
       FOR UPDATE`,
      [branchCode]
    );
    console.log('✅ Rows locked');

    console.log('\nStep 4b: Calculating queue position...');
    const positionResult = await client.query(
      `SELECT COUNT(*) as count FROM bookings
       WHERE branch_code = $1 AND status IN ('queued', 'in_service')`,
      [branchCode]
    );

    const position = parseInt(positionResult.rows[0].count) + 1;
    console.log(`✅ Position calculated: ${position}`);

    // Step 5: Insert booking
    console.log('\nStep 5: Inserting booking...');
    const plate = 'TEST9999';
    const vehicleMake = 'Honda';
    const vehicleModel = 'Civic';
    const customerName = link.customer_name;
    const customerMessenger = link.customer_messenger;

    console.log(`  - Plate: ${plate}`);
    console.log(`  - Vehicle: ${vehicleMake} ${vehicleModel}`);
    console.log(`  - Customer: ${customerName || 'N/A'}`);
    console.log(`  - Messenger: ${customerMessenger || 'N/A'}`);

    const result = await client.query(
      `INSERT INTO bookings (
        branch_code, magic_link_id, plate, vehicle_make, vehicle_model,
        customer_name, customer_messenger, preferred_time, status, position, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, branch_code, position, status`,
      [
        branchCode,
        link.id,
        plate.trim(),
        vehicleMake.trim(),
        vehicleModel.trim(),
        customerName?.trim() || null,
        customerMessenger?.trim() || null,
        null, // preferred_time
        'queued',
        position,
        null // notes
      ]
    );

    const booking = result.rows[0];
    console.log(`✅ Booking created: ID=${booking.id}, Position=${booking.position}`);

    // Step 6: Mark magic link as used
    console.log('\nStep 6: Marking magic link as used...');
    await client.query(
      `UPDATE customer_magic_links
       SET used_at = NOW(), booking_id = $1
       WHERE token = $2`,
      [booking.id, testToken]
    );
    console.log('✅ Magic link marked as used');

    // Step 7: Commit transaction
    console.log('\nStep 7: Committing transaction...');
    await client.query('COMMIT');
    console.log('✅ Transaction committed');

    console.log('\n=== ✅✅✅ BOOKING SUBMISSION SUCCESSFUL! ===');
    console.log(`Booking ID: ${booking.id}`);
    console.log(`Position: ${booking.position}`);

  } catch (error) {
    console.error('\n❌ ERROR OCCURRED:', error.message);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error hint:', error.hint);
    console.error('\nFull stack:');
    console.error(error.stack);

    // Rollback
    try {
      await client.query('ROLLBACK');
      console.log('\n✅ Transaction rolled back');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError.message);
    }
  } finally {
    client.release();
    await db.end();
  }
}

testBookingInsertion();
