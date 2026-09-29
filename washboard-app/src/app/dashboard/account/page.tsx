import Link from 'next/link';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import { requirePageUser } from '@/lib/auth/page-session';

/** Your own account: who you are signed in as, and changing your password. */
export default async function AccountPage() {
  const user = await requirePageUser();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900">Your account</h1>
          <Link href="/dashboard" className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900">
            ← Back to Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-gray-600">Name</dt>
            <dd className="text-gray-900">{user.name}</dd>
            <dt className="text-gray-600">Username</dt>
            <dd className="text-gray-900">@{user.username}</dd>
            <dt className="text-gray-600">Branch</dt>
            <dd className="text-gray-900">{user.branchCode}</dd>
            <dt className="text-gray-600">Role</dt>
            <dd className="text-gray-900">{user.role}</dd>
          </dl>
        </section>
        <ChangePasswordForm />
      </main>
    </div>
  );
}
