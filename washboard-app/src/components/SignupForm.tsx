'use client';

import { FormEvent, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHashParam } from '@/lib/use-hash-param';

const noop = () => () => {};
/** False during server render and hydration, true afterwards. */
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

interface InviteInfo {
  valid: boolean;
  branchName?: string;
  role?: 'admin' | 'receptionist';
  note?: string | null;
}

const input =
  'appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="mb-1 block text-sm font-medium text-gray-900">
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type ?? 'text'}
        required={props.required ?? true}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={input}
      />
    </div>
  );
}

/**
 * Account creation. Three cases:
 *  - /signup#invite=<token>: joining from an invite link an admin sent
 *  - /signup while OWNER_SETUP_CODE is set: the owner creating the first admin
 *  - otherwise: signup is closed; ask the owner for a link
 */
export default function SignupForm({ setupOpen }: { setupOpen: boolean }) {
  const router = useRouter();
  const isClient = useIsClient();
  const inviteToken = useHashParam('invite');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [form, setForm] = useState({ setupCode: '', branchCode: 'MAIN', username: '', name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    fetch('/api/auth/token-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'invite', token: inviteToken }),
    })
      .then((r) => r.json())
      .then((data: InviteInfo) => !cancelled && setInvite(data))
      .catch(() => !cancelled && setInvite({ valid: false }));
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 12) return setError('Password must be at least 12 characters long');
    if (form.password !== form.confirm) return setError('Passwords do not match');

    setLoading(true);
    const body = inviteToken
      ? { invite_token: inviteToken, username: form.username, name: form.name, email: form.email || undefined, password: form.password }
      : {
          setup_code: form.setupCode,
          branch_code: form.branchCode,
          username: form.username,
          name: form.name,
          email: form.email || undefined,
          password: form.password,
        };
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.ok) {
        router.push('/dashboard');
        return;
      }
      setError(data.error || 'Signup failed');
    } catch {
      setError('An error occurred. Please try again.');
    }
    setLoading(false);
  };

  const shell = (title: string, subtitle: string, content: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">{title}</h2>
          <p className="mt-2 text-center text-sm text-gray-800">{subtitle}</p>
        </div>
        {content}
      </div>
    </div>
  );

  if (!isClient || (inviteToken && !invite)) {
    return shell('Create account', 'Checking your link…', null);
  }

  if (inviteToken && invite && !invite.valid) {
    return shell(
      'Link expired',
      'This invite link has expired or was already used. Ask the shop owner for a new one.',
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Go to sign in
        </Link>
      </p>
    );
  }

  if (!inviteToken && !setupOpen) {
    return shell(
      'Signup is by invitation',
      'Ask the shop owner to send you an invite link from the Staff page.',
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Already have an account? Sign in
        </Link>
      </p>
    );
  }

  const title = inviteToken ? `Join ${invite?.branchName ?? 'Washboard'}` : 'Set up the owner account';
  const subtitle = inviteToken
    ? `You've been invited as ${invite?.role === 'admin' ? 'an admin' : 'a receptionist'}. Choose a username and password.`
    : 'This creates the shop admin account. Afterwards, invite staff from the Staff page.';

  return shell(
    title,
    subtitle,
    <form className="mt-8 space-y-6" onSubmit={submit}>
      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="space-y-4">
        {!inviteToken && (
          <>
            <Field id="setupCode" label="Owner setup code" value={form.setupCode} onChange={set('setupCode')} autoComplete="off" />
            <Field id="branchCode" label="Branch code" value={form.branchCode} onChange={set('branchCode')} />
          </>
        )}
        <Field id="username" label="Username" value={form.username} onChange={set('username')} placeholder="3-50 letters, numbers, _ or -" autoComplete="username" />
        <Field id="name" label="Full name" value={form.name} onChange={set('name')} autoComplete="name" />
        <Field id="email" label="Email (optional)" type="email" required={false} value={form.email} onChange={set('email')} autoComplete="email" />
        <Field id="password" label="Password (12+ characters)" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        <Field id="confirmPassword" label="Confirm password" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>
      <p className="text-center text-sm">
        <span className="text-gray-800">Already have an account? </span>
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Sign in
        </Link>
      </p>
    </form>
  );
}
