import StaffClient from '@/components/StaffClient';
import db from '@/lib/db';
import { requirePageAdmin } from '@/lib/auth/page-session';

/** Staff management. Admins only; everyone else is sent back to the dashboard. */
export default async function StaffPage() {
  const admin = await requirePageAdmin();
  const branch = await db.query('SELECT branch_name FROM branches WHERE branch_code = $1', [admin.branchCode]);
  return <StaffClient branchName={branch.rows[0]?.branch_name ?? admin.branchCode} userName={admin.name} />;
}
