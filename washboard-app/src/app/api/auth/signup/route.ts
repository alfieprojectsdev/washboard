// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import db from '@/lib/db';
import { applyRateLimit, signupLimiter } from '@/lib/auth/rate-limit';
import { claimAccountToken } from '@/lib/auth/account-tokens';
import { startSession, type SessionData } from '@/lib/auth/session';
import { emailProblem, nameProblem, passwordProblem, usernameProblem } from '@/lib/auth/validation';

/**
 * POST /api/auth/signup
 *
 * Two ways in; there is no open signup (until 2026-09-26 anyone could create
 * an account for branch MAIN and read customer details).
 *
 * 1. Invite link: { invite_token, username, name, email?, password }.
 *    An admin created the link on the Staff page; it fixes the branch and
 *    role, works once and expires after 7 days.
 * 2. Owner setup: { setup_code, branch_code, username, name, email?, password }.
 *    Creates an admin account when setup_code matches OWNER_SETUP_CODE. The
 *    owner uses it once to create their own account, then deletes the
 *    variable; unset means this path is closed.
 *
 * Either way the new user is logged in straight away.
 * 201 { success, user } | 400 validation | 403 bad/used link or code | 409 username taken | 429
 */

const inviteLimiter = {
  windowMs: 60 * 60 * 1000,
  // Invite tokens are 256-bit, so this only stops floods; a shop's staff may
  // all sign up from the same Wi-Fi.
  max: 10,
  message: { error: 'Too many signup attempts. Please try again in 1 hour.', code: 'RATE_LIMIT_EXCEEDED' },
};

function setupCodeMatches(supplied: unknown): boolean {
  const expected = process.env.OWNER_SETUP_CODE;
  if (!expected || typeof supplied !== 'string') return false;
  // Hash both sides so the comparison is constant-time regardless of length.
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

const fail = (error: string, code: string, status: number) => NextResponse.json({ error, code }, { status });

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid request body', 'VALIDATION_ERROR', 400);
  }
  const { invite_token, setup_code, branch_code, username, password, name, email } = body;
  const viaInvite = typeof invite_token === 'string' && invite_token.length > 0;

  if (!viaInvite && !process.env.OWNER_SETUP_CODE) {
    return fail('Signup is by invitation. Ask the shop owner for an invite link.', 'SIGNUP_CLOSED', 403);
  }

  const limited = viaInvite
    ? await applyRateLimit(request, inviteLimiter, 'signup-invite')
    : await applyRateLimit(request, signupLimiter, 'signup');
  if (limited) return limited;

  if (!viaInvite && !setupCodeMatches(setup_code)) {
    return fail('Invalid setup code', 'INVALID_SETUP_CODE', 403);
  }

  if (!username || !password || !name || (!viaInvite && !branch_code)) {
    return fail('Missing required fields', 'VALIDATION_ERROR', 400);
  }
  const problem =
    passwordProblem(password) ?? usernameProblem(username) ?? nameProblem(name) ?? emailProblem(email);
  if (problem) {
    const code = problem.startsWith('Password') ? 'WEAK_PASSWORD'
      : problem.startsWith('Username') ? 'INVALID_USERNAME'
      : problem.startsWith('Invalid email') ? 'INVALID_EMAIL'
      : 'VALIDATION_ERROR';
    return fail(problem, code, 400);
  }

  const passwordHash = await bcrypt.hash(password as string, 12);
  const created = await createAccount({
    viaInvite,
    inviteToken: invite_token,
    branchCode: String(branch_code ?? '').toUpperCase().trim(),
    username: (username as string).toLowerCase(),
    passwordHash,
    name: (name as string).trim(),
    email: typeof email === 'string' && email ? email : null,
  });
  if ('error' in created) return created.error;

  // The transaction's connection is released by now; logging in uses the pool.
  const response = NextResponse.json(
    { success: true, user: { ...created.user, createdAt: created.createdAt } },
    { status: 201 }
  );
  await startSession(request, response, created.user);
  return response;
}

/** Claims the invite (if any) and inserts the user in one transaction. */
async function createAccount(input: {
  viaInvite: boolean;
  inviteToken: unknown;
  branchCode: string;
  username: string;
  passwordHash: string;
  name: string;
  email: string | null;
}): Promise<{ user: SessionData; createdAt: string } | { error: NextResponse }> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let branchCode = input.branchCode;
    let role: 'receptionist' | 'admin' = 'admin';
    let tokenId: number | null = null;

    if (input.viaInvite) {
      const claim = await claimAccountToken(client, 'invite', input.inviteToken);
      if (!claim) {
        await client.query('ROLLBACK');
        return { error: fail('This invite link has expired or was already used. Ask the shop owner for a new one.', 'INVALID_INVITE', 403) };
      }
      branchCode = claim.branchCode;
      role = claim.role;
      tokenId = claim.id;
    } else {
      const branch = await client.query('SELECT 1 FROM branches WHERE branch_code = $1 AND is_active = TRUE', [branchCode]);
      if (branch.rows.length === 0) {
        await client.query('ROLLBACK');
        return { error: fail('Invalid branch code', 'INVALID_BRANCH', 400) };
      }
    }

    const result = await client.query(
      `INSERT INTO users (branch_code, username, password_hash, name, email, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, branch_code, username, name, email, role, created_at`,
      [branchCode, input.username, input.passwordHash, input.name, input.email, role]
    );
    const row = result.rows[0];
    if (tokenId !== null) {
      await client.query('UPDATE account_tokens SET user_id = $1 WHERE id = $2', [row.user_id, tokenId]);
    }
    await client.query('COMMIT');

    return {
      user: {
        userId: row.user_id,
        branchCode: row.branch_code,
        username: row.username,
        name: row.name,
        email: row.email,
        role: row.role,
      },
      createdAt: row.created_at,
    };
  } catch (err: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    // A rolled-back invite stays unused, so the person can pick another username.
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return { error: fail('Username already exists in this branch', 'DUPLICATE_USERNAME', 409) };
    }
    console.error('Signup error:', err instanceof Error ? err.message : err);
    return { error: fail('Failed to create account. Please try again.', 'SERVER_ERROR', 500) };
  } finally {
    client.release();
  }
}
