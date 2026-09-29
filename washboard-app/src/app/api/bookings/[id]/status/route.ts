import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/bookings/:id/status?token=<magic link token>
 *
 * Public queue status for the customer's "you're in the queue" page, polled
 * every 10 seconds.
 *
 * The token is the (already used) magic link that created the booking. It
 * can no longer create bookings, but it proves the caller is the customer who
 * made this one, so booking IDs cannot be enumerated to read other customers'
 * queue status.
 *
 * Fixed 2026-09-26: an unknown booking ID used to spin in a retry loop that
 * never incremented its counter, re-querying the database until the function
 * timed out.
 *
 * 200 { status, position, inService, estimatedWaitMinutes?, completed?, cancelled? }
 * 400 invalid id/token | 404 not found (or token does not match) | 500
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookingId = Number.parseInt(id, 10);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID format', code: 'INVALID_BOOKING_ID' }, { status: 400 });
  }

  const token = request.nextUrl.searchParams.get('token');
  if (!token || token.length !== 128) {
    return NextResponse.json({ error: 'Missing or invalid token', code: 'INVALID_TOKEN' }, { status: 400 });
  }

  try {
    const result = await db.query(
      `SELECT b.status, b.position, b.created_at, br.avg_service_minutes
       FROM bookings b
       JOIN branches br ON b.branch_code = br.branch_code
       JOIN customer_magic_links ml ON ml.id = b.magic_link_id
       WHERE b.id = $1 AND ml.token = $2`,
      [bookingId, token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found', code: 'BOOKING_NOT_FOUND' }, { status: 404 });
    }

    const booking = result.rows[0];
    const headers = { 'Cache-Control': 'no-store' };

    switch (booking.status) {
      case 'queued':
        return NextResponse.json(
          {
            status: 'queued',
            position: booking.position,
            inService: false,
            estimatedWaitMinutes: Math.max(booking.position - 1, 0) * booking.avg_service_minutes,
            queuedAt: booking.created_at,
          },
          { headers }
        );
      case 'in_service':
        return NextResponse.json(
          { status: 'in_service', position: null, inService: true, estimatedWaitMinutes: 0 },
          { headers }
        );
      case 'done':
        return NextResponse.json({ status: 'done', position: null, inService: false, completed: true }, { headers });
      default:
        return NextResponse.json(
          { status: 'cancelled', position: null, inService: false, cancelled: true },
          { headers }
        );
    }
  } catch (error) {
    console.error('Error fetching booking status:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
