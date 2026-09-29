import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAuthenticated } from '@/lib/auth/session';
import { ACTIVE_STATUSES, lockBranchQueue } from '@/lib/bookings/queue';

/**
 * PATCH /api/bookings/:id
 *
 * Update a booking's status, queue position or notes (receptionist only).
 *
 * Body: { status?, position?, cancelledReason?, notes? }
 *   - status 'cancelled' requires cancelledReason
 *   - position is 1-based and only applies to bookings still in the queue
 *
 * Queue invariant: active bookings (queued or in_service) in a branch hold
 * positions 1..N with no gaps or duplicates. When a booking leaves the queue
 * (done/cancelled) the ones behind it move up; when one re-enters it goes to
 * the back. All of this runs while holding the branch lock, so concurrent
 * updates and new customer bookings cannot interleave.
 *
 * 200 { success, booking } | 400 validation | 401 | 403 other branch | 404 | 500
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await isAuthenticated(request);
  if (!authResult.authenticated || !authResult.session) {
    return NextResponse.json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' }, { status: 401 });
  }
  const { userId, branchCode } = authResult.session;

  const { id } = await params;
  const bookingId = Number.parseInt(id, 10);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID', code: 'INVALID_ID' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
  }
  const { status, position, cancelledReason, notes } = body as {
    status?: string;
    position?: number;
    cancelledReason?: string;
    notes?: string | null;
  };

  const validStatuses = ['queued', 'in_service', 'done', 'cancelled'];
  if (status !== undefined && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status', code: 'INVALID_STATUS' }, { status: 400 });
  }
  if (status === 'cancelled' && !cancelledReason) {
    return NextResponse.json(
      { error: 'Cancellation reason required', code: 'MISSING_CANCEL_REASON' },
      { status: 400 }
    );
  }
  if (position !== undefined && (!Number.isInteger(position) || position < 1)) {
    return NextResponse.json(
      { error: 'Position must be positive integer', code: 'INVALID_POSITION' },
      { status: 400 }
    );
  }
  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 1000)) {
    return NextResponse.json({ error: 'Notes must be under 1000 characters', code: 'INVALID_NOTES' }, { status: 400 });
  }
  if (status === undefined && position === undefined && notes === undefined) {
    return NextResponse.json({ error: 'No fields to update', code: 'NO_UPDATES' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await lockBranchQueue(client, branchCode);

    const bookingResult = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Booking not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const booking = bookingResult.rows[0];
    if (booking.branch_code !== branchCode) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
    }

    const wasActive = ACTIVE_STATUSES.includes(booking.status);
    const nextStatus: string = status ?? booking.status;
    const willBeActive = ACTIVE_STATUSES.includes(nextStatus);
    let nextPosition: number = booking.position;

    if (wasActive && !willBeActive) {
      // Leaving the queue: everyone behind moves up one place.
      await client.query(
        `UPDATE bookings SET position = position - 1
         WHERE branch_code = $1 AND status IN ('queued', 'in_service')
           AND position > $2 AND id <> $3`,
        [branchCode, booking.position, bookingId]
      );
    } else if (!wasActive && willBeActive) {
      // Re-entering the queue: goes to the back.
      const max = await client.query(
        `SELECT COALESCE(MAX(position), 0) AS max FROM bookings
         WHERE branch_code = $1 AND status IN ('queued', 'in_service') AND id <> $2`,
        [branchCode, bookingId]
      );
      nextPosition = Number(max.rows[0].max) + 1;
    }

    if (position !== undefined && position !== booking.position && wasActive && willBeActive) {
      const count = await client.query(
        `SELECT COUNT(*) AS n FROM bookings
         WHERE branch_code = $1 AND status IN ('queued', 'in_service')`,
        [branchCode]
      );
      const newPosition = Math.min(position, Number(count.rows[0].n));

      if (newPosition < booking.position) {
        await client.query(
          `UPDATE bookings SET position = position + 1
           WHERE branch_code = $1 AND status IN ('queued', 'in_service')
             AND position >= $2 AND position < $3 AND id <> $4`,
          [branchCode, newPosition, booking.position, bookingId]
        );
      } else if (newPosition > booking.position) {
        await client.query(
          `UPDATE bookings SET position = position - 1
           WHERE branch_code = $1 AND status IN ('queued', 'in_service')
             AND position > $2 AND position <= $3 AND id <> $4`,
          [branchCode, booking.position, newPosition, bookingId]
        );
      }
      nextPosition = newPosition;
    }

    const cancelling = status === 'cancelled';
    const result = await client.query(
      `UPDATE bookings SET
         status = $1,
         position = $2,
         notes = CASE WHEN $3::boolean THEN $4::text ELSE notes END,
         cancelled_reason = CASE WHEN $5::boolean THEN $6::text ELSE cancelled_reason END,
         cancelled_by = CASE WHEN $5::boolean THEN $7::integer ELSE cancelled_by END,
         cancelled_at = CASE WHEN $5::boolean THEN NOW() ELSE cancelled_at END,
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        nextStatus,
        nextPosition,
        notes !== undefined,
        notes ?? null,
        cancelling,
        cancelledReason ?? null,
        userId,
        bookingId,
      ]
    );
    await client.query('COMMIT');

    const updated = result.rows[0];
    return NextResponse.json(
      {
        success: true,
        booking: {
          id: updated.id,
          branchCode: updated.branch_code,
          plate: updated.plate,
          vehicleMake: updated.vehicle_make,
          vehicleModel: updated.vehicle_model,
          customerName: updated.customer_name,
          customerMessenger: updated.customer_messenger,
          preferredTime: updated.preferred_time,
          status: updated.status,
          position: updated.position,
          cancelledReason: updated.cancelled_reason,
          cancelledBy: updated.cancelled_by,
          cancelledAt: updated.cancelled_at,
          notes: updated.notes,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[API] PATCH /api/bookings/[id] error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating booking', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
