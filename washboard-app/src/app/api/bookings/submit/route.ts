import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { validateMagicLink } from '@/lib/magic-links/utils';
import { lockBranchQueue } from '@/lib/bookings/queue';

/**
 * POST /api/bookings/submit
 *
 * Public endpoint: a customer submits a booking using the magic link the
 * receptionist gave them. The link is the only credential, and it works once.
 *
 * Body: { token, plate, vehicleMake, vehicleModel,
 *         customerName?, customerMessenger?, preferredTime?, notes? }
 *
 * Single use is enforced inside the transaction by
 *   UPDATE customer_magic_links SET used_at = NOW()
 *   WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
 * Two simultaneous submits with the same link both pass the read-only check
 * below, but only one of them can win that UPDATE. (Before 2026-09-26 the
 * UPDATE had no "used_at IS NULL" condition, so both would create a booking.)
 * The unique index idx_bookings_one_per_magic_link is the database backstop.
 *
 * 201 { success, booking: { id, position, status, branchCode } }
 * 400 missing/invalid fields | 403 link invalid/expired/used or shop closed
 * 503 shop status missing | 500 server error
 */

const LIMITS = { plate: 20, vehicleMake: 50, vehicleModel: 50, customerName: 100, customerMessenger: 255, notes: 1000 };

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
  }

  const { token, plate, vehicleMake, vehicleModel, customerName, customerMessenger, preferredTime, notes } = body;

  if (
    typeof plate !== 'string' || !plate.trim() ||
    typeof vehicleMake !== 'string' || !vehicleMake.trim() ||
    typeof vehicleModel !== 'string' || !vehicleModel.trim() ||
    !token
  ) {
    return NextResponse.json({ error: 'Missing required fields', code: 'MISSING_FIELDS' }, { status: 400 });
  }

  if (typeof token !== 'string' || token.length !== 128) {
    return NextResponse.json({ error: 'Invalid token format', code: 'INVALID_TOKEN' }, { status: 400 });
  }

  const fields = { plate, vehicleMake, vehicleModel, customerName, customerMessenger, notes } as Record<string, unknown>;
  for (const [name, max] of Object.entries(LIMITS)) {
    const value = fields[name];
    if (typeof value === 'string' && value.trim().length > max) {
      return NextResponse.json(
        { error: `${name} must be at most ${max} characters`, code: 'FIELD_TOO_LONG' },
        { status: 400 }
      );
    }
  }

  let preferred: Date | null = null;
  if (typeof preferredTime === 'string' && preferredTime !== '') {
    preferred = new Date(preferredTime);
    if (Number.isNaN(preferred.getTime())) {
      return NextResponse.json({ error: 'Invalid preferred time', code: 'INVALID_TIME' }, { status: 400 });
    }
  }

  try {
    // Read-only check first, for a specific error message and to learn the branch.
    const validation = await validateMagicLink(token);
    if (!validation.valid || !validation.link) {
      return NextResponse.json(
        { error: 'Invalid or expired link', code: validation.error || 'INVALID_TOKEN' },
        { status: 403 }
      );
    }
    const branchCode = validation.link.branchCode;

    // Checked before claiming the link, so a closed shop does not burn it.
    const shopStatusResult = await db.query('SELECT is_open, reason FROM shop_status WHERE branch_code = $1', [
      branchCode,
    ]);
    if (shopStatusResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Bookings are currently unavailable. Please contact the shop.', code: 'SHOP_UNAVAILABLE' },
        { status: 503 }
      );
    }
    const shopStatus = shopStatusResult.rows[0];
    if (!shopStatus.is_open) {
      return NextResponse.json(
        { error: shopStatus.reason || 'Sorry, we are currently closed. Please try again later.', code: 'SHOP_CLOSED' },
        { status: 403 }
      );
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await lockBranchQueue(client, branchCode);

      const claim = await client.query(
        `UPDATE customer_magic_links
         SET used_at = NOW()
         WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING id`,
        [token]
      );
      if (claim.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Invalid or expired link', code: 'ALREADY_USED' }, { status: 403 });
      }
      const magicLinkId = claim.rows[0].id;

      const positionResult = await client.query(
        `SELECT COALESCE(MAX(position), 0) + 1 AS position FROM bookings
         WHERE branch_code = $1 AND status IN ('queued', 'in_service')`,
        [branchCode]
      );
      const position = Number(positionResult.rows[0].position);

      const result = await client.query(
        `INSERT INTO bookings (
          branch_code, magic_link_id, plate, vehicle_make, vehicle_model,
          customer_name, customer_messenger, preferred_time, status, position, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued', $9, $10)
        RETURNING id, branch_code, position, status`,
        [
          branchCode,
          magicLinkId,
          plate.trim(),
          vehicleMake.trim(),
          vehicleModel.trim(),
          optionalText(customerName),
          optionalText(customerMessenger),
          preferred,
          position,
          optionalText(notes),
        ]
      );
      const booking = result.rows[0];

      await client.query('UPDATE customer_magic_links SET booking_id = $1 WHERE id = $2', [booking.id, magicLinkId]);
      await client.query('COMMIT');

      return NextResponse.json(
        {
          success: true,
          booking: {
            id: booking.id,
            position: booking.position,
            status: booking.status,
            branchCode: booking.branch_code,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    // Never log the token or the request body.
    console.error('Booking submission error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'An error occurred while submitting your booking', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
