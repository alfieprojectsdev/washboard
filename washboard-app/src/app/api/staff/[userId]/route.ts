import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';

const fail = (error: string, code: string, status: number) => NextResponse.json({ error, code }, { status });

/**
 * PATCH /api/staff/:userId  { role?: 'admin' | 'receptionist', active?: boolean } (admins only)
 *
 * Change someone's role, or remove / restore their access. Removing access
 * ends their sessions at once and cancels any pending reset link; the account
 * row stays because bookings and magic links refer to it.
 *
 * Rules: admins act on their own branch only; nobody changes their own role
 * or access here; a branch always keeps at least one active admin.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;

  const userId = Number.parseInt((await params).userId, 10);
  if (!Number.isInteger(userId) || userId <= 0) return fail('Staff member not found', 'NOT_FOUND', 404);
  if (userId === admin.userId) {
    return fail("You can't change your own role or access. Ask another admin.", 'SELF_CHANGE', 400);
  }

  let body: { role?: unknown; active?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail('Invalid request body', 'VALIDATION_ERROR', 400);
  }
  const role = body.role === undefined ? undefined : body.role;
  const active = body.active === undefined ? undefined : body.active;
  if (role !== undefined && role !== 'admin' && role !== 'receptionist') return fail('Invalid role', 'INVALID_ROLE', 400);
  if (active !== undefined && typeof active !== 'boolean') return fail('Invalid access value', 'VALIDATION_ERROR', 400);
  if (role === undefined && active === undefined) return fail('Nothing to change', 'NO_UPDATES', 400);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Serialise staff changes per branch, then re-check the actor: if two
    // admins remove each other at the same moment, the second request must
    // see that its own access is already gone.
    await client.query('SELECT 1 FROM branches WHERE branch_code = $1 FOR UPDATE', [admin.branchCode]);
    const actor = await client.query(
      `SELECT 1 FROM users WHERE user_id = $1 AND role = 'admin' AND disabled_at IS NULL`,
      [admin.userId]
    );
    if (actor.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail('Only the shop owner can do this', 'FORBIDDEN', 403);
    }

    const target = await client.query(
      'SELECT user_id, role, disabled_at FROM users WHERE user_id = $1 AND branch_code = $2',
      [userId, admin.branchCode]
    );
    const current = target.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return fail('Staff member not found', 'NOT_FOUND', 404);
    }

    const nextRole = (role as string | undefined) ?? current.role;
    const nextActive = (active as boolean | undefined) ?? current.disabled_at === null;
    const losesAdmin = current.role === 'admin' && current.disabled_at === null && (nextRole !== 'admin' || !nextActive);
    if (losesAdmin) {
      const others = await client.query(
        `SELECT COUNT(*) AS n FROM users
         WHERE branch_code = $1 AND role = 'admin' AND disabled_at IS NULL AND user_id <> $2`,
        [admin.branchCode, userId]
      );
      if (Number(others.rows[0].n) === 0) {
        await client.query('ROLLBACK');
        return fail('The branch needs at least one admin', 'LAST_ADMIN', 400);
      }
    }

    const result = await client.query(
      `UPDATE users
       SET role = $1,
           disabled_at = CASE WHEN $2::boolean THEN NULL ELSE COALESCE(disabled_at, NOW()) END
       WHERE user_id = $3
       RETURNING user_id, username, name, role, disabled_at`,
      [nextRole, nextActive, userId]
    );
    if (!nextActive) {
      await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
      await client.query(`DELETE FROM account_tokens WHERE kind = 'reset' AND user_id = $1 AND used_at IS NULL`, [userId]);
    }
    await client.query('COMMIT');

    const u = result.rows[0];
    return NextResponse.json({
      success: true,
      user: { userId: u.user_id, username: u.username, name: u.name, role: u.role, active: u.disabled_at === null },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Staff update error:', err instanceof Error ? err.message : err);
    return fail('Could not update this staff member', 'SERVER_ERROR', 500);
  } finally {
    client.release();
  }
}
