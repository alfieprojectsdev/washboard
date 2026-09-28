'use client';

import { FormEvent, useState } from 'react';

const input =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

/** Change your own password; other devices are signed out. */
export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword.length < 12) return setMessage({ ok: false, text: 'New password must be at least 12 characters long' });
    if (newPassword !== confirm) return setMessage({ ok: false, text: 'New passwords do not match' });

    setSaving(true);
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setSaving(false);

    if (response?.ok) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setMessage({ ok: true, text: 'Password changed. Any other devices were signed out.' });
    } else {
      setMessage({ ok: false, text: data.error || 'Could not change the password. Please try again.' });
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Change password</h2>
      <form onSubmit={submit} className="mt-4 max-w-md space-y-4">
        <div>
          <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-gray-900">Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-900">New password (12+ characters)</label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-900">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
        </div>
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={`rounded-md px-3 py-2 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50">
          {saving ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </section>
  );
}
