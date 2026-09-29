import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';

/**
 * GET /api/staff (admins only)
 * Everyone with an account in the admin's branch, plus unused invites.
 */
export async function GET(request: NextRequest) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;

  const [staff, invites] = await Promise.all([
    db.query(
      `SELECT user_id, username, name, email, role, disabled_at, last_login_at, created_at
       FROM users
       WHERE branch_code = $1
       ORDER BY disabled_at IS NOT NULL, role <> 'admin', LOWER(name)`,
      [admin.branchCode]
    ),
    db.query(
      `SELECT t.id, t.note, t.role, t.expires_at, t.created_at, u.name AS created_by_name
       FROM account_tokens t
       LEFT JOIN users u ON u.user_id = t.created_by
       WHERE t.branch_code = $1 AND t.kind = 'invite' AND t.used_at IS NULL AND t.expires_at > NOW()
       ORDER BY t.created_at DESC`,
      [admin.branchCode]
    ),
  ]);

  return NextResponse.json(
    {
      staff: staff.rows.map((u) => ({
        userId: u.user_id,
        username: u.username,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.disabled_at === null,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
        isYou: u.user_id === admin.userId,
      })),
      invites: invites.rows.map((t) => ({
        id: Number(t.id),
        note: t.note,
        role: t.role,
        expiresAt: t.expires_at,
        createdAt: t.created_at,
        createdByName: t.created_by_name,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
