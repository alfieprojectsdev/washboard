import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcrypt';
import db from '@/lib/db';
import { applyRateLimit } from '@/lib/auth/rate-limit';
import { getCurrentUser, getSessionIdFromRequest } from '@/lib/auth/session';
import { passwordProblem } from '@/lib/auth/validation';

const changeLimiter = {
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Please try again in 15 minutes.', code: 'RATE_LIMIT_EXCEEDED' },
};

/**
 * POST /api/auth/change-password  { currentPassword, newPassword }
 *
 * For any logged-in user. Other devices are signed out; this one stays in.
 * 200 { success } | 400 wrong current / weak new password | 401 | 429
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' }, { status: 401 });

  const limited = await applyRateLimit(request, changeLimiter, `change-password:${user.userId}`);
  if (limited) return limited;

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const problem = passwordProblem(body.newPassword);
  if (problem) return NextResponse.json({ error: problem, code: 'WEAK_PASSWORD' }, { status: 400 });

  const current = await db.query('SELECT password_hash FROM users WHERE user_id = $1', [user.userId]);
  const valid =
    typeof body.currentPassword === 'string' &&
    current.rows[0] &&
    (await bcrypt.compare(body.currentPassword, current.rows[0].password_hash));
  if (!valid) {
    return NextResponse.json({ error: 'Current password is not correct', code: 'WRONG_PASSWORD' }, { status: 400 });
  }

  await db.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [
    await bcrypt.hash(body.newPassword as string, 12),
    user.userId,
  ]);
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND sid <> $2', [user.userId, getSessionIdFromRequest(request)]);

  return NextResponse.json({ success: true });
}
