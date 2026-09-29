import type { NextRequest } from 'next/server';

/**
 * Base URL for links the app hands to customers (magic links, QR codes).
 *
 * NEXT_PUBLIC_APP_URL wins when set, so a QR code always points at the
 * canonical domain even if the dashboard was opened through a preview or
 * *.vercel.app URL. The request headers are the fallback for local dev.
 */
export function getAppBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}
