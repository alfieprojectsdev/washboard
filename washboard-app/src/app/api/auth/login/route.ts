import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import db from '@/lib/db';
import { loginLimiter } from '@/lib/auth/rate-limit';
import {
  regenerateSession,
  getSessionIdFromRequest,
  setSessionCookie,
  SessionData,
} from '@/lib/auth/session';

/**
 * POST /api/auth/login
 *
 * Authenticates a receptionist user with username, password, and branch code.
 *
 * P0 Security Features:
 * - Rate limiting (5 attempts per 15 minutes)
 * - Session regeneration after successful login (prevents session fixation)
 * - Generic error messages (prevents username enumeration)
 * - bcrypt password comparison
 * - Correct index usage (branch_code, username)
 * - Database-backed session storage
 *
 * Request Body:
 * {
 *   "branch_code": string,   // Branch identifier (e.g., "MAIN")
 *   "username": string,      // Username (case-insensitive)
 *   "password": string       // Plain text password (will be compared with hash)
 * }
 *
 * Response:
 * 200 - { success: true, user: { userId, branchCode, username, name, email, role } }
 * 400 - { error: string, code: string } (missing fields)
 * 401 - { error: "Invalid credentials", code: "INVALID_CREDENTIALS" }
 * 429 - { error: string, code: "RATE_LIMIT_EXCEEDED" }
 * 500 - { error: string, code: "SERVER_ERROR" }
 */
export async function POST(request: NextRequest) {
  try {
    // P0 Security: Apply rate limiting (5 attempts per 15 minutes)
    const rateLimitResult = await loginLimiter(request);
    if (rateLimitResult) {
      return rateLimitResult; // Rate limit exceeded
    }

    const body = await request.json();
    const { branch_code, username, password } = body;

    // Validate required fields
    if (!branch_code || !username || !password) {
      return NextResponse.json(
        {
          error: 'Missing required fields: branch_code, username, password',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    // Normalize inputs
    const normalizedBranchCode = branch_code.toUpperCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    // P0 Security: Correct index order (branch_code, username)
    // Fetch user from database
    const result = await db.query(
      `SELECT user_id, branch_code, username, password_hash, name, email, role
       FROM users
       WHERE branch_code = $1 AND username = $2`,
      [normalizedBranchCode, normalizedUsername]
    );

    // P0 Security: Generic error message (prevents username enumeration)
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // P0 Security: bcrypt password comparison
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    // Prepare user session data (exclude password_hash)
    const userData: SessionData = {
      userId: user.user_id,
      branchCode: user.branch_code,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // P0 Security: Session regeneration after successful login
    // This prevents session fixation attacks by:
    // 1. Destroying any existing session
    // 2. Creating a new session with a fresh session ID
    const oldSessionId = getSessionIdFromRequest(request);
    const newSessionId = await regenerateSession(oldSessionId, userData);

    // Create response with user data
    const response = NextResponse.json(
      { success: true, user: userData },
      { status: 200 }
    );

    // Set secure session cookie (httpOnly, secure, sameSite for CSRF protection)
    setSessionCookie(response, newSessionId);

    return response;
  } catch (err: any) {
    console.error('Login error:', err);

    // Don't expose internal error details to client
    return NextResponse.json(
      {
        error: 'An error occurred during login. Please try again.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
