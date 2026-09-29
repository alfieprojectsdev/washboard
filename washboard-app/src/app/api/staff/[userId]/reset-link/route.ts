import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { createAccountToken } from '@/lib/auth/account-tokens';
import { getAppBaseUrl } from '@/lib/app-url';

/**
 * POST /api/staff/:userId/reset-link (admins only)
 *
 * Creates a single-use password reset link for an active staff member in the
 * admin's branch, valid 24 hours, and cancels any earlier unused one. The
 * admin sends it (e.g. on Messenger); they never see or choose the password.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;

  const userId = Number.parseInt((await params).userId, 10);
  const target = Number.isInteger(userId)
    ? await db.query(
        'SELECT user_id, name FROM users WHERE user_id = $1 AND branch_code = $2 AND disabled_at IS NULL',
        [userId, admin.branchCode]
      )
    : { rows: [] };
  if (target.rows.length === 0) {
    return NextResponse.json({ error: 'Staff member not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  await db.query(`DELETE FROM account_tokens WHERE kind = 'reset' AND user_id = $1 AND used_at IS NULL`, [userId]);
  const reset = await createAccountToken({ kind: 'reset', branchCode: admin.branchCode, createdBy: admin.userId, userId });

  return NextResponse.json(
    {
      resetLink: {
        url: `${getAppBaseUrl(request)}/reset-password#token=${reset.token}`,
        expiresAt: reset.expiresAt.toISOString(),
        name: target.rows[0].name,
      },
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } }
  );
}
