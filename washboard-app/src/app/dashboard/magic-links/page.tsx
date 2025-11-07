import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MagicLinksClient from '@/components/MagicLinksClient';
import db from '@/lib/db';

/**
 * Magic Links Management Page
 *
 * Receptionist interface for generating and managing magic links.
 * Protected route - requires authentication.
 *
 * Features:
 * - Generate new magic links with optional customer info
 * - View active, expired, and used links
 * - Display QR codes for easy customer scanning
 * - Copy booking URLs to clipboard
 */
export default async function MagicLinksPage() {
  // 1. Check authentication on server side
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('washboard_session')?.value;

  if (!sessionId) {
    redirect('/login');
  }

  // 2. Validate session
  const sessionResult = await db.query(
    'SELECT sess, user_id, branch_code FROM sessions WHERE sid = $1 AND expire > NOW()',
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    redirect('/login');
  }

  const session = sessionResult.rows[0];
  const sessionData = typeof session.sess === 'string'
    ? JSON.parse(session.sess)
    : session.sess;

  // 3. Fetch user details
  const userResult = await db.query(
    'SELECT user_id, username, name, email, role, branch_code FROM users WHERE user_id = $1',
    [session.user_id]
  );

  if (userResult.rows.length === 0) {
    redirect('/login');
  }

  const user = userResult.rows[0];

  // 4. Fetch branch details
  const branchResult = await db.query(
    'SELECT branch_code, branch_name, location FROM branches WHERE branch_code = $1',
    [user.branch_code]
  );

  const branch = branchResult.rows[0];

  // 5. Pass user and branch data to client component
  return (
    <MagicLinksClient
      user={{
        userId: user.user_id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        branchCode: user.branch_code,
      }}
      branch={{
        branchCode: branch.branch_code,
        branchName: branch.branch_name,
        location: branch.location,
      }}
    />
  );
}
