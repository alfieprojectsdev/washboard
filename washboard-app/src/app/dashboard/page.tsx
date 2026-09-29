import DashboardClient from '@/components/DashboardClient';
import db from '@/lib/db';
import { isScreenshotMode, requirePageUser } from '@/lib/auth/page-session';

/**
 * Dashboard Page
 *
 * Receptionist queue view: status changes, cancellations, reordering and the
 * shop open/closed toggle. Requires a login; the client polls every 10s.
 */
export default async function DashboardPage() {
  if (isScreenshotMode()) {
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

  const user = await requirePageUser();

  const branchResult = await db.query(
    'SELECT branch_code, branch_name, location, avg_service_minutes FROM branches WHERE branch_code = $1',
    [user.branchCode]
  );
  const branch = branchResult.rows[0];

  return (
    <DashboardClient
      user={user}
      branch={{
        branchCode: branch.branch_code,
        branchName: branch.branch_name,
        location: branch.location,
        avgServiceMinutes: branch.avg_service_minutes,
      }}
    />
  );
}
