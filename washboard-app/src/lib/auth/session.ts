import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import db from '@/lib/db';

/**
 * Database-backed sessions for receptionists.
 *
 * The cookie holds only a random 256-bit session ID. Everything else lives in
 * the sessions table, so logout, password changes and user deletion take
 * effect on the next request (a signed JWT could not be revoked that way).
 * Every lookup re-reads the user row, so role and branch changes apply
 * immediately too.
 */

export interface SessionData {
  userId: number;
  branchCode: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
}

export const SESSION_COOKIE_NAME = 'washboard_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

export async function createSession(userData: SessionData): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await db.query(
    `INSERT INTO sessions (sid, sess, expire, user_id, branch_code)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, JSON.stringify(userData), expiresAt, userData.userId, userData.branchCode]
  );

  return sessionId;
}

/** Returns the stored session payload, or null if missing or expired. */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  try {
    const result = await db.query(`SELECT sess, expire FROM sessions WHERE sid = $1`, [sessionId]);
    if (result.rows.length === 0) {
      return null;
    }

    const { sess, expire } = result.rows[0];
    if (new Date(expire) < new Date()) {
      await destroySession(sessionId);
      return null;
    }

    return (typeof sess === 'string' ? JSON.parse(sess) : sess) as SessionData;
  } catch (err) {
    console.error('Error retrieving session:', err);
    return null;
  }
}

export async function updateSession(sessionId: string, userData: SessionData): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  await db.query(`UPDATE sessions SET sess = $1, expire = $2 WHERE sid = $3`, [
    JSON.stringify(userData),
    expiresAt,
    sessionId,
  ]);
}

export async function destroySession(sessionId: string): Promise<void> {
  await db.query(`DELETE FROM sessions WHERE sid = $1`, [sessionId]);
}

/**
 * Issue a fresh session ID at login and drop the old one, so a session ID
 * planted before login (session fixation) is useless afterwards.
 */
export async function regenerateSession(
  oldSessionId: string | null,
  userData: SessionData
): Promise<string> {
  if (oldSessionId) {
    await destroySession(oldSessionId);
  }
  return createSession(userData);
}

export function getSessionIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value || null;
}

/**
 * httpOnly keeps the ID away from page scripts. sameSite=lax means the cookie
 * is not sent on cross-site POSTs, which is this app's CSRF protection; it is
 * still sent on top-level GET navigations such as scanning a QR code.
 */
export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE_NAME);
}

/**
 * Resolve a session ID to the current user, re-reading the users table.
 * Used by API routes (via getCurrentUser) and by server pages, which read the
 * cookie through next/headers instead of a NextRequest.
 */
export async function getUserBySessionId(sessionId: string | null | undefined): Promise<SessionData | null> {
  if (!sessionId) {
    return null;
  }

  const sessionData = await getSession(sessionId);
  if (!sessionData) {
    return null;
  }

  try {
    const result = await db.query(
      `SELECT user_id, branch_code, username, name, email, role
       FROM users
       WHERE user_id = $1`,
      [sessionData.userId]
    );

    if (result.rows.length === 0) {
      await destroySession(sessionId);
      return null;
    }

    const user = result.rows[0];
    return {
      userId: user.user_id,
      branchCode: user.branch_code,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (err) {
    console.error('Error fetching user from database:', err);
    return null;
  }
}

export async function getCurrentUser(request: NextRequest): Promise<SessionData | null> {
  return getUserBySessionId(getSessionIdFromRequest(request));
}

/** Deletes expired sessions. Called opportunistically from the login route. */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.query(`DELETE FROM sessions WHERE expire < $1`, [new Date()]);
  return result.rowCount || 0;
}

export async function isAuthenticated(
  request: NextRequest
): Promise<{ authenticated: boolean; session: SessionData | null }> {
  const sessionData = await getCurrentUser(request);
  return sessionData
    ? { authenticated: true, session: sessionData }
    : { authenticated: false, session: null };
}

/** Receptionists may only act on their own branch. */
export function ensureBranchAccess(user: Pick<SessionData, 'branchCode'>, branchCode: string): boolean {
  return user.branchCode === branchCode.toUpperCase();
}
