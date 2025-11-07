import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAuthenticated } from '@/lib/auth/session';

/**
 * GET /api/bookings
 *
 * Retrieve bookings with optional filters.
 * Authenticated endpoint - requires valid session.
 *
 * Query Parameters:
 * - status: Filter by booking status (queued, in_service, done, cancelled)
 * - branchCode: Filter by branch (defaults to authenticated user's branch)
 * - limit: Maximum number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 *
 * Returns: Array of booking objects with queue position and metadata
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const authResult = await isAuthenticated(request);
    if (!authResult.authenticated || !authResult.session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'NOT_AUTHENTICATED' },
        { status: 401 }
      );
    }

    const { branchCode: userBranchCode } = authResult.session;

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const branchCode = searchParams.get('branchCode') || userBranchCode;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // 3. Validate status parameter
    const validStatuses = ['queued', 'in_service', 'done', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status parameter', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // 4. Security: Ensure user can only access their branch's data
    if (branchCode !== userBranchCode) {
      return NextResponse.json(
        { error: 'Access denied to other branches', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 5. Build query with filters
    let query = `
      SELECT
        b.id,
        b.branch_code,
        b.plate,
        b.vehicle_make,
        b.vehicle_model,
        b.customer_name,
        b.customer_messenger,
        b.preferred_time,
        b.status,
        b.position,
        b.cancelled_reason,
        b.cancelled_by,
        b.cancelled_at,
        b.notes,
        b.created_at,
        b.updated_at,
        u.name AS cancelled_by_name
      FROM bookings b
      LEFT JOIN users u ON b.cancelled_by = u.user_id
      WHERE b.branch_code = $1
    `;

    const params: any[] = [branchCode];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND b.status = $${paramCount}`;
      params.push(status);
    }

    // 6. Order by position for active bookings, created_at DESC for completed/cancelled
    query += `
      ORDER BY
        CASE WHEN b.status IN ('queued', 'in_service') THEN b.position ELSE 999999 END,
        b.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(limit, offset);

    // 7. Execute query
    const result = await db.query(query, params);

    // 8. Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM bookings WHERE branch_code = $1';
    const countParams: any[] = [branchCode];

    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // 9. Calculate estimated wait times for queued bookings
    const branchResult = await db.query(
      'SELECT avg_service_minutes FROM branches WHERE branch_code = $1',
      [branchCode]
    );
    const avgServiceMinutes = branchResult.rows[0]?.avg_service_minutes || 20;

    const bookings = result.rows.map((booking: any) => {
      const estimatedWaitMinutes =
        booking.status === 'queued'
          ? (booking.position - 1) * avgServiceMinutes
          : null;

      return {
        ...booking,
        estimatedWaitMinutes,
        preferredTime: booking.preferred_time,
        cancelledReason: booking.cancelled_reason,
        cancelledBy: booking.cancelled_by,
        cancelledByName: booking.cancelled_by_name,
        cancelledAt: booking.cancelled_at,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        vehicleMake: booking.vehicle_make,
        vehicleModel: booking.vehicle_model,
        customerName: booking.customer_name,
        customerMessenger: booking.customer_messenger,
        branchCode: booking.branch_code,
      };
    });

    return NextResponse.json(
      {
        success: true,
        bookings,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] GET /api/bookings error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while fetching bookings',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
