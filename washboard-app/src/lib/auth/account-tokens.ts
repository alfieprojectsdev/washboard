import { createHash, randomBytes } from 'crypto';
import type { PoolClient } from 'pg';
import db from '@/lib/db';

/**
 * Single-use account links (invites and password resets).
 *
 * The token travels in the URL fragment (#invite=... / #token=...), which the
 * browser never sends to the server or to analytics; the page posts it back
 * in a request body. Only its SHA-256 is stored, so a database leak does not
 * hand out working links. A link is claimed with one conditional UPDATE
 * inside the caller's transaction, so it cannot be used twice.
 */

export type TokenKind = 'invite' | 'reset';

export const TOKEN_LIFETIME_MS: Record<TokenKind, number> = {
  invite: 7 * 24 * 60 * 60 * 1000,
  reset: 24 * 60 * 60 * 1000,
};

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createAccountToken(options: {
  kind: TokenKind;
  branchCode: string;
  createdBy: number;
  userId?: number;
  role?: 'receptionist' | 'admin';
  note?: string | null;
}): Promise<{ id: number; token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS[options.kind]);
  const result = await db.query(
    `INSERT INTO account_tokens (kind, token_hash, branch_code, user_id, role, note, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      options.kind,
      hashToken(token),
      options.branchCode,
      options.userId ?? null,
      options.role ?? 'receptionist',
      options.note ?? null,
      options.createdBy,
      expiresAt,
    ]
  );
  return { id: Number(result.rows[0].id), token, expiresAt };
}

export interface TokenDetails {
  id: number;
  branchCode: string;
  branchName: string;
  role: 'receptionist' | 'admin';
  note: string | null;
  userId: number | null;
  username: string | null;
  name: string | null;
}

/** Look up a usable (unused, unexpired) token without consuming it. */
export async function peekAccountToken(kind: TokenKind, token: unknown): Promise<TokenDetails | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const result = await db.query(
    `SELECT t.id, t.branch_code, b.branch_name, t.role, t.note, t.user_id, u.username, u.name
     FROM account_tokens t
     JOIN branches b ON b.branch_code = t.branch_code
     LEFT JOIN users u ON u.user_id = t.user_id
     WHERE t.token_hash = $1 AND t.kind = $2 AND t.used_at IS NULL AND t.expires_at > NOW()
       AND (t.kind = 'invite' OR u.disabled_at IS NULL)`,
    [hashToken(token), kind]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    branchCode: row.branch_code,
    branchName: row.branch_name,
    role: row.role,
    note: row.note,
    userId: row.user_id,
    username: row.username,
    name: row.name,
  };
}

/**
 * Mark a token used and return what it grants. Call inside BEGIN ... COMMIT
 * on `client`; a rollback un-uses it. Returns null if it is unknown,
 * expired, already used, or (for resets) its account has been removed.
 */
export async function claimAccountToken(
  client: PoolClient,
  kind: TokenKind,
  token: unknown
): Promise<{ id: number; branchCode: string; role: 'receptionist' | 'admin'; userId: number | null } | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const result = await client.query(
    `UPDATE account_tokens t SET used_at = NOW()
     WHERE t.token_hash = $1 AND t.kind = $2 AND t.used_at IS NULL AND t.expires_at > NOW()
       AND (t.kind = 'invite' OR EXISTS (
         SELECT 1 FROM users u WHERE u.user_id = t.user_id AND u.disabled_at IS NULL))
     RETURNING t.id, t.branch_code, t.role, t.user_id`,
    [hashToken(token), kind]
  );
  const row = result.rows[0];
  return row ? { id: Number(row.id), branchCode: row.branch_code, role: row.role, userId: row.user_id } : null;
}
