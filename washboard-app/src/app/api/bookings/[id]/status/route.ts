import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/bookings/:id/status
 *
 * Public endpoint - returns current queue position and status for a booking.
 * No authentication required (customer-facing).
 *
 * @param id - Booking ID (integer)
 * @returns {QueueStatus} Current queue status with position and estimated wait
 *
 * @example
 * GET /api/bookings/123/status
 * Response: { "status": "queued", "position": 5, "estimatedWaitMinutes": 80 }
 *
 * Performance: Single indexed query, < 100ms response time
 * Polling: Designed for 10-second polling intervals
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookingId = parseInt(id);
    if (isNaN(bookingId) || bookingId <= 0) {
      return NextResponse.json(
        { error: 'Invalid booking ID format', code: 'INVALID_BOOKING_ID' },
        { status: 400 }
      );
    }

    const bookingQuery = `
      SELECT 
        b.id,
        b.status,
        b.position,
        b.branch_code,
        b.created_at,
        br.avg_service_minutes
      FROM bookings b
      JOIN branches br ON b.branch_code = br.branch_code
      WHERE b.id = $1
    `;

    const result = await db.query(bookingQuery, [bookingId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
        { status: 404 }
      );
    }

    const booking = result.rows[0];
    const { avg_service_minutes } = booking;

    let response: any;

    switch (booking.status) {
      case 'queued':
        const estimatedWaitMinutes = booking.position > 1 
          ? (booking.position - 1) * avg_service_minutes 
          : 0;

        response = {
          status: 'queued',
          position: booking.position,
          inService: false,
          estimatedWaitMinutes,
          queuedAt: booking.created_at,
        };
        break;

      case 'in_service':
        response = {
          status: 'in_service',
          position: null,
          inService: true,
          estimatedWaitMinutes: 0,
        };
        break;

      case 'done':
        response = {
          status: 'done',
          position: null,
          inService: false,
          completed: true,
        };
        break;

      case 'cancelled':
        response = {
          status: 'cancelled',
          position: null,
          inService: false,
          cancelled: true,
        };
        break;

      default:
        response = {
          status: booking.status,
          position: booking.position || null,
          inService: booking.status === 'in_service',
        };
    }

    const headers = new Headers({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Error fetching booking status:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });

  return new NextResponse(null, { status: 200, headers });
}