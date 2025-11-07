import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionIdFromRequest,
  destroySession,
  clearSessionCookie,
} from '@/lib/auth/session';

/**
 * POST /api/auth/logout
 *
 * Logs out the current user by destroying their session.
 *
 * Security Features:
 * - Destroys session in database
 * - Clears session cookie
 * - No authentication required (logout should always work)
 *
 * Response:
 * 200 - { success: true, message: "Logged out successfully" }
 * 500 - { error: string, code: "SERVER_ERROR" }
 */
export async function POST(request: NextRequest) {
  try {
    // Get session ID from cookie
    const sessionId = getSessionIdFromRequest(request);

    // Destroy session if it exists
    if (sessionId) {
      await destroySession(sessionId);
    }

    // Create response
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );

    // Clear session cookie
    clearSessionCookie(response);

    return response;
  } catch (err: any) {
    console.error('Logout error:', err);

    // Even if there's an error, we should still clear the cookie
    const response = NextResponse.json(
      {
        error: 'An error occurred during logout.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );

    clearSessionCookie(response);

    return response;
  }
}
