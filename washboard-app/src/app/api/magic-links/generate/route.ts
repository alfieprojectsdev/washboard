import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ensureBranchAccess } from '@/lib/auth/middleware';
import { generateMagicLink } from '@/lib/magic-links/utils';
import { generateQRCode, QR_SIZE_NORMAL } from '@/lib/magic-links/qr-code';

/**
 * POST /api/magic-links/generate
 *
 * Generate a magic link with QR code for customer booking access.
 * Requires receptionist authentication.
 *
 * This endpoint allows authenticated receptionists to create magic links
 * for walk-in customers. Each link is:
 * - Single-use (marked as used after booking creation)
 * - Time-limited (expires after 24 hours)
 * - Branch-specific (tied to receptionist's branch)
 * - Optionally trackable with customer info
 *
 * Security Features:
 * - Authentication required via session
 * - Branch access validation (receptionists can only create links for their branch)
 * - Cryptographically secure token generation (128 characters)
 * - Generic error messages (prevents information disclosure)
 *
 * Request Body:
 * {
 *   "branchCode": string,           // Required - Branch identifier (e.g., "MAIN")
 *   "customerName"?: string,        // Optional - Customer name for tracking
 *   "customerMessenger"?: string,   // Optional - Messenger handle (e.g., "m.me/username")
 *   "qrSize"?: number              // Optional - QR size in pixels (default: 300)
 * }
 *
 * Success Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "link": {
 *       "id": number,
 *       "token": string,
 *       "url": string,              // Full magic link URL
 *       "expiresAt": string        // ISO 8601 timestamp
 *     },
 *     "qrCode": string              // Base64 data URL (data:image/png;base64,...)
 *   }
 * }
 *
 * Error Responses:
 * 400 - { error: string, code: "MISSING_FIELDS" | "INVALID_MESSENGER" }
 * 401 - { error: string, code: "UNAUTHORIZED" }
 * 403 - { error: string, code: "INVALID_BRANCH" }
 * 500 - { error: string, code: "SERVER_ERROR" }
 *
 * @example
 * // Create magic link for walk-in customer
 * const response = await fetch('/api/magic-links/generate', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     branchCode: 'MAIN',
 *     customerName: 'John Doe',
 *     customerMessenger: 'm.me/johndoe'
 *   })
 * });
 *
 * @example
 * // Create magic link with custom QR size
 * const response = await fetch('/api/magic-links/generate', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     branchCode: 'MAIN',
 *     qrSize: 500  // Fullscreen size
 *   })
 * });
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication - Verify user is logged in
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const { branchCode, customerName, customerMessenger, qrSize } = body;

    // Validate required fields
    if (!branchCode || typeof branchCode !== 'string' || branchCode.trim() === '') {
      return NextResponse.json(
        {
          error: 'Missing required field: branchCode',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    // Normalize branch code
    const normalizedBranchCode = branchCode.toUpperCase().trim();

    // 3. Branch access validation - Ensure user can only access their branch
    if (!ensureBranchAccess(user, normalizedBranchCode)) {
      return NextResponse.json(
        {
          error: 'Cannot access data from different branch',
          code: 'INVALID_BRANCH',
        },
        { status: 403 }
      );
    }

    // 4. Optional: Validate Messenger format if provided
    // Basic validation - check if it's a valid string
    if (customerMessenger && typeof customerMessenger !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid customerMessenger format',
          code: 'INVALID_MESSENGER',
        },
        { status: 400 }
      );
    }

    // 5. Generate base URL from request headers (production-aware)
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // 6. Generate magic link
    const link = await generateMagicLink({
      branchCode: normalizedBranchCode,
      customerName: customerName || undefined,
      customerMessenger: customerMessenger || undefined,
      createdBy: user.userId,
      baseUrl,
    });

    // 7. Generate QR code
    const qrCode = await generateQRCode(link.url, {
      size: qrSize || QR_SIZE_NORMAL,
    });

    // 8. Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          link: {
            id: link.id,
            token: link.token,
            url: link.url,
            expiresAt: link.expiresAt.toISOString(),
          },
          qrCode,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Magic link generation error:', err);

    // Security: Don't expose internal error details to client
    // Never log tokens or sensitive information
    return NextResponse.json(
      {
        error: 'An error occurred while generating the magic link. Please try again.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
