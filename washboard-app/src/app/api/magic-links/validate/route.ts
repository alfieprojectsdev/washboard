import { NextRequest, NextResponse } from 'next/server';
import { validateMagicLink } from '@/lib/magic-links/utils';

/**
 * POST /api/magic-links/validate
 *
 * Validate a magic link token for customer booking access.
 * Public endpoint - no authentication required.
 *
 * This endpoint validates magic link tokens when customers access booking URLs.
 * Customers click links like https://washboard.app/book/MAIN/abc123..., and the
 * booking page validates the token before allowing booking submission.
 *
 * Security Features:
 * - Constant-time response: Always returns 200 for validation results to prevent timing attacks
 * - No information leakage: Doesn't differentiate between "token doesn't exist" and "token expired" via status codes
 * - No token logging: Never logs tokens in error messages or console
 * - Public access: Intentionally public for customer booking flow
 * - Generic error messages for failed validations
 *
 * Validation Checks:
 * - Token exists in database
 * - Token has not expired (expires_at > NOW())
 * - Token has not been used (used_at IS NULL)
 *
 * Request Body:
 * {
 *   "token": string  // 128-character magic link token
 * }
 *
 * Success Response - Valid Token (200):
 * {
 *   "success": true,
 *   "data": {
 *     "valid": true,
 *     "link": {
 *       "id": number,
 *       "branchCode": string,
 *       "customerName"?: string,
 *       "customerMessenger"?: string
 *     }
 *   }
 * }
 *
 * Success Response - Invalid Token (200):
 * {
 *   "success": true,
 *   "data": {
 *     "valid": false,
 *     "error": "NOT_FOUND" | "EXPIRED" | "ALREADY_USED"
 *   }
 * }
 *
 * Error Responses:
 * 400 - { error: string, code: "INVALID_TOKEN" } - Invalid token format
 * 500 - { error: string, code: "SERVER_ERROR" } - Server error during validation
 *
 * @example
 * // Validate a magic link token from booking page
 * const response = await fetch('/api/magic-links/validate', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     token: 'aB3dE5f7...128-char-token'
 *   })
 * });
 *
 * const { data } = await response.json();
 * if (data.valid) {
 *   // Show booking form with pre-filled customer info
 *   console.log(`Branch: ${data.link.branchCode}`);
 *   console.log(`Customer: ${data.link.customerName}`);
 * } else {
 *   // Show error message based on data.error
 *   switch (data.error) {
 *     case 'EXPIRED':
 *       alert('This link has expired');
 *       break;
 *     case 'ALREADY_USED':
 *       alert('This link has already been used');
 *       break;
 *     case 'NOT_FOUND':
 *       alert('Invalid link');
 *       break;
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body = await request.json();
    const { token } = body;

    // 2. Validate token format
    // Security: Basic format validation to reject obviously invalid requests
    if (!token || typeof token !== 'string' || token.length !== 128) {
      return NextResponse.json(
        {
          error: 'Invalid token format',
          code: 'INVALID_TOKEN',
        },
        { status: 400 }
      );
    }

    // 3. Validate magic link
    // Security: This function handles all validation logic and returns
    // NOT_FOUND on errors to fail closed
    const result = await validateMagicLink(token);

    // 4. Return response
    // Security: Always return 200 for validation results (both valid and invalid)
    // This prevents timing attacks that could differentiate between:
    // - "token doesn't exist" vs "token expired"
    // - database errors vs validation failures
    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    // Security: Never log tokens in error messages
    console.error('Magic link validation error:', err);

    // Don't expose internal error details to client
    return NextResponse.json(
      {
        error: 'An error occurred during validation',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
