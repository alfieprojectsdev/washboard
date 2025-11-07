import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAuthenticated } from '@/lib/auth/session';

/**
 * GET /api/shop-status
 *
 * Retrieve current shop open/closed status.
 * Public endpoint - no authentication required.
 *
 * Query Parameters:
 * - branchCode: Branch to check (default: MAIN)
 *
 * Returns: Shop status with open/closed state and reason
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchCode = searchParams.get('branchCode') || 'MAIN';

    const result = await db.query(
      `SELECT
        ss.is_open,
        ss.reason,
        ss.updated_at,
        u.name AS updated_by_name
       FROM shop_status ss
       LEFT JOIN users u ON ss.updated_by = u.user_id
       WHERE ss.branch_code = $1`,
      [branchCode]
    );

    if (result.rows.length === 0) {
      // Return default: open with no reason
      return NextResponse.json(
        {
          success: true,
          status: {
            isOpen: true,
            reason: null,
            updatedAt: new Date().toISOString(),
            updatedByName: null,
          },
        },
        { status: 200 }
      );
    }

    const status = result.rows[0];

    return NextResponse.json(
      {
        success: true,
        status: {
          isOpen: status.is_open,
          reason: status.reason,
          updatedAt: status.updated_at,
          updatedByName: status.updated_by_name,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] GET /api/shop-status error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while fetching shop status',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shop-status
 *
 * Update shop open/closed status.
 * Authenticated endpoint - requires valid session.
 *
 * Request Body:
 * - isOpen: boolean (required)
 * - reason?: string (required when isOpen = false)
 *
 * Predefined closure reasons:
 * - Full queue / No available slots
 * - Under maintenance
 * - Power outage
 * - Water supply issue
 * - Staff shortage
 * - Weather interruption
 * - Closed early
 * - Holiday / Special event
 */
export async function POST(request: NextRequest) {
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

    // 2. Parse request body
    const body = await request.json();
    const { isOpen, reason } = body;

    // 3. Validate required fields
    if (typeof isOpen !== 'boolean') {
      return NextResponse.json(
        { error: 'isOpen must be a boolean', code: 'INVALID_IS_OPEN' },
        { status: 400 }
      );
    }

    // 4. Validate reason required when closing
    if (!isOpen && !reason) {
      return NextResponse.json(
        {
          error: 'Closure reason required when closing shop',
          code: 'MISSING_REASON',
        },
        { status: 400 }
      );
    }

    // 5. Validate reason against predefined list (optional - can be relaxed)
    const validReasons = [
      'Full queue / No available slots',
      'Under maintenance',
      'Power outage',
      'Water supply issue',
      'Staff shortage',
      'Weather interruption',
      'Closed early',
      'Holiday / Special event',
    ];

    if (!isOpen && reason && !validReasons.includes(reason)) {
      // Allow custom reasons but log for tracking
      console.log(`[SHOP_STATUS] Custom closure reason used: "${reason}"`);
    }

    // 6. Update shop status (upsert - compatible with pg-mem)
    // Try to update first
    let result = await db.query(
      `UPDATE shop_status
       SET is_open = $1, reason = $2, updated_by = $3, updated_at = NOW()
       WHERE branch_code = $4
       RETURNING *`,
      [isOpen, isOpen ? null : reason, userId, branchCode]
    );

    let updatedStatus;

    if (result.rows.length === 0) {
      // No existing row, insert new one
      result = await db.query(
        `INSERT INTO shop_status (branch_code, is_open, reason, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [branchCode, isOpen, isOpen ? null : reason, userId]
      );
      updatedStatus = result.rows[0];
    } else {
      updatedStatus = result.rows[0];
    }

    // 7. Get updated_by name
    const userResult = await db.query(
      'SELECT name FROM users WHERE user_id = $1',
      [userId]
    );
    const updatedByName = userResult.rows[0]?.name;

    return NextResponse.json(
      {
        success: true,
        status: {
          isOpen: updatedStatus.is_open,
          reason: updatedStatus.reason,
          updatedAt: updatedStatus.updated_at,
          updatedByName,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] POST /api/shop-status error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while updating shop status',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
