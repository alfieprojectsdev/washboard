import MagicLinksClient from '@/components/MagicLinksClient';
import db from '@/lib/db';
import { isScreenshotMode, requirePageUser } from '@/lib/auth/page-session';

/**
 * Magic Links Management Page
 *
 * Receptionists generate single-use booking links (with QR codes) for walk-in
 * customers and see which links are active, expired or used.
 */
export default async function MagicLinksPage() {
  if (isScreenshotMode()) {
    return (
      <MagicLinksClient
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
        }}
      />
    );
  }

  const user = await requirePageUser();

  const branchResult = await db.query(
    'SELECT branch_code, branch_name, location FROM branches WHERE branch_code = $1',
    [user.branchCode]
  );
  const branch = branchResult.rows[0];

  return (
    <MagicLinksClient
      user={user}
      branch={{
        branchCode: branch.branch_code,
        branchName: branch.branch_name,
        location: branch.location,
      }}
    />
  );
}
