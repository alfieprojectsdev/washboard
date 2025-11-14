import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAuthenticated } from '@/lib/auth/session';

/**
 * GET /api/magic-links/list
 *
 * List magic links for the authenticated user's branch.
 * Authenticated endpoint - requires valid session.
 *
 * Query Parameters:
 * - status: Filter by status (active, expired, used, all) - default: active
 * - limit: Maximum number of results (default: 50)
 *
 * Returns: Array of magic links with metadata
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

    const { branchCode } = authResult.session;

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'active';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // 3. Build query based on status filter
    let query = `
      SELECT
        ml.id,
        ml.branch_code,
        ml.token,
        ml.customer_name,
        ml.customer_messenger,
        ml.expires_at,
        ml.used_at,
        ml.booking_id,
        ml.created_at,
        u.name AS created_by_name,
        b.plate AS booking_plate
      FROM customer_magic_links ml
      LEFT JOIN users u ON ml.created_by = u.user_id
      LEFT JOIN bookings b ON ml.booking_id = b.id
      WHERE ml.branch_code = $1
    `;

    const params: any[] = [branchCode];

    // 4. Apply status filtering
    if (statusFilter === 'active') {
      query += ` AND ml.used_at IS NULL AND ml.expires_at > NOW()`;
    } else if (statusFilter === 'expired') {
      query += ` AND ml.used_at IS NULL AND ml.expires_at <= NOW()`;
    } else if (statusFilter === 'used') {
      query += ` AND ml.used_at IS NOT NULL`;
    }
    // 'all' = no additional filter

    query += ` ORDER BY ml.created_at DESC LIMIT $2`;
    params.push(limit);

    // 5. Execute query
    const result = await db.query(query, params);

    // 6. Format results
    const magicLinks = result.rows.map((link: any) => {
      const now = new Date();
      const expiresAt = new Date(link.expires_at);
      const isExpired = expiresAt < now;
      const isUsed = link.used_at !== null;

      let status: 'active' | 'expired' | 'used';
      if (isUsed) {
        status = 'used';
      } else if (isExpired) {
        status = 'expired';
      } else {
        status = 'active';
      }

      // Generate booking URL dynamically from request headers (production-aware)
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;
      const bookingUrl = `${baseUrl}/book/${link.branch_code}/${link.token}`;

      return {
        id: link.id,
        branchCode: link.branch_code,
        token: link.token,
        customerName: link.customer_name,
        customerMessenger: link.customer_messenger,
        expiresAt: link.expires_at,
        usedAt: link.used_at,
        bookingId: link.booking_id,
        bookingPlate: link.booking_plate,
        createdAt: link.created_at,
        createdByName: link.created_by_name,
        status,
        bookingUrl,
      };
    });

    return NextResponse.json(
      {
        success: true,
        magicLinks,
        count: magicLinks.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] GET /api/magic-links/list error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while fetching magic links',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
