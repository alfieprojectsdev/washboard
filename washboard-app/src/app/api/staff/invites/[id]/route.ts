import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';

/** DELETE /api/staff/invites/:id (admins only): revoke an unused invite in the admin's branch. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;

  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invite not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const result = await db.query(
    `DELETE FROM account_tokens
     WHERE id = $1 AND branch_code = $2 AND kind = 'invite' AND used_at IS NULL
     RETURNING id`,
    [id, admin.branchCode]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Invite not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
