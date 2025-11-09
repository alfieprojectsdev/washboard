import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClient from '@/components/DashboardClient';
import db from '@/lib/db';

/**
 * Dashboard Page
 *
 * Receptionist management interface for viewing and managing bookings.
 * Protected route - requires authentication.
 *
 * Features:
 * - View queue of bookings
 * - Update booking status (queued → in_service → done)
 * - Cancel bookings with reasons
 * - Reorder queue positions
 * - Toggle shop open/closed status
 * - Real-time polling for updates
 */
export default async function DashboardPage() {
  // Check if running in screenshot mode (for portfolio screenshots without database)
  const isScreenshotMode = process.env.WASHBOARD_SCREENSHOT_MODE === 'true';

  // 1. Check authentication on server side
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('washboard_session')?.value;

  if (!sessionId && !isScreenshotMode) {
    redirect('/login');
  }

  // 2. Validate session (skip in screenshot mode)
  let sessionResult;
  if (!isScreenshotMode) {
    sessionResult = await db.query(
      'SELECT sess, user_id, branch_code FROM sessions WHERE sid = $1 AND expire > NOW()',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      redirect('/login');
    }
  }

  // Handle screenshot mode with mock data
  if (isScreenshotMode) {
    return (
      <DashboardClient
        user={{
          userId: 1,
          username: 'demo_receptionist',
          name: 'Sarah Johnson',
          email: 'receptionist@carwash.local',
          role: 'receptionist',
          branchCode: 'MAIN',
        }}
        branch={{
          branchCode: 'MAIN',
          branchName: 'Main Branch',
          location: '123 Car Wash Lane',
          avgServiceMinutes: 20,
        }}
      />
    );
  }

  // TypeScript: sessionResult is guaranteed to be defined here (screenshot mode returned early)
  const session = sessionResult!.rows[0];
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
    'SELECT branch_code, branch_name, location, avg_service_minutes FROM branches WHERE branch_code = $1',
    [user.branch_code]
  );

  const branch = branchResult.rows[0];

  // 5. Pass user and branch data to client component
  return (
    <DashboardClient
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
        avgServiceMinutes: branch.avg_service_minutes,
      }}
    />
  );
}
