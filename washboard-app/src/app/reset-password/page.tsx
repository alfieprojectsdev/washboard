'use client';

import { FormEvent, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHashParam } from '@/lib/use-hash-param';

const noop = () => () => {};
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

const input =
  'appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

/**
 * /reset-password#token=<token>: set a new password from a reset link the
 * shop owner sent. The token stays in the fragment, so it never reaches the
 * server logs; it is posted in the request body.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const token = useHashParam('token');
  const [info, setInfo] = useState<{ valid: boolean; name?: string; username?: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch('/api/auth/token-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'reset', token }),
    })
      .then((r) => r.json())
      .then((data) => !cancelled && setInfo(data))
      .catch(() => !cancelled && setInfo({ valid: false }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 12) return setError('Password must be at least 12 characters long');
    if (password !== confirm) return setError('Passwords do not match');
    setSaving(true);
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    if (response?.ok) {
      router.push('/dashboard');
      return;
    }
    setError(data.error || 'Could not reset the password. Please try again.');
    setSaving(false);
  };

  const waiting = !isClient || (token && !info);
  const invalid = isClient && (!token || (info && !info.valid));

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">Set a new password</h2>
        {waiting ? (
          <p className="text-center text-sm text-gray-800">Checking your link…</p>
        ) : invalid ? (
          <div className="space-y-4 text-center text-sm text-gray-800">
            <p>This reset link has expired or was already used. Ask the shop owner for a new one.</p>
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-center text-sm text-gray-800">
              For {info?.name} (@{info?.username}). The link works once.
            </p>
            {error && (
              <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-900">New password (12+ characters)</label>
              <input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-gray-900">Confirm new password</label>
              <input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Set password and sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
