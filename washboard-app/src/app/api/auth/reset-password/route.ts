import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcrypt';
import db from '@/lib/db';
import { applyRateLimit } from '@/lib/auth/rate-limit';
import { claimAccountToken } from '@/lib/auth/account-tokens';
import { startSession, type SessionData } from '@/lib/auth/session';
import { passwordProblem } from '@/lib/auth/validation';

const resetLimiter = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again in 15 minutes.', code: 'RATE_LIMIT_EXCEEDED' },
};

/**
 * POST /api/auth/reset-password  { token, password }
 *
 * Sets a new password from a single-use reset link that an admin created on
 * the Staff page (valid 24 hours). Every existing session for that account
 * is ended, then the person is logged in with the new password.
 *
 * 200 { success, user } | 400 weak password | 403 bad/used/expired link | 429
 */
export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, resetLimiter, 'reset-password');
  if (limited) return limited;

  let body: { token?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'VALIDATION_ERROR' }, { status: 400 });
  }
  const problem = passwordProblem(body.password);
  if (problem) return NextResponse.json({ error: problem, code: 'WEAK_PASSWORD' }, { status: 400 });

  const passwordHash = await bcrypt.hash(body.password as string, 12);
  let user: SessionData | null = null;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const claim = await claimAccountToken(client, 'reset', body.token);
    if (claim?.userId) {
      const result = await client.query(
        `UPDATE users SET password_hash = $1 WHERE user_id = $2 AND disabled_at IS NULL
         RETURNING user_id, branch_code, username, name, email, role`,
        [passwordHash, claim.userId]
      );
      const row = result.rows[0];
      if (row) {
        await client.query('DELETE FROM sessions WHERE user_id = $1', [row.user_id]);
        user = {
          userId: row.user_id,
          branchCode: row.branch_code,
          username: row.username,
          name: row.name,
          email: row.email,
          role: row.role,
        };
      }
    }
    await client.query(user ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Password reset error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not reset the password. Please try again.', code: 'SERVER_ERROR' }, { status: 500 });
  } finally {
    client.release();
  }

  if (!user) {
    return NextResponse.json(
      { error: 'This reset link has expired or was already used. Ask the shop owner for a new one.', code: 'INVALID_TOKEN' },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true, user });
  await startSession(request, response, user);
  return response;
}
