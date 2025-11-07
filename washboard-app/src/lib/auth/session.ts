import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import db from '@/lib/db';

/**
 * Session Management for Next.js App Router
 *
 * Implements session storage in PostgreSQL with the following P0 security features:
 * - Session regeneration (prevents session fixation)
 * - Secure cookie handling (httpOnly, secure, sameSite)
 * - Session expiration (24 hours)
 * - Database-backed session storage (survives server restarts)
 */

export interface SessionData {
  userId: number;
  branchCode: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
}

const SESSION_COOKIE_NAME = 'washboard_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Generate a cryptographically secure session ID
 */
function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a new session for a user
 * Stores session in database and returns session ID
 *
 * P0 Security: This implements session regeneration by creating a fresh session
 */
export async function createSession(userData: SessionData): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  // Store session in database
  await db.query(
    `INSERT INTO sessions (sid, sess, expire, user_id, branch_code)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      sessionId,
      JSON.stringify(userData),
      expiresAt,
      userData.userId,
      userData.branchCode,
    ]
  );

  return sessionId;
}

/**
 * Retrieve session data from database
 * Returns null if session doesn't exist or has expired
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  try {
    const result = await db.query(
      `SELECT sess, expire FROM sessions WHERE sid = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const { sess, expire } = result.rows[0];

    // Check if session has expired
    if (new Date(expire) < new Date()) {
      // Clean up expired session
      await destroySession(sessionId);
      return null;
    }

    // Handle both string (real PostgreSQL) and object (pg-mem)
    return (typeof sess === 'string' ? JSON.parse(sess) : sess) as SessionData;
  } catch (err) {
    console.error('Error retrieving session:', err);
    return null;
  }
}

/**
 * Update session data in database
 * Extends session expiration time
 */
export async function updateSession(
  sessionId: string,
  userData: SessionData
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await db.query(
    `UPDATE sessions
     SET sess = $1, expire = $2
     WHERE sid = $3`,
    [JSON.stringify(userData), expiresAt, sessionId]
  );
}

/**
 * Delete session from database
 */
export async function destroySession(sessionId: string): Promise<void> {
  await db.query(`DELETE FROM sessions WHERE sid = $1`, [sessionId]);
}

/**
 * P0 Security: Regenerate session after login
 *
 * This prevents session fixation attacks by:
 * 1. Destroying the old session (if it exists)
 * 2. Creating a new session with a fresh session ID
 * 3. Transferring user data to the new session
 */
export async function regenerateSession(
  oldSessionId: string | null,
  userData: SessionData
): Promise<string> {
  // Destroy old session if it exists
  if (oldSessionId) {
    await destroySession(oldSessionId);
  }

  // Create new session with fresh ID
  const newSessionId = await createSession(userData);

  return newSessionId;
}

/**
 * Extract session ID from request cookies
 */
export function getSessionIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value || null;
}

/**
 * Set session cookie on response
 *
 * P0 Security Features:
 * - httpOnly: Prevents JavaScript access (XSS protection)
 * - secure: Only sent over HTTPS in production
 * - sameSite: 'strict' prevents CSRF attacks
 */
export function setSessionCookie(
  response: NextResponse,
  sessionId: string
): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION / 1000, // Convert to seconds
    path: '/',
  });
}

/**
 * Clear session cookie (for logout)
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE_NAME);
}

/**
 * Get current user from session
 * Re-fetches user from database to prevent stale data (P0 security)
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<SessionData | null> {
  const sessionId = getSessionIdFromRequest(request);

  if (!sessionId) {
    return null;
  }

  const sessionData = await getSession(sessionId);

  if (!sessionData) {
    return null;
  }

  // P0 Security: Re-fetch user from database to ensure data is fresh
  // This prevents issues with stale sessions after user updates/deletions
  try {
    const result = await db.query(
      `SELECT user_id, branch_code, username, name, email, role
       FROM users
       WHERE user_id = $1`,
      [sessionData.userId]
    );

    if (result.rows.length === 0) {
      // User no longer exists - destroy session
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

/**
 * Clean up expired sessions from database
 * This should be run periodically (e.g., via cron job or on startup)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.query(
    `DELETE FROM sessions WHERE expire < $1`,
    [new Date()]
  );
  return result.rowCount || 0;
}

/**
 * Check if request is authenticated
 * Returns authentication status and session data
 */
export async function isAuthenticated(
  request: NextRequest
): Promise<{ authenticated: boolean; session: SessionData | null }> {
  const sessionData = await getCurrentUser(request);

  if (!sessionData) {
    return { authenticated: false, session: null };
  }

  return { authenticated: true, session: sessionData };
}
