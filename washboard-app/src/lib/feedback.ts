/**
 * Feedback: validation, path redaction and the optional Discord notification.
 *
 * Every submission is stored in the feedback table first. If
 * FEEDBACK_WEBHOOK_URL is set (a Discord channel webhook: Server Settings ->
 * Integrations -> Webhooks), a short summary is also posted there so the owner
 * gets a phone notification. The webhook is best-effort: a Discord outage
 * never loses feedback or fails the request.
 */

export const FEEDBACK_KINDS = ['problem', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  contact: string | null;
  page: string | null;
}

export function parseFeedback(body: unknown): { ok: true; value: FeedbackInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }
  const { kind, message, contact, page } = body as Record<string, unknown>;

  const normalizedKind = typeof kind === 'string' && (FEEDBACK_KINDS as readonly string[]).includes(kind)
    ? (kind as FeedbackKind)
    : 'other';

  if (typeof message !== 'string' || message.trim().length === 0) {
    return { ok: false, error: 'Please write a message' };
  }
  if (message.trim().length > 2000) {
    return { ok: false, error: 'Message must be under 2000 characters' };
  }
  if (contact !== undefined && contact !== null && (typeof contact !== 'string' || contact.length > 200)) {
    return { ok: false, error: 'Contact must be under 200 characters' };
  }

  return {
    ok: true,
    value: {
      kind: normalizedKind,
      message: message.trim(),
      contact: typeof contact === 'string' && contact.trim() ? contact.trim() : null,
      page: typeof page === 'string' ? redactPath(page).slice(0, 300) : null,
    },
  };
}

/** Strip booking tokens and query strings so feedback never stores a live link. */
export function redactPath(path: string): string {
  return path
    .split(/[?#]/)[0]
    .replace(/^(\/book\/[^/]+\/)[^/]+/, '$1[link]');
}

export async function notifyFeedback(feedback: FeedbackInput, appName: string): Promise<void> {
  const url = process.env.FEEDBACK_WEBHOOK_URL;
  if (!url) {
    return;
  }

  const lines = [
    `**${appName} feedback** (${feedback.kind})${feedback.page ? ` on \`${feedback.page}\`` : ''}`,
    feedback.message,
    feedback.contact ? `Contact: ${feedback.contact}` : 'No contact left',
  ];

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: lines.join('\n').slice(0, 1900),
        // Feedback text is user input: never let it ping @everyone or roles.
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error('Feedback webhook failed:', err instanceof Error ? err.message : err);
  }
}
