import type { PoolClient } from 'pg';

/** Statuses that occupy a place in the queue. */
export const ACTIVE_STATUSES = ['queued', 'in_service'];

/**
 * Serialise queue changes for one branch for the rest of the transaction.
 *
 * Locking the branch row (rather than the booking rows) also covers the empty
 * queue: with no active bookings there is nothing else to lock, and two
 * customers submitting at once would both have been given position 1.
 * Call inside BEGIN ... COMMIT.
 */
export async function lockBranchQueue(client: PoolClient, branchCode: string): Promise<void> {
  await client.query('SELECT 1 FROM branches WHERE branch_code = $1 FOR UPDATE', [branchCode]);
}
