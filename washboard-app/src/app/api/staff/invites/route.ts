import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { createAccountToken } from '@/lib/auth/account-tokens';
import { getAppBaseUrl } from '@/lib/app-url';
import { generateQRCode } from '@/lib/magic-links/qr-code';

/**
 * POST /api/staff/invites  { note?, role? } (admins only)
 *
 * Creates a single-use invite link for the admin's branch, valid 7 days. The
 * link (and a QR code of it) is returned once; only its hash is stored, so a
 * lost link is revoked and replaced rather than shown again.
 */
export async function POST(request: NextRequest) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;

  let body: { note?: unknown; role?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is fine: an invite with no note for a receptionist.
  }
  const role = body.role === 'admin' ? 'admin' : 'receptionist';
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 100) : null;

  const invite = await createAccountToken({ kind: 'invite', branchCode: admin.branchCode, createdBy: admin.userId, role, note });
  const url = `${getAppBaseUrl(request)}/signup#invite=${invite.token}`;

  return NextResponse.json(
    { invite: { id: invite.id, url, qrCode: await generateQRCode(url), expiresAt: invite.expiresAt.toISOString(), role, note } },
    { status: 201, headers: { 'Cache-Control': 'no-store' } }
  );
}
