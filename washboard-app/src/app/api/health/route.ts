import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health          -> 200 {"ok":true} without touching the database
 * GET /api/health?db=1     -> also runs SELECT 1 (503 if the database is unreachable)
 *
 * Point an uptime monitor at the plain URL. Pinging ?db=1 every few minutes
 * would keep Neon's compute awake around the clock and use up the free
 * tier's compute hours; check it by hand or at a long interval instead.
 */
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('db') !== '1') {
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    await db.query('SELECT 1');
    return NextResponse.json({ ok: true, db: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, db: 'unreachable' }, { status: 503 });
  }
}
