import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { POST as submitBookingHandler } from '@/app/api/bookings/submit/route';
import { generateMagicLink } from '@/lib/magic-links/utils';

/**
 * Booking Flow Test Suite
 *
 * Tests the customer booking submission flow:
 * - POST /api/bookings/submit (public endpoint using magic link token)
 *
 * Tests cover:
 * - Valid booking creation with magic link
 * - Queue position calculation
 * - Magic link single-use enforcement
 * - Field validation (required and optional)
 * - Error handling (invalid/expired/used tokens)
 *
 * All tests use pg-mem (mock database) via USE_MOCK_DB=true
 */

describe('Customer Booking Flow', () => {
  let testBranchCode: string;
  let testUserId: number;
  let validMagicLinkToken: string;
  let expiredMagicLinkToken: string;
  let usedMagicLinkToken: string;

  beforeAll(async () => {
    // 1. Create TEST branch
    testBranchCode = 'TEST';
    await db.query(
      `INSERT INTO branches (branch_code, branch_name, location)
       VALUES ($1, $2, $3)
       ON CONFLICT (branch_code) DO NOTHING
       RETURNING branch_code`,
      [testBranchCode, 'Test Branch', '123 Test St']
    );

    // 2. Create test user (receptionist) for magic link creation
    const userResult = await db.query(
      `INSERT INTO users (branch_code, username, password_hash, name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (branch_code, username) DO UPDATE SET name = $4
       RETURNING user_id`,
      [testBranchCode, 'testrecept', 'hash', 'Test Receptionist', 'receptionist']
    );
    testUserId = userResult.rows[0].user_id;

    // 3. Create valid magic link
    const validLink = await generateMagicLink({
      branchCode: testBranchCode,
      customerName: 'Valid Customer',
      createdBy: testUserId
    });
    validMagicLinkToken = validLink.token;

    // 4. Create expired magic link (set expires_at to past)
    const expiredTokenResult = await db.query(
      `INSERT INTO customer_magic_links (branch_code, token, expires_at, created_by)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour', $3)
       RETURNING token`,
      [
        testBranchCode,
        'a'.repeat(128), // 128 character token
        testUserId
      ]
    );
    expiredMagicLinkToken = expiredTokenResult.rows[0].token;

    // 5. Create already-used magic link
    const usedTokenResult = await db.query(
      `INSERT INTO customer_magic_links (branch_code, token, expires_at, created_by, used_at, booking_id)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours', $3, NOW(), 999)
       RETURNING token`,
      [
        testBranchCode,
        'b'.repeat(128), // 128 character token
        testUserId
      ]
    );
    usedMagicLinkToken = usedTokenResult.rows[0].token;
  });

  afterEach(async () => {
    // Clean up bookings created during tests
    await db.query(
      `DELETE FROM bookings WHERE branch_code = $1`,
      [testBranchCode]
    );

    // Reset magic links (except the ones marked as used in setup)
    await db.query(
      `UPDATE customer_magic_links
       SET used_at = NULL, booking_id = NULL
       WHERE branch_code = $1 AND token = $2`,
      [testBranchCode, validMagicLinkToken]
    );
  });

  describe('POST /api/bookings/submit', () => {
    describe('Success Cases', () => {
      it('should create booking with valid magic link token', async () => {
        const requestBody = {
          token: validMagicLinkToken,
          plate: 'ABC-1234',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry',
          customerName: 'John Doe',
          customerMessenger: 'john.doe',
          preferredTime: '2025-11-07T14:30:00Z',
          notes: 'Please focus on wheels'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'content-type': 'application/json',
          },
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.booking).toBeDefined();
        expect(data.booking.id).toBeDefined();
        expect(data.booking.position).toBe(1); // First booking
        expect(data.booking.status).toBe('queued');
        expect(data.booking.branchCode).toBe(testBranchCode);

        // Verify booking was created in database
        const bookingCheck = await db.query(
          `SELECT id, plate, vehicle_make, vehicle_model, customer_name,
                  customer_messenger, preferred_time, notes, status, position
           FROM bookings WHERE id = $1`,
          [data.booking.id]
        );

        expect(bookingCheck.rows.length).toBe(1);
        const booking = bookingCheck.rows[0];
        expect(booking.plate).toBe('ABC-1234');
        expect(booking.vehicle_make).toBe('Toyota');
        expect(booking.vehicle_model).toBe('Camry');
        expect(booking.customer_name).toBe('John Doe');
        expect(booking.customer_messenger).toBe('john.doe');
        expect(booking.notes).toBe('Please focus on wheels');
        expect(booking.status).toBe('queued');
        expect(booking.position).toBe(1);
      });

      it('should calculate correct queue position with existing bookings', async () => {
        // Create 2 queued bookings and 1 in_service booking
        await db.query(
          `INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
           VALUES
             ($1, 'TEST-001', 'Honda', 'Civic', 'queued', 1),
             ($1, 'TEST-002', 'Ford', 'Focus', 'queued', 2),
             ($1, 'TEST-003', 'BMW', 'X5', 'in_service', 3)`,
          [testBranchCode]
        );

        const requestBody = {
          token: validMagicLinkToken,
          plate: 'NEW-001',
          vehicleMake: 'Tesla',
          vehicleModel: 'Model 3'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.booking.position).toBe(4); // 2 queued + 1 in_service + 1 = 4
      });

      it('should mark magic link as used after booking creation', async () => {
        const requestBody = {
          token: validMagicLinkToken,
          plate: 'ABC-1234',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);

        // Verify magic link is marked as used
        const linkCheck = await db.query(
          `SELECT used_at, booking_id FROM customer_magic_links WHERE token = $1`,
          [validMagicLinkToken]
        );

        expect(linkCheck.rows[0].used_at).not.toBeNull();
        expect(linkCheck.rows[0].booking_id).toBe(data.booking.id);
      });

      it('should handle optional fields correctly', async () => {
        // Test with only required fields
        const requestBody = {
          token: validMagicLinkToken,
          plate: 'MIN-0001',
          vehicleMake: 'Mazda',
          vehicleModel: 'CX-5'
          // No optional fields
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);

        // Verify optional fields are null in database
        const bookingCheck = await db.query(
          `SELECT customer_name, customer_messenger, preferred_time, notes
           FROM bookings WHERE id = $1`,
          [data.booking.id]
        );

        const booking = bookingCheck.rows[0];
        expect(booking.customer_name).toBeNull();
        expect(booking.customer_messenger).toBeNull();
        expect(booking.preferred_time).toBeNull();
        expect(booking.notes).toBeNull();
      });

      it('should set status to queued for new bookings', async () => {
        const requestBody = {
          token: validMagicLinkToken,
          plate: 'STS-0001',
          vehicleMake: 'Subaru',
          vehicleModel: 'Outback'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.booking.status).toBe('queued');

        // Verify in database
        const bookingCheck = await db.query(
          `SELECT status FROM bookings WHERE id = $1`,
          [data.booking.id]
        );

        expect(bookingCheck.rows[0].status).toBe('queued');
      });

      it('should return 201 with correct response structure', async () => {
        const requestBody = {
          token: validMagicLinkToken,
          plate: 'RES-0001',
          vehicleMake: 'Nissan',
          vehicleModel: 'Altima'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('booking');
        expect(data.booking).toHaveProperty('id');
        expect(data.booking).toHaveProperty('position');
        expect(data.booking).toHaveProperty('status');
        expect(data.booking).toHaveProperty('branchCode');

        // Should not expose internal fields
        expect(data.booking).not.toHaveProperty('magic_link_id');
        expect(data.booking).not.toHaveProperty('created_at');
      });
    });

    describe('Validation Errors', () => {
      it('should reject submission with missing token', async () => {
        const requestBody = {
          // Missing token
          plate: 'ABC-1234',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBeDefined();
        expect(data.code).toBe('MISSING_FIELDS');
      });

      it('should reject submission with missing plate', async () => {
        const requestBody = {
          token: validMagicLinkToken,
          // Missing plate
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('MISSING_FIELDS');
      });

      it('should reject submission with missing vehicleMake', async () => {
        const requestBody = {
          token: validMagicLinkToken,
          plate: 'ABC-1234',
          // Missing vehicleMake
          vehicleModel: 'Camry'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('MISSING_FIELDS');
      });

      it('should reject submission with missing vehicleModel', async () => {
        const requestBody = {
          token: validMagicLinkToken,
          plate: 'ABC-1234',
          vehicleMake: 'Toyota'
          // Missing vehicleModel
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('MISSING_FIELDS');
      });

      it('should reject submission with invalid token format (too short)', async () => {
        const requestBody = {
          token: 'short-token',
          plate: 'ABC-1234',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('INVALID_TOKEN');
      });

      it('should reject submission with invalid token format (not string)', async () => {
        const requestBody = {
          token: 12345, // Number instead of string
          plate: 'ABC-1234',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('INVALID_TOKEN');
      });
    });

    describe('Magic Link Errors', () => {
      it('should reject submission with expired magic link', async () => {
        const requestBody = {
          token: expiredMagicLinkToken,
          plate: 'EXP-0001',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBeDefined();
        expect(data.code).toBe('EXPIRED');
      });

      it('should reject submission with already-used magic link', async () => {
        const requestBody = {
          token: usedMagicLinkToken,
          plate: 'USD-0001',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBeDefined();
        expect(data.code).toBe('ALREADY_USED');
      });

      it('should reject submission with non-existent magic link', async () => {
        const requestBody = {
          token: 'z'.repeat(128), // Valid format but doesn't exist
          plate: 'NXS-0001',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBeDefined();
        expect(data.code).toBe('NOT_FOUND');
      });
    });

    describe('Edge Cases and Data Handling', () => {
      it('should trim whitespace from vehicle data', async () => {
        const requestBody = {
          token: validMagicLinkToken,
          plate: '  ABC-1234  ',
          vehicleMake: '  Toyota  ',
          vehicleModel: '  Camry  ',
          customerName: '  John Doe  ',
          notes: '  Test notes  '
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);

        // Verify data was trimmed in database
        const bookingCheck = await db.query(
          `SELECT plate, vehicle_make, vehicle_model, customer_name, notes
           FROM bookings WHERE id = $1`,
          [data.booking.id]
        );

        const booking = bookingCheck.rows[0];
        expect(booking.plate).toBe('ABC-1234');
        expect(booking.vehicle_make).toBe('Toyota');
        expect(booking.vehicle_model).toBe('Camry');
        expect(booking.customer_name).toBe('John Doe');
        expect(booking.notes).toBe('Test notes');
      });

      it('should handle queue position calculation with completed bookings', async () => {
        // Create bookings with various statuses
        await db.query(
          `INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
           VALUES
             ($1, 'CMP-001', 'Honda', 'Civic', 'done', 1),
             ($1, 'CMP-002', 'Ford', 'Focus', 'cancelled', 2),
             ($1, 'QUE-001', 'BMW', 'X5', 'queued', 3)`,
          [testBranchCode]
        );

        const requestBody = {
          token: validMagicLinkToken,
          plate: 'NEW-001',
          vehicleMake: 'Tesla',
          vehicleModel: 'Model 3'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        // Should only count queued bookings: 1 queued + 1 new = 2
        expect(data.booking.position).toBe(2);
      });

      it('should handle queue position when no existing bookings', async () => {
        // Ensure no bookings exist
        await db.query(`DELETE FROM bookings WHERE branch_code = $1`, [testBranchCode]);

        const requestBody = {
          token: validMagicLinkToken,
          plate: 'FIRST-01',
          vehicleMake: 'Audi',
          vehicleModel: 'A4'
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.booking.position).toBe(1); // First booking should be position 1
      });

      it('should handle ISO 8601 datetime for preferredTime', async () => {
        const preferredTime = '2025-11-07T14:30:00Z';
        const requestBody = {
          token: validMagicLinkToken,
          plate: 'TIME-001',
          vehicleMake: 'Mercedes',
          vehicleModel: 'C-Class',
          preferredTime
        };

        const request = new NextRequest('http://localhost:3000/api/bookings/submit', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await submitBookingHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);

        // Verify preferredTime was stored correctly
        const bookingCheck = await db.query(
          `SELECT preferred_time FROM bookings WHERE id = $1`,
          [data.booking.id]
        );

        expect(bookingCheck.rows[0].preferred_time).toBeDefined();
      });
    });
  });
});
