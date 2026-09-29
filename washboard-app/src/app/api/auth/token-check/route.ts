import { NextRequest, NextResponse } from 'next/server';
import { peekAccountToken, type TokenKind } from '@/lib/auth/account-tokens';

/**
 * POST /api/auth/token-check  { kind: 'invite' | 'reset', token }
 *
 * Lets the signup and reset pages say who the link is for before asking for
 * a password. Does not use the link up. The token comes in the body because
 * the pages keep it in the URL fragment, which never reaches the server.
 *
 * 200 { valid: true, branchName, role, note?, username?, name? } | { valid: false }
 */
export async function POST(request: NextRequest) {
  let body: { kind?: unknown; token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  if (body.kind !== 'invite' && body.kind !== 'reset') {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const details = await peekAccountToken(body.kind as TokenKind, body.token);
  if (!details) return NextResponse.json({ valid: false }, { headers: { 'Cache-Control': 'no-store' } });

  return NextResponse.json(
    {
      valid: true,
      branchName: details.branchName,
      role: details.role,
      note: body.kind === 'invite' ? details.note : undefined,
      username: body.kind === 'reset' ? details.username : undefined,
      name: body.kind === 'reset' ? details.name : undefined,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
