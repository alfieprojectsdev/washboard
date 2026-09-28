import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { applyRateLimit } from '@/lib/auth/rate-limit';
import { notifyFeedback, parseFeedback } from '@/lib/feedback';

const feedbackLimiter = {
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Thanks! That is a lot of feedback for one hour, please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
};

/**
 * POST /api/feedback
 *
 * Public: customers on the booking pages and receptionists on the dashboard
 * both use it. Body: { kind: 'problem'|'idea'|'other', message, contact?, page?, website? }
 *
 * "website" is a honeypot field hidden from people; bots that fill every input
 * get a 201 and nothing is stored. Logged-in receptionists are linked by
 * user_id so the owner can follow up without asking for contact details.
 *
 * 201 { ok: true } | 400 { error } | 429 | 500
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (body && typeof body === 'object' && (body as Record<string, unknown>).website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const parsed = parseFeedback(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const limited = await applyRateLimit(request, feedbackLimiter, 'feedback');
  if (limited) {
    return limited;
  }

  try {
    const user = await getCurrentUser(request);
    await db.query(
      `INSERT INTO feedback (kind, message, contact, page, user_agent, user_id, branch_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        parsed.value.kind,
        parsed.value.message,
        parsed.value.contact,
        parsed.value.page,
        request.headers.get('user-agent')?.slice(0, 300) ?? null,
        user?.userId ?? null,
        user?.branchCode ?? null,
      ]
    );

    await notifyFeedback(
      { ...parsed.value, contact: parsed.value.contact ?? (user ? `${user.name} (receptionist)` : null) },
      'Washboard'
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('Feedback error:', err);
    return NextResponse.json({ error: 'Could not send feedback. Please try again.' }, { status: 500 });
  }
}
