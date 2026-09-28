import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as submitBooking } from '@/app/api/bookings/submit/route';
import { PATCH as updateBooking } from '@/app/api/bookings/[id]/route';
import { POST as generateLink } from '@/app/api/magic-links/generate/route';
import { POST as sendFeedback } from '@/app/api/feedback/route';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { clearRateLimitStore } from '@/lib/auth/rate-limit';
import { redactPath } from '@/lib/feedback';

/**
 * Regression tests for the 2026-09-26 production-readiness fixes.
 */

const HASH = '$2b$10$abcdefghijklmnopqrstuuO3VbCmrfbHqX1bY7n6FhGZ9kqYyWf1bC';

function json(url: string, body: unknown, init: { method?: string; cookie?: string; ip?: string } = {}) {
  return new NextRequest(url, {
    method: init.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': init.ip ?? '203.0.113.7',
      ...(init.cookie ? { cookie: `${SESSION_COOKIE_NAME}=${init.cookie}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

let userId: number;
let sessionId: string;
let linkCounter = 0;

async function makeLink(): Promise<string> {
  const token = `hardening-${++linkCounter}-`.padEnd(128, 'z');
  await db.query(
    `INSERT INTO customer_magic_links (branch_code, token, expires_at, created_by)
     VALUES ('MAIN', $1, NOW() + INTERVAL '1 day', $2)`,
    [token, userId]
  );
  return token;
}

function book(token: string, plate: string) {
  return submitBooking(
    json('http://localhost/api/bookings/submit', { token, plate, vehicleMake: 'Toyota', vehicleModel: 'Vios' })
  );
}

async function positions(): Promise<Record<string, number>> {
  const result = await db.query(
    `SELECT plate, position FROM bookings WHERE branch_code = 'MAIN' AND status IN ('queued','in_service') ORDER BY position`
  );
  return Object.fromEntries(result.rows.map((r: { plate: string; position: number }) => [r.plate, r.position]));
}

function patch(id: string, body: unknown) {
  return updateBooking(json(`http://localhost/api/bookings/${id}`, body, { method: 'PATCH', cookie: sessionId }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(async () => {
  await db.query('DELETE FROM feedback');
  await db.query('DELETE FROM bookings');
  await db.query('DELETE FROM customer_magic_links');
  await db.query('DELETE FROM sessions');
  await db.query(`DELETE FROM users WHERE username IN ('hardening', 'invited')`);
  await db.query(`UPDATE shop_status SET is_open = TRUE, reason = NULL WHERE branch_code = 'MAIN'`);
  await clearRateLimitStore();

  const user = await db.query(
    `INSERT INTO users (branch_code, username, password_hash, name) VALUES ('MAIN', 'hardening', $1, 'Hardening Tester')
     RETURNING user_id`,
    [HASH]
  );
  userId = user.rows[0].user_id;
  sessionId = await createSession({
    userId,
    branchCode: 'MAIN',
    username: 'hardening',
    name: 'Hardening Tester',
    email: null,
    role: 'receptionist',
  });
});

describe('invite-only signup', () => {
  const body = {
    branch_code: 'MAIN',
    username: 'invited',
    password: 'a-long-enough-password',
    name: 'New Receptionist',
  };
  const original = process.env.SIGNUP_INVITE_CODE;
  afterEach(() => {
    process.env.SIGNUP_INVITE_CODE = original;
  });

  it('is closed when SIGNUP_INVITE_CODE is not set', async () => {
    delete process.env.SIGNUP_INVITE_CODE;
    const response = await signup(json('http://localhost/api/auth/signup', { ...body, invite_code: 'anything' }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('SIGNUP_CLOSED');
  });

  it('rejects a wrong or missing invite code', async () => {
    const wrong = await signup(json('http://localhost/api/auth/signup', { ...body, invite_code: 'guess' }));
    expect(wrong.status).toBe(403);
    expect((await wrong.json()).code).toBe('INVALID_INVITE');

    const missing = await signup(json('http://localhost/api/auth/signup', body));
    expect(missing.status).toBe(403);

    const created = await db.query(`SELECT 1 FROM users WHERE username = 'invited'`);
    expect(created.rows).toHaveLength(0);
  });

  it('creates the account with the right code', async () => {
    const response = await signup(
      json('http://localhost/api/auth/signup', { ...body, invite_code: process.env.SIGNUP_INVITE_CODE })
    );
    expect(response.status).toBe(201);
  });
});

describe('magic link single use', () => {
  it('lets exactly one of two simultaneous submits through', async () => {
    const token = await makeLink();
    const [a, b] = await Promise.all([book(token, 'RACE-1'), book(token, 'RACE-2')]);

    expect([a.status, b.status].sort()).toEqual([201, 403]);
    const count = await db.query(`SELECT COUNT(*) AS n FROM bookings`);
    expect(Number(count.rows[0].n)).toBe(1);
  });

  it('does not burn the link when the shop is closed', async () => {
    const token = await makeLink();
    await db.query(`UPDATE shop_status SET is_open = FALSE, reason = 'Power outage' WHERE branch_code = 'MAIN'`);
    expect((await book(token, 'CLOSED-1')).status).toBe(403);

    await db.query(`UPDATE shop_status SET is_open = TRUE, reason = NULL WHERE branch_code = 'MAIN'`);
    expect((await book(token, 'CLOSED-1')).status).toBe(201);
  });
});

describe('queue positions', () => {
  it('gives simultaneous bookings on an empty queue distinct positions', async () => {
    const [t1, t2] = [await makeLink(), await makeLink()];
    await Promise.all([book(t1, 'P-1'), book(t2, 'P-2')]);
    expect(Object.values(await positions()).sort()).toEqual([1, 2]);
  });

  it('closes the gap when a car leaves the queue, and new cars go to the back', async () => {
    const ids: Record<string, string> = {};
    for (const plate of ['A', 'B', 'C']) {
      const response = await book(await makeLink(), plate);
      ids[plate] = String((await response.json()).booking.id);
    }
    expect(await positions()).toEqual({ A: 1, B: 2, C: 3 });

    expect((await patch(ids.A, { status: 'in_service' })).status).toBe(200);
    expect((await patch(ids.A, { status: 'done' })).status).toBe(200);
    expect(await positions()).toEqual({ B: 1, C: 2 });

    // Before the fix this booking got COUNT(active) + 1 = 3 while C also held 3.
    await book(await makeLink(), 'D');
    expect(await positions()).toEqual({ B: 1, C: 2, D: 3 });

    expect((await patch(ids.B, { status: 'cancelled', cancelledReason: 'Customer left' })).status).toBe(200);
    expect(await positions()).toEqual({ C: 1, D: 2 });

    // Re-queueing a finished booking puts it at the back.
    expect((await patch(ids.A, { status: 'queued' })).status).toBe(200);
    expect(await positions()).toEqual({ C: 1, D: 2, A: 3 });

    // Moving past the end clamps to the last place.
    expect((await patch(ids.C, { position: 99 })).status).toBe(200);
    expect(await positions()).toEqual({ D: 1, A: 2, C: 3 });
  });
});

describe('magic link generation', () => {
  it('returns 400, not a database error, for a malformed Messenger handle', async () => {
    const response = await generateLink(
      json('http://localhost/api/magic-links/generate', { branchCode: 'MAIN', customerMessenger: 'not a link' }, { cookie: sessionId })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_MESSENGER');
  });

  it('builds links from NEXT_PUBLIC_APP_URL when it is set', async () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://wash.example.com/';
    try {
      const response = await generateLink(
        json('http://evil.example/api/magic-links/generate', { branchCode: 'MAIN' }, { cookie: sessionId })
      );
      const data = await response.json();
      expect(data.data.link.url.startsWith('https://wash.example.com/book/MAIN/')).toBe(true);
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = original;
    }
  });
});

describe('feedback', () => {
  it('stores feedback and links it to the logged-in receptionist', async () => {
    const response = await sendFeedback(
      json('http://localhost/api/feedback', { kind: 'idea', message: '  Add a print button  ', page: '/dashboard' }, { cookie: sessionId })
    );
    expect(response.status).toBe(201);

    const rows = await db.query(`SELECT kind, message, page, user_id FROM feedback`);
    expect(rows.rows).toEqual([{ kind: 'idea', message: 'Add a print button', page: '/dashboard', user_id: userId }]);
  });

  it('never stores a booking token from the page path', async () => {
    const token = 'q'.repeat(128);
    await sendFeedback(json('http://localhost/api/feedback', { message: 'Form broke', page: `/book/MAIN/${token}?x=1` }));
    const rows = await db.query(`SELECT page FROM feedback`);
    expect(rows.rows[0].page).toBe('/book/MAIN/[link]');
    expect(redactPath('/dashboard?tab=done')).toBe('/dashboard');
  });

  it('rejects empty messages and silently drops honeypot submissions', async () => {
    expect((await sendFeedback(json('http://localhost/api/feedback', { message: '   ' }))).status).toBe(400);

    const bot = await sendFeedback(json('http://localhost/api/feedback', { message: 'buy now', website: 'spam.example' }));
    expect(bot.status).toBe(201);
    const rows = await db.query(`SELECT 1 FROM feedback`);
    expect(rows.rows).toHaveLength(0);
  });

  it('rate-limits a single IP to 5 messages an hour', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await sendFeedback(json('http://localhost/api/feedback', { message: `m${i}` }, { ip: '198.51.100.9' }))).status).toBe(201);
    }
    expect((await sendFeedback(json('http://localhost/api/feedback', { message: 'm6' }, { ip: '198.51.100.9' }))).status).toBe(429);
  });
});
