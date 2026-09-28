'use client';

import { FormEvent, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const KINDS = [
  { value: 'problem', label: 'Something is wrong' },
  { value: 'idea', label: 'Idea' },
  { value: 'other', label: 'Other' },
] as const;

type Kind = (typeof KINDS)[number]['value'];

/**
 * Floating "Feedback" button on every page. Opens a native <dialog> (Esc to
 * close, focus handled by the browser) and posts to /api/feedback.
 */
export default function FeedbackButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [kind, setKind] = useState<Kind>('problem');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const open = () => {
    if (status === 'sent') {
      setStatus('idle');
    }
    setError('');
    dialogRef.current?.showModal();
  };

  const close = () => dialogRef.current?.close();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('sending');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, contact, page: pathname, website }),
      });
      if (response.ok) {
        setStatus('sent');
        setMessage('');
        setContact('');
        return;
      }
      const data = await response.json().catch(() => ({}));
      setError(data.error || 'Could not send. Please try again.');
    } catch {
      setError('No connection. Please try again.');
    }
    setStatus('idle');
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 print:hidden"
      >
        Feedback
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="feedback-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/40"
      >
        {status === 'sent' ? (
          <div className="p-6 text-center">
            <h2 id="feedback-title" className="text-lg font-semibold">Thanks, your message was sent</h2>
            <p className="mt-2 text-sm text-gray-700">We read every message.</p>
            <button
              type="button"
              onClick={close}
              className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="feedback-title" className="text-lg font-semibold">Send feedback</h2>
                <p className="mt-1 text-sm text-gray-700">Tell us what went wrong or what would help.</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                ✕
              </button>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">What is it about?</legend>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-sm focus-within:ring-2 focus-within:ring-blue-500 ${
                      kind === option.value
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-gray-300 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="feedback-kind"
                      value={option.value}
                      checked={kind === option.value}
                      onChange={() => setKind(option.value)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="feedback-message" className="mb-1 block text-sm font-medium">
                Message
              </label>
              <textarea
                id="feedback-message"
                required
                maxLength={2000}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="What happened, or what would you change?"
              />
            </div>

            <div>
              <label htmlFor="feedback-contact" className="mb-1 block text-sm font-medium">
                How can we reach you? <span className="font-normal text-gray-600">(optional)</span>
              </label>
              <input
                id="feedback-contact"
                type="text"
                maxLength={200}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Messenger, phone or email"
              />
            </div>

            {/* Honeypot: hidden from people and screen readers, filled by bots. */}
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
              <label htmlFor="feedback-website">Website</label>
              <input
                id="feedback-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending...' : 'Send'}
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
