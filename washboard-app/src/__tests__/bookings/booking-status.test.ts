import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { GET } from '@/app/api/bookings/[id]/status/route';

const HASH = '$2b$10$abcdefghijklmnopqrstuuO3VbCmrfbHqX1bY7n6FhGZ9kqYyWf1bC';

let tokenCounter = 0;

/** Insert a booking created through a (used) magic link; returns id and token. */
async function createBooking(status: string, position: number) {
  const token = `status-test-${++tokenCounter}-`.padEnd(128, 'x');
  const user = await db.query(
    `INSERT INTO users (branch_code, username, password_hash, name)
     VALUES ('MAIN', $1, $2, 'Status Tester')
     ON CONFLICT (branch_code, username) DO UPDATE SET name = EXCLUDED.name
     RETURNING user_id`,
    ['statustester', HASH]
  );
  const link = await db.query(
    `INSERT INTO customer_magic_links (branch_code, token, expires_at, used_at, created_by)
     VALUES ('MAIN', $1, NOW() + INTERVAL '1 day', NOW(), $2) RETURNING id`,
    [token, user.rows[0].user_id]
  );
  const booking = await db.query(
    `INSERT INTO bookings (branch_code, magic_link_id, plate, vehicle_make, vehicle_model, customer_name, status, position)
     VALUES ('MAIN', $1, 'ABC123', 'Toyota', 'Camry', 'John Doe', $2, $3) RETURNING id`,
    [link.rows[0].id, status, position]
  );
  return { id: String(booking.rows[0].id), token };
}

function get(id: string, token?: string) {
  const url = new URL(`http://localhost:3000/api/bookings/${id}/status`);
  if (token) url.searchParams.set('token', token);
  return GET(new NextRequest(url), { params: Promise.resolve({ id }) });
}

describe('GET /api/bookings/:id/status', () => {
  beforeEach(async () => {
    await db.query('DELETE FROM bookings');
    await db.query('DELETE FROM customer_magic_links');
    await db.query(`UPDATE branches SET avg_service_minutes = 20 WHERE branch_code = 'MAIN'`);
  });

  it('returns position and estimated wait for a queued booking', async () => {
    const { id, token } = await createBooking('queued', 3);
    const response = await get(id, token);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ status: 'queued', position: 3, inService: false, estimatedWaitMinutes: 40 });
    expect(data.queuedAt).toBeDefined();
  });

  it('returns in_service, done and cancelled states', async () => {
    const inService = await createBooking('in_service', 1);
    expect(await (await get(inService.id, inService.token)).json()).toEqual({
      status: 'in_service',
      position: null,
      inService: true,
      estimatedWaitMinutes: 0,
    });

    const done = await createBooking('done', 2);
    expect(await (await get(done.id, done.token)).json()).toEqual({
      status: 'done',
      position: null,
      inService: false,
      completed: true,
    });

    const cancelled = await createBooking('cancelled', 3);
    expect(await (await get(cancelled.id, cancelled.token)).json()).toEqual({
      status: 'cancelled',
      position: null,
      inService: false,
      cancelled: true,
    });
  });

  it('returns 404 promptly for a booking that does not exist', async () => {
    // Regression: this used to loop forever re-querying the database.
    const started = Date.now();
    const response = await get('99999', 'x'.repeat(128));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Booking not found', code: 'BOOKING_NOT_FOUND' });
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("refuses to show another customer's booking (wrong token)", async () => {
    const mine = await createBooking('queued', 1);
    const theirs = await createBooking('queued', 2);
    const response = await get(theirs.id, mine.token);
    expect(response.status).toBe(404);
  });

  it('requires a token', async () => {
    const { id } = await createBooking('queued', 1);
    const response = await get(id);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_TOKEN');
  });

  it('returns 400 for an invalid booking ID', async () => {
    const response = await get('invalid', 'x'.repeat(128));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid booking ID format', code: 'INVALID_BOOKING_ID' });
  });

  it('uses the branch average service time', async () => {
    await db.query(`UPDATE branches SET avg_service_minutes = 15 WHERE branch_code = 'MAIN'`);
    const { id, token } = await createBooking('queued', 5);
    const data = await (await get(id, token)).json();
    expect(data.estimatedWaitMinutes).toBe(60);
  });
});
