import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { validateMagicLink } from '@/lib/magic-links/utils';

/**
 * POST /api/bookings/submit
 *
 * Submit a car wash booking using a magic link token.
 * Public endpoint - no authentication required (uses magic link).
 *
 * This endpoint processes customer booking submissions after they access a valid
 * magic link. The magic link provides authentication (via token validation), and
 * the booking is added to the queue for the associated branch.
 *
 * Security Features:
 * - Magic link validation ensures only authorized customers can book
 * - Single-use enforcement prevents token reuse
 * - Token must not be expired (24-hour validity)
 * - SQL injection protection via parameterized queries
 * - Input sanitization (trim whitespace)
 *
 * Workflow:
 * 1. Validate required fields and token format
 * 2. Validate magic link (exists, not expired, not used)
 * 3. Calculate queue position for the branch
 * 4. Create booking in database with status 'queued'
 * 5. Mark magic link as used (single-use enforcement)
 * 6. Return booking details to customer
 *
 * Request Body:
 * {
 *   "token": string,              // Magic link token (128 characters, required)
 *   "plate": string,               // Vehicle license plate (required)
 *   "vehicleMake": string,         // Vehicle make (required)
 *   "vehicleModel": string,        // Vehicle model (required)
 *   "customerName"?: string,       // Customer name (optional)
 *   "customerMessenger"?: string,  // Facebook Messenger handle (optional)
 *   "preferredTime"?: string,      // ISO 8601 datetime (optional)
 *   "notes"?: string               // Additional notes (optional)
 * }
 *
 * Success Response (201):
 * {
 *   "success": true,
 *   "booking": {
 *     "id": number,           // Booking ID
 *     "position": number,     // Queue position (1-indexed)
 *     "status": "queued",     // Always 'queued' for new bookings
 *     "branchCode": string    // Branch code (e.g., "MAIN")
 *   }
 * }
 *
 * Error Responses:
 * 400 - { error: string, code: "MISSING_FIELDS" } - Missing required fields
 * 400 - { error: string, code: "INVALID_TOKEN" } - Invalid token format
 * 403 - { error: string, code: string } - Invalid/expired/used magic link
 * 500 - { error: string, code: "SERVER_ERROR" } - Server error during booking
 *
 * @example
 * // Submit a booking from the customer booking form
 * const response = await fetch('/api/bookings/submit', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     token: 'aB3dE5f7...128-char-token',
 *     plate: 'ABC-1234',
 *     vehicleMake: 'Toyota',
 *     vehicleModel: 'Camry',
 *     customerName: 'John Doe',
 *     preferredTime: '2025-11-07T14:30:00Z',
 *     notes: 'Please focus on wheels'
 *   })
 * });
 *
 * if (response.ok) {
 *   const { booking } = await response.json();
 *   console.log(`Booking #${booking.id} created at position ${booking.position}`);
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body = await request.json();
    const { token, plate, vehicleMake, vehicleModel, customerName, customerMessenger, preferredTime, notes } = body;

    // 2. Validate required fields
    // Security: Reject requests missing critical data early
    if (!token || !plate || !vehicleMake || !vehicleModel) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    // 3. Validate token format
    // Security: Basic format validation to reject obviously invalid tokens
    if (typeof token !== 'string' || token.length !== 128) {
      return NextResponse.json(
        { error: 'Invalid token format', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    // 4. Validate magic link
    // Security: Ensures token exists, is not expired, and has not been used
    const validation = await validateMagicLink(token);

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid or expired link', code: validation.error || 'INVALID_TOKEN' },
        { status: 403 }
      );
    }

    const branchCode = validation.link!.branchCode;

    // 5. Start transaction for atomic booking creation
    // Transaction ensures: race-free position assignment, magic link single-use,
    // and atomic rollback on any failure
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 6. Calculate queue position with lock
      // FOR UPDATE prevents race conditions during position assignment
      // Two concurrent requests will be serialized, preventing duplicate positions
      const positionResult = await client.query(
        `SELECT COUNT(*) as count FROM bookings
         WHERE branch_code = $1 AND status IN ('queued', 'in_service')
         FOR UPDATE`,
        [branchCode]
      );

      const position = parseInt(positionResult.rows[0].count) + 1;

      // 7. Create booking
      // Security: Parameterized query prevents SQL injection
      // Data sanitization: Trim whitespace from user inputs
      const result = await client.query(
        `INSERT INTO bookings (
          branch_code, magic_link_id, plate, vehicle_make, vehicle_model,
          customer_name, customer_messenger, preferred_time, status, position, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, branch_code, position, status`,
        [
          branchCode,
          validation.link!.id,
          plate.trim(),
          vehicleMake.trim(),
          vehicleModel.trim(),
          customerName?.trim() || null,
          customerMessenger?.trim() || null,
          preferredTime || null,
          'queued',
          position,
          notes?.trim() || null
        ]
      );

      const booking = result.rows[0];

      // 8. Mark magic link as used (single-use enforcement)
      // Security: Prevents token reuse - link can only create one booking
      // Inside transaction ensures atomicity with booking creation
      await client.query(
        `UPDATE customer_magic_links
         SET used_at = NOW(), booking_id = $1
         WHERE token = $2`,
        [booking.id, token]
      );

      // 9. Commit transaction
      await client.query('COMMIT');

      // 10. Return success response
      return NextResponse.json(
        {
          success: true,
          booking: {
            id: booking.id,
            position: booking.position,
            status: booking.status,
            branchCode: booking.branch_code
          }
        },
        { status: 201 }
      );

    } catch (error: unknown) {
      // Rollback transaction on any error
      await client.query('ROLLBACK');
      throw error; // Re-throw to outer catch for consistent error handling
    } finally {
      // Always release the client connection
      client.release();
    }

  } catch (error: unknown) {
    // Security: Never log tokens or sensitive data in error messages
    console.error('Booking submission error:', error);

    // Don't expose internal error details to client
    return NextResponse.json(
      {
        error: 'An error occurred while submitting your booking',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
