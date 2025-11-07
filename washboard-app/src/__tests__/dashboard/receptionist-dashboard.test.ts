/**
 * Receptionist Dashboard Test Suite - Phase 5
 *
 * Tests for receptionist dashboard functionality:
 * - GET /api/bookings (list bookings with filters)
 * - PATCH /api/bookings/[id] (update booking status/position)
 * - GET/POST /api/shop-status (manage shop open/closed state)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { GET as getBookings } from '@/app/api/bookings/route';
import { PATCH as updateBooking } from '@/app/api/bookings/[id]/route';
import { GET as getShopStatus, POST as updateShopStatus } from '@/app/api/shop-status/route';
import bcrypt from 'bcrypt';
import { setSessionCookie } from '@/lib/auth/session';

describe('Phase 5: Receptionist Dashboard', () => {
  let testUserId: number;
  let testSessionId: string;
  let testBookingId: number;

  beforeEach(async () => {
    await db.query('DELETE FROM bookings');
    await db.query('DELETE FROM customer_magic_links');
    await db.query('DELETE FROM sessions');
    await db.query('DELETE FROM shop_status'); // Delete before users due to FK constraint
    await db.query('DELETE FROM users');

    // Create test user
    const passwordHash = await bcrypt.hash('password123', 10);
    const userResult = await db.query(
      `INSERT INTO users (branch_code, username, password_hash, name, role)
       VALUES ('MAIN', 'receptionist1', $1, 'Test Receptionist', 'receptionist')
       RETURNING user_id`,
      [passwordHash]
    );
    testUserId = userResult.rows[0].user_id;

    // Create test session
    testSessionId = 'test-session-' + Date.now();
    await db.query(
      `INSERT INTO sessions (sid, sess, expire, user_id, branch_code)
       VALUES ($1, $2, NOW() + INTERVAL '1 day', $3, 'MAIN')`,
      [
        testSessionId,
        JSON.stringify({ userId: testUserId, branchCode: 'MAIN' }),
        testUserId,
      ]
    );

    // Create test bookings
    const bookingResult = await db.query(
      `INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
       VALUES ('MAIN', 'ABC-123', 'Toyota', 'Vios', 'queued', 1)
       RETURNING id`,
      []
    );
    testBookingId = bookingResult.rows[0].id;

    await db.query(
      `INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
       VALUES ('MAIN', 'DEF-456', 'Honda', 'Civic', 'in_service', 2)`,
      []
    );

    await db.query(
      `INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
       VALUES ('MAIN', 'GHI-789', 'Mitsubishi', 'Mirage', 'done', 3)`,
      []
    );
  });

  afterEach(async () => {
    await db.query('DELETE FROM bookings');
    await db.query('DELETE FROM customer_magic_links');
    await db.query('DELETE FROM sessions');
    await db.query('DELETE FROM shop_status'); // Delete before users due to FK constraint
    await db.query('DELETE FROM users');
  });

  describe('GET /api/bookings', () => {
    it('should require authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'GET',
      });

      const response = await getBookings(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('NOT_AUTHENTICATED');
    });

    it('should return all bookings when authenticated', async () => {
      const request = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'GET',
        headers: {
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await getBookings(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.bookings).toHaveLength(3);
    });

    it('should filter bookings by status', async () => {
      const request = new NextRequest('http://localhost:3000/api/bookings?status=queued', {
        method: 'GET',
        headers: {
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await getBookings(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bookings).toHaveLength(1);
      expect(data.bookings[0].status).toBe('queued');
      expect(data.bookings[0].plate).toBe('ABC-123');
    });

    it('should calculate estimated wait times for queued bookings', async () => {
      // Add more queued bookings
      await db.query(
        `INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
         VALUES ('MAIN', 'XYZ-999', 'Ford', 'Focus', 'queued', 4)`,
        []
      );

      const request = new NextRequest('http://localhost:3000/api/bookings?status=queued', {
        method: 'GET',
        headers: {
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await getBookings(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bookings).toHaveLength(2);

      // First in queue (position 1) should have 0 wait time
      const firstBooking = data.bookings.find((b: any) => b.position === 1);
      expect(firstBooking.estimatedWaitMinutes).toBe(0);

      // Second in queue (position 4) should have (4-1) * 20 = 60 minutes
      const secondBooking = data.bookings.find((b: any) => b.position === 4);
      expect(secondBooking.estimatedWaitMinutes).toBe(60);
    });

    it('should reject invalid status parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/bookings?status=invalid', {
        method: 'GET',
        headers: {
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await getBookings(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_STATUS');
    });

    it('should return pagination metadata', async () => {
      const request = new NextRequest('http://localhost:3000/api/bookings?limit=2', {
        method: 'GET',
        headers: {
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await getBookings(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.hasMore).toBe(true);
    });
  });

  describe('PATCH /api/bookings/[id]', () => {
    it('should require authentication', async () => {
      const request = new NextRequest(`http://localhost:3000/api/bookings/${testBookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_service' }),
      });

      const response = await updateBooking(request, {
        params: Promise.resolve({ id: testBookingId.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('NOT_AUTHENTICATED');
    });

    it('should update booking status from queued to in_service', async () => {
      const request = new NextRequest(`http://localhost:3000/api/bookings/${testBookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_service' }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateBooking(request, {
        params: Promise.resolve({ id: testBookingId.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.booking.status).toBe('in_service');

      // Verify in database
      const dbResult = await db.query('SELECT status FROM bookings WHERE id = $1', [testBookingId]);
      expect(dbResult.rows[0].status).toBe('in_service');
    });

    it('should update booking status from in_service to done', async () => {
      // First, set booking to in_service
      await db.query('UPDATE bookings SET status = $1 WHERE id = $2', ['in_service', testBookingId]);

      const request = new NextRequest(`http://localhost:3000/api/bookings/${testBookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateBooking(request, {
        params: Promise.resolve({ id: testBookingId.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.booking.status).toBe('done');
    });

    it('should require cancellation reason when cancelling', async () => {
      const request = new NextRequest(`http://localhost:3000/api/bookings/${testBookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateBooking(request, {
        params: Promise.resolve({ id: testBookingId.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('MISSING_CANCEL_REASON');
    });

    it('should cancel booking with reason', async () => {
      const request = new NextRequest(`http://localhost:3000/api/bookings/${testBookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'cancelled',
          cancelledReason: 'Power outage',
        }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateBooking(request, {
        params: Promise.resolve({ id: testBookingId.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.booking.status).toBe('cancelled');
      expect(data.booking.cancelledReason).toBe('Power outage');
      expect(data.booking.cancelledBy).toBe(testUserId);
      expect(data.booking.cancelledAt).toBeDefined();
    });

    it('should reject invalid booking ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/bookings/999999', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateBooking(request, {
        params: Promise.resolve({ id: '999999' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('NOT_FOUND');
    });

    it('should reject invalid status value', async () => {
      const request = new NextRequest(`http://localhost:3000/api/bookings/${testBookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'invalid_status' }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateBooking(request, {
        params: Promise.resolve({ id: testBookingId.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_STATUS');
    });

    it('should update booking position and reorder queue', async () => {
      // Create bookings in order: position 1, 2, 3
      await db.query('DELETE FROM bookings');
      const booking1 = await db.query(
        `INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
         VALUES ('MAIN', 'A', 'Toyota', 'Vios', 'queued', 1) RETURNING id`,
        []
      );
      const booking2 = await db.query(
        `INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
         VALUES ('MAIN', 'B', 'Honda', 'Civic', 'queued', 2) RETURNING id`,
        []
      );
      const booking3 = await db.query(
        `INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
         VALUES ('MAIN', 'C', 'Mitsubishi', 'Mirage', 'queued', 3) RETURNING id`,
        []
      );

      const booking2Id = booking2.rows[0].id;

      // Move booking 2 (position 2) to position 1
      const request = new NextRequest(`http://localhost:3000/api/bookings/${booking2Id}`, {
        method: 'PATCH',
        body: JSON.stringify({ position: 1 }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateBooking(request, {
        params: Promise.resolve({ id: booking2Id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.booking.position).toBe(1);

      // Verify positions in database
      const result = await db.query(
        'SELECT id, position FROM bookings WHERE branch_code = $1 ORDER BY position',
        ['MAIN']
      );

      // B should now be position 1, A should be moved to position 2, C remains at 3
      expect(result.rows[0].id).toBe(booking2.rows[0].id);
      expect(result.rows[0].position).toBe(1);
      expect(result.rows[1].id).toBe(booking1.rows[0].id);
      expect(result.rows[1].position).toBe(2);
      expect(result.rows[2].id).toBe(booking3.rows[0].id);
      expect(result.rows[2].position).toBe(3);
    });
  });

  describe('GET /api/shop-status', () => {
    it('should be public (no authentication required)', async () => {
      const request = new NextRequest('http://localhost:3000/api/shop-status', {
        method: 'GET',
      });

      const response = await getShopStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBeDefined();
    });

    it('should return default open status if not set', async () => {
      await db.query('DELETE FROM shop_status');

      const request = new NextRequest('http://localhost:3000/api/shop-status', {
        method: 'GET',
      });

      const response = await getShopStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status.isOpen).toBe(true);
      expect(data.status.reason).toBe(null);
    });

    it('should return current shop status', async () => {
      // Set shop status to closed (delete first for pg-mem compatibility)
      await db.query('DELETE FROM shop_status WHERE branch_code = $1', ['MAIN']);
      await db.query(
        `INSERT INTO shop_status (branch_code, is_open, reason, updated_by)
         VALUES ('MAIN', false, 'Under maintenance', $1)`,
        [testUserId]
      );

      const request = new NextRequest('http://localhost:3000/api/shop-status', {
        method: 'GET',
      });

      const response = await getShopStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status.isOpen).toBe(false);
      expect(data.status.reason).toBe('Under maintenance');
    });
  });

  describe('POST /api/shop-status', () => {
    beforeEach(async () => {
      // Ensure shop_status row exists for MAIN branch
      await db.query('DELETE FROM shop_status WHERE branch_code = $1', ['MAIN']);
    });

    it('should require authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/shop-status', {
        method: 'POST',
        body: JSON.stringify({ isOpen: false, reason: 'Test' }),
      });

      const response = await updateShopStatus(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('NOT_AUTHENTICATED');
    });

    it('should close shop with reason', async () => {
      const request = new NextRequest('http://localhost:3000/api/shop-status', {
        method: 'POST',
        body: JSON.stringify({ isOpen: false, reason: 'Power outage' }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateShopStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status.isOpen).toBe(false);
      expect(data.status.reason).toBe('Power outage');

      // Verify in database
      const dbResult = await db.query(
        'SELECT is_open, reason FROM shop_status WHERE branch_code = $1',
        ['MAIN']
      );
      expect(dbResult.rows[0].is_open).toBe(false);
      expect(dbResult.rows[0].reason).toBe('Power outage');
    });

    it('should reopen shop (clears reason)', async () => {
      // First close the shop using the API
      await updateShopStatus(
        new NextRequest('http://localhost:3000/api/shop-status', {
          method: 'POST',
          body: JSON.stringify({ isOpen: false, reason: 'Maintenance' }),
          headers: {
            'content-type': 'application/json',
            cookie: `washboard_session=${testSessionId}`,
          },
        })
      );

      // Now reopen it
      const request = new NextRequest('http://localhost:3000/api/shop-status', {
        method: 'POST',
        body: JSON.stringify({ isOpen: true }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateShopStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status.isOpen).toBe(true);
      expect(data.status.reason).toBe(null);
    });

    it('should require reason when closing shop', async () => {
      const request = new NextRequest('http://localhost:3000/api/shop-status', {
        method: 'POST',
        body: JSON.stringify({ isOpen: false }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateShopStatus(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('MISSING_REASON');
    });

    it('should validate isOpen is boolean', async () => {
      const request = new NextRequest('http://localhost:3000/api/shop-status', {
        method: 'POST',
        body: JSON.stringify({ isOpen: 'yes', reason: 'Test' }),
        headers: {
          'content-type': 'application/json',
          cookie: `washboard_session=${testSessionId}`,
        },
      });

      const response = await updateShopStatus(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_IS_OPEN');
    });
  });
});
