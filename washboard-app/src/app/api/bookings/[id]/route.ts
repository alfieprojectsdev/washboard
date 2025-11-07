import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAuthenticated } from '@/lib/auth/session';

/**
 * PATCH /api/bookings/[id]
 *
 * Update a booking's status, position, or cancellation details.
 * Authenticated endpoint - requires valid session.
 *
 * Request Body:
 * - status?: 'queued' | 'in_service' | 'done' | 'cancelled'
 * - position?: number (for reordering queue)
 * - cancelledReason?: string (required when status = 'cancelled')
 * - notes?: string
 *
 * Business Rules:
 * - Only receptionist can update bookings
 * - Position must be positive integer
 * - Cancelled status requires a reason
 * - Position changes trigger reordering of other bookings
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await db.connect();

  try {
    // 1. Check authentication
    const authResult = await isAuthenticated(request);
    if (!authResult.authenticated || !authResult.session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'NOT_AUTHENTICATED' },
        { status: 401 }
      );
    }

    const { userId, branchCode } = authResult.session;

    // 2. Parse parameters
    const { id } = await params;
    const bookingId = parseInt(id);

    if (isNaN(bookingId)) {
      return NextResponse.json(
        { error: 'Invalid booking ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { status, position, cancelledReason, notes } = body;

    // 4. Validate status
    const validStatuses = ['queued', 'in_service', 'done', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // 5. Validate cancelled status requires reason
    if (status === 'cancelled' && !cancelledReason) {
      return NextResponse.json(
        {
          error: 'Cancellation reason required',
          code: 'MISSING_CANCEL_REASON',
        },
        { status: 400 }
      );
    }

    // 6. Validate position
    if (position !== undefined && (position < 1 || !Number.isInteger(position))) {
      return NextResponse.json(
        { error: 'Position must be positive integer', code: 'INVALID_POSITION' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // 7. Fetch existing booking and verify access
    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Booking not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const booking = bookingResult.rows[0];

    // 8. Security: Verify booking belongs to user's branch
    if (booking.branch_code !== branchCode) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Access denied', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 9. Handle position change (reordering)
    if (position !== undefined && position !== booking.position) {
      const oldPosition = booking.position;
      const newPosition = position;

      // Reorder other bookings
      if (newPosition < oldPosition) {
        // Moving up: shift bookings between newPosition and oldPosition down
        await client.query(
          `UPDATE bookings
           SET position = position + 1
           WHERE branch_code = $1
             AND status IN ('queued', 'in_service')
             AND position >= $2
             AND position < $3
             AND id != $4`,
          [branchCode, newPosition, oldPosition, bookingId]
        );
      } else {
        // Moving down: shift bookings between oldPosition and newPosition up
        await client.query(
          `UPDATE bookings
           SET position = position - 1
           WHERE branch_code = $1
             AND status IN ('queued', 'in_service')
             AND position > $2
             AND position <= $3
             AND id != $4`,
          [branchCode, oldPosition, newPosition, bookingId]
        );
      }
    }

    // 10. Build update query
    const updates: string[] = [];
    const updateParams: any[] = [];
    let paramCount = 0;

    if (status !== undefined) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      updateParams.push(status);
    }

    if (position !== undefined) {
      paramCount++;
      updates.push(`position = $${paramCount}`);
      updateParams.push(position);
    }

    if (notes !== undefined) {
      paramCount++;
      updates.push(`notes = $${paramCount}`);
      updateParams.push(notes);
    }

    // Handle cancellation
    if (status === 'cancelled') {
      paramCount++;
      updates.push(`cancelled_reason = $${paramCount}`);
      updateParams.push(cancelledReason);

      paramCount++;
      updates.push(`cancelled_by = $${paramCount}`);
      updateParams.push(userId);

      updates.push(`cancelled_at = NOW()`);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'No fields to update', code: 'NO_UPDATES' },
        { status: 400 }
      );
    }

    // 11. Execute update
    updateParams.push(bookingId);
    const updateQuery = `
      UPDATE bookings
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await client.query(updateQuery, updateParams);
    const updatedBooking = result.rows[0];

    await client.query('COMMIT');

    // 12. Return updated booking
    return NextResponse.json(
      {
        success: true,
        booking: {
          id: updatedBooking.id,
          branchCode: updatedBooking.branch_code,
          plate: updatedBooking.plate,
          vehicleMake: updatedBooking.vehicle_make,
          vehicleModel: updatedBooking.vehicle_model,
          customerName: updatedBooking.customer_name,
          customerMessenger: updatedBooking.customer_messenger,
          preferredTime: updatedBooking.preferred_time,
          status: updatedBooking.status,
          position: updatedBooking.position,
          cancelledReason: updatedBooking.cancelled_reason,
          cancelledBy: updatedBooking.cancelled_by,
          cancelledAt: updatedBooking.cancelled_at,
          notes: updatedBooking.notes,
          createdAt: updatedBooking.created_at,
          updatedAt: updatedBooking.updated_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[API] PATCH /api/bookings/[id] error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while updating booking',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
