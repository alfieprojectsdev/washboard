'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';

interface StaffMember {
  userId: number;
  username: string;
  name: string;
  email: string | null;
  role: 'admin' | 'receptionist';
  active: boolean;
  lastLoginAt: string | null;
  isYou: boolean;
}

interface Invite {
  id: number;
  note: string | null;
  role: 'admin' | 'receptionist';
  expiresAt: string;
  createdByName: string | null;
}

interface NewInvite {
  url: string;
  qrCode: string;
  expiresAt: string;
  note: string | null;
}

interface ResetLink {
  userId: number;
  name: string;
  url: string;
  expiresAt: string;
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';

const button =
  'rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50';

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        aria-label="Link"
        onFocus={(e) => e.target.select()}
        className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900"
      />
      <button
        type="button"
        className={`${button} bg-green-600 text-white hover:bg-green-700`}
        onClick={async () => {
          await navigator.clipboard.writeText(url).catch(() => {});
          setCopied(true);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/**
 * Staff management for the shop owner (admins): invite people with a
 * single-use link, send password reset links, change roles, remove access.
 */
export default function StaffClient({ branchName, userName }: { branchName: string; userName: string }) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [role, setRole] = useState<'receptionist' | 'admin'>('receptionist');
  const [newInvite, setNewInvite] = useState<NewInvite | null>(null);
  const [resetLink, setResetLink] = useState<ResetLink | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/staff', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || 'Could not load staff');
        setStaff(data.staff);
        setInvites(data.invites);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const call = async (url: string, init: RequestInit) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Something went wrong');
        return null;
      }
      setReload((n) => n + 1);
      return data;
    } catch {
      setError('No connection. Please try again.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async (e: FormEvent) => {
    e.preventDefault();
    const data = await call('/api/staff/invites', { method: 'POST', body: JSON.stringify({ note, role }) });
    if (data) {
      setNewInvite(data.invite);
      setNote('');
      setRole('receptionist');
    }
  };

  const sendReset = async (member: StaffMember) => {
    const data = await call(`/api/staff/${member.userId}/reset-link`, { method: 'POST' });
    if (data) setResetLink({ userId: member.userId, ...data.resetLink });
  };

  const update = async (member: StaffMember, change: { role?: string; active?: boolean }) => {
    if (change.active === false && !confirm(`Remove ${member.name}'s access? They will be signed out now.`)) return;
    await call(`/api/staff/${member.userId}`, { method: 'PATCH', body: JSON.stringify(change) });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👥 Staff</h1>
            <p className="mt-1 text-sm text-gray-600">
              {branchName} • {userName}
            </p>
          </div>
          <Link href="/dashboard" className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </p>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Invite someone</h2>
          <p className="mt-1 text-sm text-gray-700">
            Create a link and send it to them (Messenger, SMS, or show the QR code). It works once and expires in 7
            days. They choose their own username and password.
          </p>
          <form onSubmit={createInvite} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor="invite-note" className="mb-1 block text-sm font-medium text-gray-900">
                Who is it for? <span className="font-normal text-gray-600">(optional)</span>
              </label>
              <input
                id="invite-note"
                maxLength={100}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Rico, weekend shift"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-gray-900">
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'receptionist' | 'admin')}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900"
              >
                <option value="receptionist">Receptionist</option>
                <option value="admin">Admin (can manage staff)</option>
              </select>
            </div>
            <button type="submit" disabled={busy} className={`${button} bg-blue-600 px-4 py-2 text-white hover:bg-blue-700`}>
              Create invite link
            </button>
          </form>

          {newInvite && (
            <div className="mt-6 flex flex-wrap gap-6 rounded-lg border border-green-200 bg-green-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR code */}
              <img src={newInvite.qrCode} alt="QR code of the invite link" className="h-40 w-40 rounded border border-gray-200 bg-white" />
              <div className="min-w-[16rem] flex-1 space-y-2">
                <p className="font-medium text-green-900">
                  Invite link{newInvite.note ? ` for ${newInvite.note}` : ''} (shown once)
                </p>
                <CopyLink url={newInvite.url} />
                <p className="text-sm text-green-900">Expires {when(newInvite.expiresAt)}.</p>
                <button type="button" className="text-sm text-green-900 underline" onClick={() => setNewInvite(null)}>
                  Done
                </button>
              </div>
            </div>
          )}

          {invites.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900">Waiting to be used</h3>
              <ul className="mt-2 divide-y divide-gray-100">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-gray-900">
                      {invite.note || 'Unnamed invite'} · {invite.role}{' '}
                      <span className="text-gray-600">· expires {when(invite.expiresAt)}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => call(`/api/staff/invites/${invite.id}`, { method: 'DELETE' })}
                      className={`${button} border border-gray-300 text-gray-800 hover:bg-gray-50`}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="p-6 pb-2">
            <h2 className="text-lg font-semibold text-gray-900">Accounts</h2>
            <p className="mt-1 text-sm text-gray-700">
              Forgotten password? Send them a reset link (works once, for 24 hours). Removing access signs them out
              straight away; their bookings history stays.
            </p>
          </div>

          {resetLink && (
            <div className="mx-6 mb-4 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="font-medium text-blue-900">Reset link for {resetLink.name} (shown once)</p>
              <CopyLink url={resetLink.url} />
              <p className="text-sm text-blue-900">
                Expires {when(resetLink.expiresAt)}.{' '}
                <button type="button" className="underline" onClick={() => setResetLink(null)}>
                  Done
                </button>
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Last login</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff === null && !error && (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-gray-600">
                      Loading…
                    </td>
                  </tr>
                )}
                {staff?.map((member) => (
                  <tr key={member.userId} className={member.active ? '' : 'bg-gray-50 text-gray-500'}>
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-900">
                        {member.name} {member.isYou && <span className="text-gray-500">(you)</span>}
                      </div>
                      <div className="text-gray-600">
                        @{member.username}
                        {!member.active && <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">access removed</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          member.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{when(member.lastLoginAt)}</td>
                    <td className="px-6 py-3">
                      {member.isYou ? (
                        <Link href="/dashboard/account" className="text-blue-700 underline">
                          Change your password
                        </Link>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {member.active && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => sendReset(member)}
                              className={`${button} border border-blue-300 text-blue-800 hover:bg-blue-50`}
                            >
                              Reset password
                            </button>
                          )}
                          {member.active && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => update(member, { role: member.role === 'admin' ? 'receptionist' : 'admin' })}
                              className={`${button} border border-gray-300 text-gray-800 hover:bg-gray-50`}
                            >
                              {member.role === 'admin' ? 'Make receptionist' : 'Make admin'}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => update(member, { active: !member.active })}
                            className={`${button} ${
                              member.active
                                ? 'border border-red-300 text-red-700 hover:bg-red-50'
                                : 'border border-green-300 text-green-800 hover:bg-green-50'
                            }`}
                          >
                            {member.active ? 'Remove access' : 'Restore access'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
